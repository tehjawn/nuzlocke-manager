import type {
  MatchSideSnapshot,
  SquadPokemonSnapshot,
} from "@/lib/challenge-types";

type SnapshotPokemonRow = {
  species: string;
  nickname: string | null;
  pokedexId: number | null;
  level: number | null;
  isShiny: boolean;
  types: string[];
  partyIndex: number;
};

/** Capture a trainer's live MAIN squad into a match-side snapshot. */
export function buildMatchSideSnapshot(input: {
  trainerId: string;
  handle: string;
  pokemon: SnapshotPokemonRow[];
  capturedAt?: Date;
}): MatchSideSnapshot {
  const pokemon: SquadPokemonSnapshot[] = [...input.pokemon]
    .sort((a, b) => a.partyIndex - b.partyIndex)
    .map((p) => ({
      species: p.species,
      nickname: p.nickname,
      pokedexId: p.pokedexId,
      level: p.level,
      isShiny: p.isShiny,
      types: p.types,
      partyIndex: p.partyIndex,
    }));

  return {
    trainerId: input.trainerId,
    handle: input.handle,
    pokemon,
    capturedAt: (input.capturedAt ?? new Date()).toISOString(),
  };
}

/** Best-effort parse of stored JSON into a MatchSideSnapshot. */
export function parseMatchSideSnapshot(value: unknown): MatchSideSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.trainerId !== "string" || typeof raw.handle !== "string") {
    return null;
  }
  const pokemonRaw = Array.isArray(raw.pokemon) ? raw.pokemon : [];
  const pokemon: SquadPokemonSnapshot[] = [];
  for (const row of pokemonRaw) {
    if (!row || typeof row !== "object") continue;
    const p = row as Record<string, unknown>;
    if (typeof p.species !== "string") continue;
    pokemon.push({
      species: p.species,
      nickname: typeof p.nickname === "string" ? p.nickname : null,
      pokedexId: typeof p.pokedexId === "number" ? p.pokedexId : null,
      level: typeof p.level === "number" ? p.level : null,
      isShiny: Boolean(p.isShiny),
      types: Array.isArray(p.types)
        ? p.types.filter((t): t is string => typeof t === "string")
        : [],
      partyIndex: typeof p.partyIndex === "number" ? p.partyIndex : 0,
    });
  }
  return {
    trainerId: raw.trainerId,
    handle: raw.handle,
    pokemon,
    capturedAt:
      typeof raw.capturedAt === "string"
        ? raw.capturedAt
        : new Date(0).toISOString(),
  };
}

/**
 * Minimal Poképaste → display lines.
 * Keeps the raw paste stored; this is only for a quick readable preview.
 */
export function parsePokepastePreview(paste: string): {
  species: string;
  nickname: string | null;
  item: string | null;
}[] {
  const blocks = paste
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: { species: string; nickname: string | null; item: string | null }[] =
    [];

  for (const block of blocks) {
    const firstLine = block.split("\n")[0]?.trim();
    if (!firstLine) continue;

    // "Nick (Species) @ Item" | "Species @ Item" | "Species"
    let nickname: string | null = null;
    let species = firstLine;
    let item: string | null = null;

    const atIdx = firstLine.lastIndexOf(" @ ");
    if (atIdx >= 0) {
      species = firstLine.slice(0, atIdx).trim();
      item = firstLine.slice(atIdx + 3).trim() || null;
    }

    const nickMatch = species.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (nickMatch) {
      nickname = nickMatch[1].trim();
      species = nickMatch[2].trim();
    }

    if (!species) continue;
    out.push({ species, nickname, item });
  }

  return out;
}
