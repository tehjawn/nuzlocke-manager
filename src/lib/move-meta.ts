import moveMetaData from "@/data/move-meta.json";
import { TYPE_COLORS, type PokemonType as IndexedType } from "@/lib/pokemon-types";
import { resolveMoveName } from "@/lib/move-names";
import { TYPES, type PokemonType } from "@/lib/type-chart";

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

/**
 * Beginner tip for a move chip — type, category, and power when relevant.
 * No effect text (that needs a richer catalog later).
 */
export function formatMoveMetaTip(meta: MoveMeta): string {
  if (meta.category === "Status" || meta.power <= 0) {
    return `${meta.type} · ${meta.category}`;
  }
  return `${meta.type} · ${meta.category} · ${meta.power} power`;
}

/**
 * Subtle type gradient for compact board/dashboard move chips:
 * original chip bg → light type wash.
 * Returns undefined when the move type is unknown (caller keeps default bg).
 */
export function moveTypeWashStyle(
  move: string,
): { backgroundImage: string; borderColor: string } | undefined {
  const meta = lookupMoveMeta(move);
  if (!meta) return undefined;
  const color = TYPE_COLORS[meta.type as IndexedType];
  if (!color) return undefined;
  const typeWash = `color-mix(in srgb, ${color} 16%, var(--info))`;
  return {
    backgroundImage: `linear-gradient(135deg, var(--info) 0%, ${typeWash} 100%)`,
    borderColor: `color-mix(in srgb, ${color} 19%, var(--frame))`,
  };
}
