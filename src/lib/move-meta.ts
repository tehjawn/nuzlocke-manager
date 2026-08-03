import moveMetaData from "@/data/move-meta.json";
import { TYPE_COLORS } from "@/lib/pokemon-types";
import { resolveMoveName } from "@/lib/move-names";
import { TYPES, type PokemonType } from "@/lib/type-chart";

export type MoveCategory = "Physical" | "Special" | "Status";

export type MoveMeta = {
  category: MoveCategory;
  description: string;
  name: string;
  power: number;
  type: PokemonType;
};

type RawMoveMeta = {
  category: string;
  description: string;
  name: string;
  power: number;
  type: string;
};

const byKey: Record<string, RawMoveMeta> = moveMetaData.byKey;

const TYPE_SET = new Set<string>(TYPES);

function isPokemonType(type: string): type is PokemonType {
  return TYPE_SET.has(type);
}

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
  if (!isPokemonType(raw.type)) return null;
  if (
    raw.category !== "Physical" &&
    raw.category !== "Special" &&
    raw.category !== "Status"
  ) {
    return null;
  }
  return {
    category: raw.category,
    description: raw.description,
    name: resolved || raw.name,
    power: raw.power,
    type: raw.type,
  };
}

/** Beginner tip for a move chip with battle metadata and effect text. */
export function formatMoveMetaTip(meta: MoveMeta): string {
  const details =
    meta.category === "Status" || meta.power <= 0
      ? `${meta.type} · ${meta.category}`
      : `${meta.type} · ${meta.category} · ${meta.power} power`;

  return meta.description ? `${details} — ${meta.description}` : details;
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
  const color = TYPE_COLORS[meta.type];
  if (!color) return undefined;
  const typeWash = `color-mix(in srgb, ${color} 16%, var(--info))`;
  return {
    backgroundImage: `linear-gradient(135deg, var(--info) 0%, ${typeWash} 100%)`,
    borderColor: `color-mix(in srgb, ${color} 19%, var(--frame))`,
  };
}
