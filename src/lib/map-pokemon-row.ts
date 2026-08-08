import type { PokemonEntry } from "@/lib/challenge-types";
import { dbBigIntToU32 } from "@/lib/gen3-save";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import { clampEvs, clampIvs, IvsSchema, parseStatSpread } from "@/lib/stats";

/** Prisma / cache row → `PokemonEntry` (shared by Tools + trainer hydrate actions). */
export function mapPokemonRow(p: {
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
  personalityValue?: bigint | number | null;
  otId?: bigint | number | null;
  notes?: string | null;
}): PokemonEntry {
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
    personalityValue: dbBigIntToU32(p.personalityValue),
    otId: dbBigIntToU32(p.otId),
    causeOfDeath: p.causeOfDeath,
    notes: p.notes ?? null,
    diedOnRun: p.diedOnRun ?? null,
    runId: p.runId ?? null,
  };
}
