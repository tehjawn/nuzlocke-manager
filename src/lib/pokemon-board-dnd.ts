import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";

/** Sections that support drag-and-drop on the trainer board. */
export const DND_SLOTS = ["MAIN", "RESERVE", "GRAVEYARD"] as const;
export type DndSlot = (typeof DND_SLOTS)[number];

export const MAIN_PARTY_SIZE = 6;

export type BoardItems = Record<DndSlot, string[]>;

export function isDndSlot(slot: string): slot is DndSlot {
  return (DND_SLOTS as readonly string[]).includes(slot);
}

export function emptyMainId(partyIndex: number): string {
  return `empty:MAIN:${partyIndex}`;
}

export function isEmptyMainId(id: string): boolean {
  return id.startsWith("empty:MAIN:");
}

export function parseEmptyMainIndex(id: string): number | null {
  if (!isEmptyMainId(id)) return null;
  const n = Number(id.slice("empty:MAIN:".length));
  return Number.isInteger(n) && n >= 0 && n < MAIN_PARTY_SIZE ? n : null;
}

/** Build sortable item id lists for Main (fixed 6) / Reserves / R.I.P. */
export function buildBoardItems(pokemon: PokemonEntry[]): BoardItems {
  const bySlot = (slot: PokemonSlot) =>
    pokemon
      .filter((p) => p.slot === slot)
      .sort((a, b) => a.partyIndex - b.partyIndex);

  const mainSorted = bySlot("MAIN");
  const main = Array.from({ length: MAIN_PARTY_SIZE }, (_, i) => {
    const mon = mainSorted.find((p) => p.partyIndex === i);
    return mon?.id ?? emptyMainId(i);
  });

  return {
    MAIN: main,
    RESERVE: bySlot("RESERVE").map((p) => p.id),
    GRAVEYARD: bySlot("GRAVEYARD").map((p) => p.id),
  };
}

export function findBoardContainer(
  items: BoardItems,
  id: string,
): DndSlot | undefined {
  if (isDndSlot(id)) return id;
  return DND_SLOTS.find((slot) => items[slot].includes(id));
}

/**
 * Apply slot + partyIndex from board item lists onto pokemon entries.
 * Encountered (and any other non-DnD) entries are left unchanged.
 */
export function applyBoardItemsToPokemon(
  pokemon: PokemonEntry[],
  items: BoardItems,
): PokemonEntry[] {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const next = pokemon.map((p) => ({ ...p }));

  for (const slot of DND_SLOTS) {
    items[slot].forEach((id, partyIndex) => {
      if (isEmptyMainId(id)) return;
      if (!byId.has(id)) return;
      const idx = next.findIndex((p) => p.id === id);
      if (idx >= 0) {
        next[idx] = { ...next[idx], slot, partyIndex };
      }
    });
  }

  return next;
}

/** Diff of id → { slot, partyIndex } for entries that changed. */
export function boardItemUpdates(
  before: PokemonEntry[],
  after: PokemonEntry[],
): Array<{ id: string; slot: PokemonSlot; partyIndex: number }> {
  const prev = new Map(before.map((p) => [p.id, p]));
  const updates: Array<{ id: string; slot: PokemonSlot; partyIndex: number }> =
    [];
  for (const mon of after) {
    const was = prev.get(mon.id);
    if (!was) continue;
    if (was.slot !== mon.slot || was.partyIndex !== mon.partyIndex) {
      updates.push({
        id: mon.id,
        slot: mon.slot,
        partyIndex: mon.partyIndex,
      });
    }
  }
  return updates;
}
