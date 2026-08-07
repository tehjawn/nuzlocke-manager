"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { failAction } from "@/lib/action-error";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  fetchTrainerBoardSlotRow,
  type DeferredTrainerBoardSlot,
} from "@/lib/challenge-cache";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { mapPokemonRow } from "@/lib/map-pokemon-row";
import { getAccessForChallenge } from "@/lib/permissions";
import { toPublicPokemonEntry } from "@/lib/pokemon-privacy";
import { loadSurvivalPollTallies } from "@/lib/survival-markets";

type ActionFail = { ok: false; error: string };
type Ok = { ok: true; pokemon: PokemonEntry[] };

const DeferredSlotSchema = z.enum(["RESERVE", "GRAVEYARD", "ENCOUNTERED"]);

const FetchTrainerBoardSlotSchema = z.object({
  slug: z.string().min(1).max(64),
  trainerId: z.string().min(1).max(64),
  slot: DeferredSlotSchema,
});

const SLOT_FAIL_LABEL: Record<DeferredTrainerBoardSlot, string> = {
  RESERVE: "Reserves",
  GRAVEYARD: "R.I.P.",
  ENCOUNTERED: "Encountered",
};

/**
 * Lazy Reserves / R.I.P. / Encountered for `/trainers/[id]` (#365 / #378).
 * SSR ships Main only; this loads when a collapsed section opens. Viewer
 * redaction + Survive/Die overlays stay outside `"use cache"`.
 */
export async function fetchTrainerBoardSlotAction(input: {
  slug: string;
  trainerId: string;
  slot: DeferredTrainerBoardSlot;
}): Promise<Ok | ActionFail> {
  const label = SLOT_FAIL_LABEL[input.slot] ?? "board section";
  try {
    const parsed = FetchTrainerBoardSlotSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid request" };
    }
    const { slug, trainerId, slot } = parsed.data;

    if (!isDatabaseConfigured()) {
      const seed = CHALLENGES.find((c) => c.slug === slug);
      const trainer = seed?.trainers.find((t) => t.id === trainerId);
      if (!trainer) return { ok: false, error: "Trainer not found" };
      return {
        ok: true,
        pokemon: trainer.pokemon.filter((p) => p.slot === slot),
      };
    }

    const rows = await fetchTrainerBoardSlotRow(slug, trainerId, slot);
    if (!rows) return { ok: false, error: "Season not found" };

    const meta = await getPrisma().trainerProfile.findFirst({
      where: { id: trainerId, challenge: { slug } },
      select: { userId: true, challengeId: true },
    });
    if (!meta) return { ok: false, error: "Trainer not found" };

    const access = await getAccessForChallenge(meta.challengeId);
    const gmLensOn =
      access?.isGm === true ? await readGmLensOn(slug) : false;
    const canSee = canViewCompetitiveDetails(
      access,
      meta.userId,
      gmLensOn,
    );

    let pokemon = rows.map((row) => {
      const mapped = mapPokemonRow(row);
      return canSee ? mapped : toPublicPokemonEntry(mapped);
    });

    // Survive/Die chips on living Main + Reserves — attach after cache (#366).
    if (slot === "RESERVE" || slot === "GRAVEYARD") {
      const session = await auth();
      const tallies = await loadSurvivalPollTallies(
        slug,
        pokemon.map((p) => p.id),
        session?.user?.id,
      );
      if (tallies.size > 0) {
        pokemon = pokemon.map((p) => ({
          ...p,
          survivalPoll: tallies.get(p.id) ?? null,
        }));
      }
    }

    return { ok: true, pokemon };
  } catch (error) {
    return failAction(
      `trainer-board-slot-${input.slot.toLowerCase()}`,
      error,
      `Could not load ${label}`,
    );
  }
}

/**
 * Lazy Encountered buffer for `/trainers/[id]` (#365).
 * @deprecated Prefer fetchTrainerBoardSlotAction({ slot: "ENCOUNTERED" }).
 */
export async function fetchTrainerEncounteredAction(input: {
  slug: string;
  trainerId: string;
}): Promise<Ok | ActionFail> {
  return fetchTrainerBoardSlotAction({ ...input, slot: "ENCOUNTERED" });
}
