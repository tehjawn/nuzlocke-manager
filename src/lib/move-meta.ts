import moveMetaData from "@/data/move-meta.json";
import { TYPES, type PokemonType } from "@/lib/type-chart";
import { resolveMoveName } from "@/lib/move-names";

export type MoveCategory = "Physical" | "Special" | "Status";

export type MoveMeta = {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number;
};

type RawMoveMeta = {
  name: string;
  type: string;
  category: string;
  power: number;
};

const byKey = (moveMetaData as { byKey: Record<string, RawMoveMeta> }).byKey;

const TYPE_SET = new Set<string>(TYPES);

/** Normalize move labels so "U Turn" / "U-turn" / "u-turn" share a key. */
export function normalizeMoveKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function lookupMoveMeta(move: string): MoveMeta | null {
  const resolved = resolveMoveName(move);
  const key = normalizeMoveKey(resolved);
  if (!key) return null;
  const raw = byKey[key];
  if (!raw) return null;
  if (!TYPE_SET.has(raw.type)) return null;
  if (
    raw.category !== "Physical" &&
    raw.category !== "Special" &&
    raw.category !== "Status"
  ) {
    return null;
  }
  return {
    name: resolved || raw.name,
    type: raw.type as PokemonType,
    category: raw.category,
    power: raw.power,
  };
}
