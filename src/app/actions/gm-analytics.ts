"use server";

import { failAction } from "@/lib/action-error";
import { pokemonToolsMovesSelect } from "@/lib/challenge-queries";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  buildGmAnalyticsReport,
  type GmAnalyticsReport,
} from "@/lib/gm-analytics";
import { mapPokemonRow } from "@/lib/map-pokemon-row";
import { requireGm } from "@/lib/permissions";

type ActionFail = { ok: false; error: string; code?: string };
type ActionOk = { ok: true; report: GmAnalyticsReport };

/**
 * Lazy Main-squad pack analytics for the GM console (#404).
 * Does not load RESERVE / ENCOUNTERED / GRAVEYARD — keeps other GM tabs cheap (#365).
 */
export async function fetchGmAnalyticsAction(input: {
  slug: string;
}): Promise<ActionOk | ActionFail> {
  try {
    if (!isDatabaseConfigured()) {
      return { ok: false, error: "Database is not configured" };
    }

    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { slug: input.slug },
      select: {
        id: true,
        trainers: {
          where: { userId: { not: null } },
          select: {
            id: true,
            handle: true,
            sortOrder: true,
            pokemon: {
              where: { slot: "MAIN" },
              select: pokemonToolsMovesSelect,
              orderBy: { partyIndex: "asc" as const },
            },
          },
          orderBy: { sortOrder: "asc" as const },
        },
      },
    });
    if (!challenge) return { ok: false, error: "Season not found" };

    await requireGm(challenge.id);

    const mains = challenge.trainers.map((trainer) => ({
      trainerId: trainer.id,
      handle: trainer.handle,
      pokemon: trainer.pokemon.map((row) => mapPokemonRow(row)),
    }));

    const report = buildGmAnalyticsReport(mains, {
      claimedTrainerCount: challenge.trainers.length,
    });

    return { ok: true, report };
  } catch (e) {
    return failAction("fetchGmAnalyticsAction", e, "Could not load analytics");
  }
}
