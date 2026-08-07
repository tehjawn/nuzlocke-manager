"use server";

import { failAction } from "@/lib/action-error";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type { PokemonEntry } from "@/lib/challenge-types";
import { fetchTrainerEncounteredRow } from "@/lib/challenge-cache";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { toPublicPokemonEntry } from "@/lib/pokemon-privacy";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import { clampEvs, clampIvs, IvsSchema, parseStatSpread } from "@/lib/stats";

type ActionFail = { ok: false; error: string };
type Ok = { ok: true; pokemon: PokemonEntry[] };

function mapPokemonRow(
  p: {
    id: string;
    slot: PokemonEntry["slot"];
    partyIndex: number;
    nickname: string | null;
    species: string;
    pokedexId: number | null;
    isShiny: boolean;
    types: string[];
    nature?: string | null;
    level: number | null;
    ability?: string | null;
    catchRoute: string | null;
    heldItem?: string | null;
    moves?: string[];
    ivs?: unknown;
    evs?: unknown;
    friendship?: number | null;
    causeOfDeath: string | null;
    diedOnRun: number | null;
    runId: string | null;
  },
): PokemonEntry {
  return {
    id: p.id,
    slot: p.slot,
    partyIndex: p.partyIndex,
    nickname: p.nickname,
    species: p.species,
    pokedexId: p.pokedexId,
    isShiny: p.isShiny,
    types: resolvePokemonTypes({
      types: p.types,
      pokedexId: p.pokedexId,
      species: p.species,
    }),
    nature: p.nature ?? null,
    level: p.level,
    ability: p.ability ?? null,
    catchRoute: p.catchRoute,
    heldItem: p.heldItem ?? null,
    moves: p.moves ?? [],
    ivs: (() => {
      if (p.ivs == null) return null;
      const parsed = IvsSchema.safeParse(p.ivs);
      return clampIvs(
        parsed.success ? parsed.data : (parseStatSpread(p.ivs) ?? undefined),
      );
    })(),
    evs: p.evs != null ? clampEvs(parseStatSpread(p.evs) ?? undefined) : null,
    friendship:
      typeof p.friendship === "number" &&
      Number.isInteger(p.friendship) &&
      p.friendship >= 0 &&
      p.friendship <= 255
        ? p.friendship
        : null,
    causeOfDeath: p.causeOfDeath,
    diedOnRun: p.diedOnRun ?? null,
    runId: p.runId ?? null,
  };
}

/**
 * Lazy Encountered buffer for `/trainers/[id]` (#365). SSR ships Main /
 * Reserves / R.I.P. only; this loads when the collapsed section opens.
 */
export async function fetchTrainerEncounteredAction(input: {
  slug: string;
  trainerId: string;
}): Promise<Ok | ActionFail> {
  try {
    if (!isDatabaseConfigured()) {
      const seed = CHALLENGES.find((c) => c.slug === input.slug);
      const trainer = seed?.trainers.find((t) => t.id === input.trainerId);
      if (!trainer) return { ok: false, error: "Trainer not found" };
      return {
        ok: true,
        pokemon: trainer.pokemon.filter((p) => p.slot === "ENCOUNTERED"),
      };
    }

    const rows = await fetchTrainerEncounteredRow(input.slug, input.trainerId);
    if (!rows) return { ok: false, error: "Season not found" };

    const meta = await getPrisma().trainerProfile.findFirst({
      where: { id: input.trainerId, challenge: { slug: input.slug } },
      select: { userId: true, challengeId: true },
    });
    if (!meta) return { ok: false, error: "Trainer not found" };

    const access = await getAccessForChallenge(meta.challengeId);
    const gmLensOn =
      access?.isGm === true ? await readGmLensOn(input.slug) : false;
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
