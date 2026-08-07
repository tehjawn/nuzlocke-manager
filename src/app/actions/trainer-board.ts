"use server";

import { z } from "zod";
import { failAction } from "@/lib/action-error";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type { PokemonEntry } from "@/lib/challenge-types";
import { fetchTrainerEncounteredRow } from "@/lib/challenge-cache";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { mapPokemonRow } from "@/lib/map-pokemon-row";
import { getAccessForChallenge } from "@/lib/permissions";
import { toPublicPokemonEntry } from "@/lib/pokemon-privacy";

type ActionFail = { ok: false; error: string };
type Ok = { ok: true; pokemon: PokemonEntry[] };

const FetchTrainerEncounteredSchema = z.object({
  slug: z.string().min(1).max(64),
  trainerId: z.string().min(1).max(64),
});

/**
 * Lazy Encountered buffer for `/trainers/[id]` (#365). SSR ships Main /
 * Reserves / R.I.P. only; this loads when the collapsed section opens.
 */
export async function fetchTrainerEncounteredAction(input: {
  slug: string;
  trainerId: string;
}): Promise<Ok | ActionFail> {
  try {
    const parsed = FetchTrainerEncounteredSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid request" };
    }
    const { slug, trainerId } = parsed.data;

    if (!isDatabaseConfigured()) {
      const seed = CHALLENGES.find((c) => c.slug === slug);
      const trainer = seed?.trainers.find((t) => t.id === trainerId);
      if (!trainer) return { ok: false, error: "Trainer not found" };
      return {
        ok: true,
        pokemon: trainer.pokemon.filter((p) => p.slot === "ENCOUNTERED"),
      };
    }

    const rows = await fetchTrainerEncounteredRow(slug, trainerId);
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

    const pokemon = rows.map((row) => {
      const mapped = mapPokemonRow(row);
      return canSee ? mapped : toPublicPokemonEntry(mapped);
    });

    return { ok: true, pokemon };
  } catch (error) {
    return failAction(
      "trainer-encountered",
      error,
      "Could not load Encountered",
    );
  }
}
