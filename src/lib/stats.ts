import { z } from "zod";
import baseStatsData from "@/data/base-stats.json";

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

const SPECIES_BASE_STATS = baseStatsData.stats as Record<string, StatSpread>;

type BattleStatKey = Exclude<StatKey, "hp">;

/** Nature → raised / lowered attack stats (neutral natures omitted). */
export type NatureStatMod = { up: BattleStatKey; down: BattleStatKey };

const NATURE_MODS: Record<string, NatureStatMod> = {
  Lonely: { up: "atk", down: "def" },
  Brave: { up: "atk", down: "spe" },
  Adamant: { up: "atk", down: "spa" },
  Naughty: { up: "atk", down: "spd" },
  Bold: { up: "def", down: "atk" },
  Relaxed: { up: "def", down: "spe" },
  Impish: { up: "def", down: "spa" },
  Lax: { up: "def", down: "spd" },
  Timid: { up: "spe", down: "atk" },
  Hasty: { up: "spe", down: "def" },
  Jolly: { up: "spe", down: "spa" },
  Naive: { up: "spe", down: "spd" },
  Modest: { up: "spa", down: "atk" },
  Mild: { up: "spa", down: "def" },
  Quiet: { up: "spa", down: "spe" },
  Rash: { up: "spa", down: "spd" },
  Calm: { up: "spd", down: "atk" },
  Gentle: { up: "spd", down: "def" },
  Sassy: { up: "spd", down: "spe" },
  Careful: { up: "spd", down: "spa" },
};

const NATURE_MODS_LOOKUP: Record<string, NatureStatMod> = Object.fromEntries(
  Object.entries(NATURE_MODS).flatMap(([name, mod]) => [
    [name, mod],
    [name.toLowerCase(), mod],
  ]),
);

const STAT_FULL_LABELS: Record<BattleStatKey, string> = {
  atk: "Attack",
  def: "Defense",
  spa: "Special Attack",
  spd: "Special Defense",
  spe: "Speed",
};

/**
 * Raised / lowered battle stats for a nature, or null when neutral / unknown.
 */
export function natureStatMod(
  nature: string | null | undefined,
): NatureStatMod | null {
  if (!nature?.trim()) return null;
  return (
    NATURE_MODS_LOOKUP[nature] ??
    NATURE_MODS_LOOKUP[nature.toLowerCase()] ??
    null
  );
}

/** Human-readable nature effect (Bulbapedia-style). */
export function natureEffectDescription(
  nature: string | null | undefined,
): string {
  const mod = natureStatMod(nature);
  if (!mod) return "Does not modify stats.";
  return `Increases a Pokémon's ${STAT_FULL_LABELS[mod.up]} stat by 10% and decreases its ${STAT_FULL_LABELS[mod.down]} stat by 10%.`;
}

export function baseStatsForSpecies(
  pokedexId: number | null | undefined,
): StatSpread | null {
  if (pokedexId == null || pokedexId <= 0) return null;
  return SPECIES_BASE_STATS[String(pokedexId)] ?? null;
}

/** Base stat total — the sum of all six stats in a spread. */
export function bstOf(spread: StatSpread): number {
  return STAT_KEYS.reduce((sum, key) => sum + spread[key], 0);
}

function natureMultiplier(
  nature: string | null | undefined,
  key: StatKey,
): number {
  if (!nature || key === "hp") return 1;
  const mod = natureStatMod(nature);
  if (!mod) return 1;
  if (mod.up === key) return 1.1;
  if (mod.down === key) return 0.9;
  return 1;
}

/**
 * Gen 3+ battle stats from base / IV / EV / level / nature.
 * Returns null when level, IVs, or species base stats are missing — avoids
 * implying 0 IVs for manually logged Pokémon that never recorded them.
 */
export function calcBattleStats(input: {
  pokedexId: number | null | undefined;
  level: number | null | undefined;
  ivs?: StatSpread | null;
  evs?: StatSpread | null;
  nature?: string | null;
}): StatSpread | null {
  const base = baseStatsForSpecies(input.pokedexId);
  const level = input.level;
  if (!base || level == null || level < 1 || level > 100) return null;
  if (input.ivs == null) return null;

  const ivs = input.ivs;
  const evs = input.evs ?? EMPTY_EVS;
  const out = { ...EMPTY_IVS };

  for (const key of STAT_KEYS) {
    const iv = ivs[key] ?? 0;
    const ev = evs[key] ?? 0;
    if (key === "hp") {
      // Shedinja (base 1) always has 1 HP.
      out.hp =
        base.hp === 1
          ? 1
          : Math.floor(((2 * base.hp + iv + Math.floor(ev / 4)) * level) / 100) +
            level +
            10;
    } else {
      const raw =
        Math.floor(((2 * base[key] + iv + Math.floor(ev / 4)) * level) / 100) + 5;
      out[key] = Math.floor(raw * natureMultiplier(input.nature, key));
    }
  }
  return out;
}

const PERFECT_IVS: StatSpread = {
  hp: 31,
  atk: 31,
  def: 31,
  spa: 31,
  spd: 31,
  spe: 31,
};

/** Nature that maximizes each non-HP battle stat (used for per-stat ceilings). */
const MAX_STAT_NATURE: Record<Exclude<StatKey, "hp">, string> = {
  atk: "Adamant",
  def: "Bold",
  spa: "Modest",
  spd: "Calm",
  spe: "Jolly",
};

/**
 * Theoretical max battle stat for each key at the given level: 31 IV, 252 EV
 * in that stat, and a boosting nature (HP has no nature). Other EVs are 0 —
 * they do not affect that stat's formula.
 */
export function calcMaxBattleStats(input: {
  pokedexId: number | null | undefined;
  level: number | null | undefined;
}): StatSpread | null {
  const base = baseStatsForSpecies(input.pokedexId);
  const level = input.level;
  if (!base || level == null || level < 1 || level > 100) return null;

  const out = { ...EMPTY_IVS };
  for (const key of STAT_KEYS) {
    const evs = { ...EMPTY_EVS, [key]: 252 };
    const nature = key === "hp" ? null : MAX_STAT_NATURE[key];
    const single = calcBattleStats({
      pokedexId: input.pokedexId,
      level,
      ivs: PERFECT_IVS,
      evs,
      nature,
    });
    if (!single) return null;
    out[key] = single[key];
  }
  return out;
}

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

/** Compact battle-stat line for card previews (e.g. "HP 22 · Atk 12 · …"). */
export function formatBattleStatsShort(
  spread: StatSpread | null | undefined,
): string {
  if (!spread) return "";
  return STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${spread[k]}`).join(" · ");
}
