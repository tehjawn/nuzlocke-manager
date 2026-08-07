"use server";

import { failAction } from "@/lib/action-error";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  pokemonToolsGradeSelect,
  pokemonToolsMovesSelect,
  pokemonToolsSelect,
} from "@/lib/challenge-queries";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { mapPokemonRow } from "@/lib/map-pokemon-row";
import { getAccessForChallenge } from "@/lib/permissions";
import { toPublicPokemonEntry } from "@/lib/pokemon-privacy";
import type {
  ToolsHydrateKind,
  ToolsHydratePayload,
} from "@/lib/tools-pokemon-hydrate";

type ActionFail = { ok: false; error: string };
type HydrateOk = { ok: true } & ToolsHydratePayload;
type EntryOk = {
  ok: true;
  pokemon: PokemonEntry;
  showCompetitiveDetails: boolean;
};

function selectForKind(kind: ToolsHydrateKind) {
  switch (kind) {
    case "competitive":
      return pokemonToolsSelect;
    case "moves":
      return pokemonToolsMovesSelect;
    default:
      return pokemonToolsGradeSelect;
  }
}

/**
 * Deferred Tools columns (#367). `grades` stamps public catch/bond tiers;
 * `moves` adds move lists for entitled trainers (+ stamps); `competitive`
 * returns full spreads for entitled trainers.
 */
export async function fetchToolsPokemonHydrateAction(input: {
  slug: string;
  kind: ToolsHydrateKind;
  /** Optional trainer id filter (e.g. viewer-only moves for Pokédex tips). */
  trainerIds?: string[];
}): Promise<HydrateOk | ActionFail> {
  try {
    if (!isDatabaseConfigured()) {
      return { ok: false, error: "Database is not configured" };
    }
    const kind = input.kind;
    if (kind !== "grades" && kind !== "moves" && kind !== "competitive") {
      return { ok: false, error: "Invalid hydrate kind" };
    }

    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { slug: input.slug },
      select: {
        id: true,
        slug: true,
        trainers: {
          where:
            input.trainerIds && input.trainerIds.length > 0
              ? { id: { in: input.trainerIds } }
              : undefined,
          select: {
            id: true,
            userId: true,
            pokemon: {
              select: selectForKind(kind),
              orderBy: [
                { slot: "asc" as const },
                { partyIndex: "asc" as const },
              ],
            },
          },
        },
      },
    });
    if (!challenge) return { ok: false, error: "Season not found" };

    const access = await getAccessForChallenge(challenge.id);
    const gmLensOn =
      access?.isGm === true ? await readGmLensOn(challenge.slug) : false;

    const competitiveTrainerIds: string[] = [];
    const trainers = challenge.trainers.map((trainer) => {
      const canSee = canViewCompetitiveDetails(
        access,
        trainer.userId,
        gmLensOn,
      );
      const pokemon = trainer.pokemon.map((row) => {
        const mapped = mapPokemonRow(row);
        if (kind === "grades") {
          return toPublicPokemonEntry(mapped);
        }
        if (kind === "moves") {
          if (canSee) {
            // Keep moves for tips / coverage; still stamp grades and drop spreads.
            const stamped = toPublicPokemonEntry(mapped);
            return { ...stamped, moves: mapped.moves };
          }
          return toPublicPokemonEntry(mapped);
        }
        if (canSee) return mapped;
        return toPublicPokemonEntry(mapped);
      });

      if (kind === "competitive" && canSee) {
        competitiveTrainerIds.push(trainer.id);
      }

      return { id: trainer.id, pokemon };
    });

    return { ok: true, trainers, competitiveTrainerIds };
  } catch (error) {
    return failAction("tools-pokemon-hydrate", error, "Could not load Pokémon details");
  }
}

/**
 * Ownership Showcase details — fetch one specimen with competitive columns
 * when the viewer is entitled; otherwise return the stamped public projection.
 */
export async function fetchToolsPokemonEntryAction(input: {
  slug: string;
  pokemonId: string;
}): Promise<EntryOk | ActionFail> {
  try {
    if (!isDatabaseConfigured()) {
      return { ok: false, error: "Database is not configured" };
    }

    const prisma = getPrisma();
    const row = await prisma.pokemonEntry.findFirst({
      where: {
        id: input.pokemonId,
        trainer: { challenge: { slug: input.slug } },
      },
      select: {
        ...pokemonToolsSelect,
        trainer: { select: { id: true, userId: true, challengeId: true } },
      },
    });
    if (!row) return { ok: false, error: "Pokémon not found" };

    const access = await getAccessForChallenge(row.trainer.challengeId);
    const challenge = await prisma.challenge.findUnique({
      where: { id: row.trainer.challengeId },
      select: { slug: true },
    });
    const gmLensOn =
      access?.isGm === true && challenge
        ? await readGmLensOn(challenge.slug)
        : false;
    const showCompetitiveDetails = canViewCompetitiveDetails(
      access,
      row.trainer.userId,
      gmLensOn,
    );

    const mapped = mapPokemonRow({
      id: row.id,
      slot: row.slot,
      partyIndex: row.partyIndex,
      nickname: row.nickname,
      species: row.species,
      pokedexId: row.pokedexId,
      isShiny: row.isShiny,
      types: row.types,
      nature: row.nature,
      level: row.level,
      ability: row.ability,
      catchRoute: row.catchRoute,
      heldItem: row.heldItem,
      moves: row.moves,
      ivs: row.ivs,
      evs: row.evs,
      friendship: row.friendship,
      causeOfDeath: row.causeOfDeath,
      diedOnRun: row.diedOnRun,
      runId: row.runId,
    });
    return {
      ok: true,
      pokemon: showCompetitiveDetails
        ? mapped
        : toPublicPokemonEntry(mapped),
      showCompetitiveDetails,
    };
  } catch (error) {
    return failAction("tools-pokemon-entry", error, "Could not load Pokémon details");
  }
}
