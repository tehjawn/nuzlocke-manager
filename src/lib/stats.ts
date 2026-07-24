import { z } from "zod";

export const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type StatSpread = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

export const EMPTY_IVS: StatSpread = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
};

export const EMPTY_EVS: StatSpread = { ...EMPTY_IVS };

export const StatSpreadSchema = z.object({
  hp: z.number().int().min(0).max(255),
  atk: z.number().int().min(0).max(255),
  def: z.number().int().min(0).max(255),
  spa: z.number().int().min(0).max(255),
  spd: z.number().int().min(0).max(255),
  spe: z.number().int().min(0).max(255),
});

export const IvsSchema = z.object({
  hp: z.number().int().min(0).max(31),
  atk: z.number().int().min(0).max(31),
  def: z.number().int().min(0).max(31),
  spa: z.number().int().min(0).max(31),
  spd: z.number().int().min(0).max(31),
  spe: z.number().int().min(0).max(31),
});

export function clampIvs(raw: Partial<StatSpread> | null | undefined): StatSpread {
  const src = raw ?? EMPTY_IVS;
  const out = { ...EMPTY_IVS };
  for (const key of STAT_KEYS) {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) ? Math.min(31, Math.max(0, Math.trunc(n))) : 0;
  }
  return out;
}

export function clampEvs(raw: Partial<StatSpread> | null | undefined): StatSpread {
  const src = raw ?? EMPTY_EVS;
  const out = { ...EMPTY_EVS };
  for (const key of STAT_KEYS) {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) ? Math.min(255, Math.max(0, Math.trunc(n))) : 0;
  }
  return out;
}

export function parseStatSpread(value: unknown): StatSpread | null {
  if (!value || typeof value !== "object") return null;
  const parsed = StatSpreadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isEmptySpread(spread: StatSpread | null | undefined): boolean {
  if (!spread) return true;
  return STAT_KEYS.every((k) => spread[k] === 0);
}

export function formatSpreadShort(spread: StatSpread | null | undefined): string {
  if (!spread || isEmptySpread(spread)) return "";
  return STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${spread[k]}`).join(" · ");
}
