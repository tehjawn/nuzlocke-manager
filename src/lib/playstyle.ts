import {
  baseStatsForSpecies,
  natureStatMod,
  STAT_KEYS,
  type StatKey,
  type StatSpread,
} from "@/lib/stats";
import { classifyIv, type CatchArchetype } from "@/lib/iv-quality";

/** Closed vocabulary — beginner-friendly, not Smogon jargon. */
export const PLAYSTYLE_TAGS = [
  "Physical attacker",
  "Special attacker",
  "Mixed attacker",
  "Bulky",
  "Physical wall",
  "Special wall",
  "Fast",
  "Glass cannon",
  "Slow",
  "Balanced",
] as const;

export type PlaystyleTag = (typeof PLAYSTYLE_TAGS)[number];

export type NatureAlignment = "helps" | "fights" | "neutral";

export type PlaystyleHint = {
  primary: PlaystyleTag;
  secondary: PlaystyleTag | null;
  tip: string;
  natureAlignment: NatureAlignment;
  natureAlignmentLabel: string;
};

/** High-signal abilities only — optional flavor nudge, never replaces shape. */
const ABILITY_NUDGES: Record<string, string> = {
  intimidate: "Intimidate leans support / pivot.",
  "huge power": "Huge Power leans hard into physical damage.",
  "pure power": "Pure Power leans hard into physical damage.",
  "speed boost": "Speed Boost favors setup sweeping.",
  "swift swim": "Swift Swim can turn rain into Speed control.",
  chlorophyll: "Chlorophyll can turn sun into Speed control.",
  "natural cure": "Natural Cure favors staying in and absorbing status.",
  regenerator: "Regenerator favors pivoting in and out.",
  "magic guard": "Magic Guard shrugs off residual damage.",
  "wonder guard": "Wonder Guard is fragile but only takes super-effective hits.",
};

/**
 * Static key-stat map per playstyle tag.
 *
 * Glass cannon is a shape tag — resolve it through {@link keysForPlaystyleTag}
 * so physical vs special glass don't share the unused offense axis.
 */
export const TAG_KEY_STATS: Record<PlaystyleTag, StatKey[]> = {
  "Physical attacker": ["atk"],
  "Special attacker": ["spa"],
  "Mixed attacker": ["atk", "spa"],
  Bulky: ["hp", "def", "spd"],
  "Physical wall": ["def", "hp"],
  "Special wall": ["spd", "hp"],
  Fast: ["spe"],
  /** Fallback only — prefer {@link keysForPlaystyleTag} with base stats. */
  "Glass cannon": ["atk", "spa", "spe"],
  Slow: ["hp", "def", "spd"],
  Balanced: [],
};

const ATTACKER_TAGS: ReadonlySet<PlaystyleTag> = new Set([
  "Physical attacker",
  "Special attacker",
  "Mixed attacker",
]);

/** Relative atk/spa gap that counts as a clear physical vs special bias. */
const OFFENSE_BIAS_GAP = 0.12;

/**
 * Glass cannon keys lean into the leading offense + Speed.
 * Mixed (near-even Atk/SpA) keeps both offenses.
 */
export function glassCannonKeys(base: StatSpread): StatKey[] {
  const mean = meanOf(base);
  const atk = rel(base, "atk", mean);
  const spa = rel(base, "spa", mean);
  if (atk - spa >= OFFENSE_BIAS_GAP) return ["atk", "spe"];
  if (spa - atk >= OFFENSE_BIAS_GAP) return ["spa", "spe"];
  return ["atk", "spa", "spe"];
}

/** Role axes for a playstyle tag, specialized when base stats are known. */
export function keysForPlaystyleTag(
  tag: PlaystyleTag,
  base?: StatSpread | null,
): StatKey[] {
  if (tag === "Glass cannon" && base) return glassCannonKeys(base);
  return [...TAG_KEY_STATS[tag]];
}

export type SpeciesKeyStats = {
  /** Primary playstyle axes — historically hard-gated catch tiers. */
  primary: StatKey[];
  /** Secondary axes — help scoring context without vetoing top tiers. */
  secondary: StatKey[];
};

/**
 * Ensure catch-tier "2 role hits" is reachable.
 *
 * Single-axis attackers pick a soft secondary from species shape:
 * - Physical: Def when the mon is physically bulky/slow, else Spe
 * - Special: SpD when specially bulky/slow, else Spe
 * Lone Fast picks up the leading offense.
 */
function ensureRoleBreadth(
  primary: StatKey[],
  secondary: StatKey[],
  base: StatSpread,
): SpeciesKeyStats {
  const role = new Set<StatKey>([...primary, ...secondary]);
  if (role.size >= 2 || primary.length === 0) {
    return { primary, secondary };
  }

  const nextSecondary = [...secondary];
  const add = (key: StatKey) => {
    if (!role.has(key) && !primary.includes(key)) {
      nextSecondary.push(key);
      role.add(key);
    }
  };

  if (primary.includes("atk") && !primary.includes("spa")) {
    // Slow tanks (Graveler) want Def; fast attackers want Spe.
    add(base.def >= base.spe ? "def" : "spe");
  } else if (primary.includes("spa") && !primary.includes("atk")) {
    add(base.spd >= base.spe ? "spd" : "spe");
  } else if (primary.includes("atk") || primary.includes("spa")) {
    // Mixed: Spe is the usual second axis.
    add("spe");
  } else if (primary.includes("spe")) {
    const mean = meanOf(base);
    add(rel(base, "atk", mean) >= rel(base, "spa", mean) ? "atk" : "spa");
  }

  return { primary, secondary: nextSecondary };
}

/**
 * Role-critical IV axes for a species, from base-stat playstyle shape.
 *
 * - `primary` empty + `secondary` empty: Balanced — every IV equal.
 * - `null`: unknown species (no base stats) — caller keeps a legacy fallback.
 *
 * Prefer {@link catchArchetypeForSpecies} for catch-tier scoring (#356).
 * Only the **primary** tag’s stats are hard gates when using key lists.
 * Special glass uses SpA + Spe (not Attack); physical glass uses Atk + Spe.
 */
export function keyStatsForSpecies(
  pokedexId: number | null | undefined,
): SpeciesKeyStats | null {
  const base = baseStatsForSpecies(pokedexId);
  if (!base) return null;

  const { primary, secondary } = pickTags(scoreShape(base));
  const primaryKeys = keysForPlaystyleTag(primary, base);
  // Balanced has no primary axes — keep secondary empty to match the contract.
  if (primaryKeys.length === 0) {
    return { primary: [], secondary: [] };
  }
  const primarySet = new Set(primaryKeys);
  const secondaryKeys: StatKey[] = [];
  if (secondary) {
    for (const k of keysForPlaystyleTag(secondary, base)) {
      if (!primarySet.has(k)) secondaryKeys.push(k);
    }
  }
  return ensureRoleBreadth(primaryKeys, secondaryKeys, base);
}

/**
 * Catch-scoring archetype for a species (#356).
 *
 * Uses {@link recommendPlaystyle} primary tag, except Glass cannon (primary or
 * secondary) takes the glass weight table — phys/spec/mixed via
 * {@link glassCannonKeys}. Returns null when base stats are unknown.
 */
export function catchArchetypeForSpecies(
  pokedexId: number | null | undefined,
): CatchArchetype | null {
  const base = baseStatsForSpecies(pokedexId);
  if (!base) return null;

  const { primary, secondary } = pickTags(scoreShape(base));
  const useGlass =
    primary === "Glass cannon" || secondary === "Glass cannon";

  if (useGlass) {
    const keys = glassCannonKeys(base);
    const hasAtk = keys.includes("atk");
    const hasSpa = keys.includes("spa");
    if (hasAtk && hasSpa) return "Glass (mixed)";
    if (hasSpa) return "Glass (special)";
    return "Glass (physical)";
  }

  // useGlass false ⇒ primary is not Glass cannon; remaining tags map 1:1.
  return primary;
}

const TIPS: Record<PlaystyleTag, string> = {
  "Physical attacker":
    "Generally hits hard with physical moves — Attack leads the pack.",
  "Special attacker":
    "Generally hits hard with special moves — Sp. Atk leads the pack.",
  "Mixed attacker":
    "Tends to threaten from both sides — Attack and Sp. Atk are both strong.",
  Bulky:
    "Tends to soak hits — HP and defenses stand out more than raw Speed.",
  "Physical wall":
    "High Defense (and often HP) — favors taking physical hits and staying in.",
  "Special wall":
    "High Sp. Def (and often HP) — favors taking special hits and staying in.",
  Fast: "Speed stands out — favors moving first and pressuring faster leads.",
  "Glass cannon":
    "High offense and Speed, lower bulk — favors hitting hard before getting hit.",
  Slow: "Notably slow — usually wants to take hits or set up rather than outspeed.",
  Balanced:
    "No strong peaks — a flexible generalist rather than a one-role specialist.",
};

type Score = { tag: PlaystyleTag; score: number };

function meanOf(stats: StatSpread): number {
  return STAT_KEYS.reduce((sum, k) => sum + stats[k], 0) / STAT_KEYS.length;
}

function rel(stats: StatSpread, key: StatKey, mean: number): number {
  return mean > 0 ? stats[key] / mean : 1;
}

function scoreShape(stats: StatSpread): Score[] {
  const mean = meanOf(stats);
  const atk = rel(stats, "atk", mean);
  const spa = rel(stats, "spa", mean);
  const def = rel(stats, "def", mean);
  const spd = rel(stats, "spd", mean);
  const spe = rel(stats, "spe", mean);
  const hp = rel(stats, "hp", mean);

  const offense = Math.max(atk, spa);
  const bulk = (hp + def + spd) / 3;
  const physBulk = (hp + def) / 2;
  const specBulk = (hp + spd) / 2;
  const atkSpaGap = Math.abs(atk - spa);

  const scores: Score[] = [];

  // Glass: high offense + speed, soft bulk
  if (offense >= 1.15 && spe >= 1.1 && bulk <= 0.95) {
    scores.push({ tag: "Glass cannon", score: offense + spe - bulk });
  }

  // Walls / bulk
  if (physBulk >= 1.2 && atk < 1.15 && spa < 1.15 && def >= 1.15) {
    scores.push({ tag: "Physical wall", score: physBulk + def - offense * 0.4 });
  }
  if (specBulk >= 1.2 && atk < 1.15 && spa < 1.15 && spd >= 1.15) {
    scores.push({ tag: "Special wall", score: specBulk + spd - offense * 0.4 });
  }
  if (bulk >= 1.15 && offense <= 1.1) {
    scores.push({ tag: "Bulky", score: bulk - Math.max(0, offense - 1) });
  }

  // Attack bias
  if (atk >= 1.12 && atk - spa >= 0.12) {
    scores.push({ tag: "Physical attacker", score: atk + (atk - spa) });
  }
  if (spa >= 1.12 && spa - atk >= 0.12) {
    scores.push({ tag: "Special attacker", score: spa + (spa - atk) });
  }
  if (atk >= 1.08 && spa >= 1.08 && atkSpaGap <= 0.14) {
    scores.push({ tag: "Mixed attacker", score: (atk + spa) / 2 });
  }

  // Speed extremes
  if (spe >= 1.2) {
    scores.push({ tag: "Fast", score: spe });
  }
  if (spe <= 0.75) {
    scores.push({
      tag: "Slow",
      score: 1.2 - spe + Math.max(0, bulk - 1) * 0.3,
    });
  }

  if (scores.length === 0) {
    scores.push({ tag: "Balanced", score: 1 });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function pickTags(scores: Score[]): {
  primary: PlaystyleTag;
  secondary: PlaystyleTag | null;
} {
  let primary = scores[0]?.tag ?? "Balanced";
  let secondaryCandidate = scores[1]?.tag ?? null;

  // Prefer offense identity over glass shape when both fire — glass is the
  // silhouette; phys/spec says which offense axis actually matters.
  if (primary === "Glass cannon") {
    const attacker = scores.find((s) => ATTACKER_TAGS.has(s.tag));
    if (attacker) {
      primary = attacker.tag;
      secondaryCandidate = "Glass cannon";
    }
  }

  // Avoid redundant pairs (e.g. Physical wall + Bulky).
  const redundant =
    (primary === "Physical wall" || primary === "Special wall") &&
    secondaryCandidate === "Bulky";
  const sameFamily =
    (primary === "Physical attacker" && secondaryCandidate === "Mixed attacker") ||
    (primary === "Special attacker" && secondaryCandidate === "Mixed attacker");

  const primaryScore =
    scores.find((s) => s.tag === primary)?.score ?? scores[0]?.score ?? 0;
  const secondaryScore =
    secondaryCandidate == null
      ? 0
      : (scores.find((s) => s.tag === secondaryCandidate)?.score ?? 0);

  if (
    !secondaryCandidate ||
    secondaryCandidate === primary ||
    redundant ||
    sameFamily ||
    secondaryScore < primaryScore * 0.55
  ) {
    return { primary, secondary: null };
  }

  // Prefer complementary secondaries (bulk + attacker, fast + attacker, etc.)
  return { primary, secondary: secondaryCandidate };
}

function natureAlignmentFor(
  tags: PlaystyleTag[],
  nature: string | null | undefined,
  base: StatSpread,
): { alignment: NatureAlignment; label: string } {
  const mod = natureStatMod(nature);
  if (!mod) {
    return { alignment: "neutral", label: "Nature neutral" };
  }

  const keyStats = new Set<StatKey>();
  for (const tag of tags) {
    for (const k of keysForPlaystyleTag(tag, base)) keyStats.add(k);
  }

  // Slow: Speed drops help the role; Speed boosts fight it.
  const slow = tags.includes("Slow");
  if (slow) {
    if (mod.down === "spe") {
      return { alignment: "helps", label: "Nature helps" };
    }
    if (mod.up === "spe") {
      return { alignment: "fights", label: "Nature fights role" };
    }
  }

  if (keyStats.size === 0) {
    return { alignment: "neutral", label: "Nature neutral" };
  }

  const upsKey = keyStats.has(mod.up);
  const downsKey = keyStats.has(mod.down);

  if (upsKey && !downsKey) {
    return { alignment: "helps", label: "Nature helps" };
  }
  if (downsKey && !upsKey) {
    return { alignment: "fights", label: "Nature fights role" };
  }
  if (upsKey && downsKey) {
    // Boosts one key and dumps another — mixed signal.
    return { alignment: "neutral", label: "Nature mixed" };
  }
  return { alignment: "neutral", label: "Nature neutral" };
}

function abilityNudge(ability: string | null | undefined): string | null {
  if (!ability?.trim()) return null;
  return ABILITY_NUDGES[ability.trim().toLowerCase()] ?? null;
}

function ivNudge(
  tags: PlaystyleTag[],
  ivs: StatSpread | null | undefined,
  base: StatSpread,
): string | null {
  if (!ivs) return null;
  const keyStats = new Set<StatKey>();
  for (const tag of tags) {
    for (const k of keysForPlaystyleTag(tag, base)) {
      if (k !== "hp") keyStats.add(k);
    }
  }
  if (keyStats.size === 0) return null;

  const strongKeys = [...keyStats].filter((k) => {
    const band = classifyIv(ivs[k] ?? 0);
    return band === "perfect" || band === "strong";
  });
  if (strongKeys.length === 0) return null;

  const labels = strongKeys
    .map((k) => (k === "spe" ? "Speed" : k === "atk" ? "Attack" : k === "spa" ? "Sp. Atk" : k === "def" ? "Defense" : k === "spd" ? "Sp. Def" : "HP"))
    .join(" / ");
  return `This specimen’s ${labels} IVs look especially strong.`;
}

function buildTip(
  primary: PlaystyleTag,
  secondary: PlaystyleTag | null,
  ability: string | null | undefined,
  ivs: StatSpread | null | undefined,
  base: StatSpread,
): string {
  const parts = [TIPS[primary]];
  if (secondary && secondary !== "Balanced") {
    // Light secondary flavor without duplicating the whole primary tip.
    if (secondary === "Bulky" || secondary === "Physical wall" || secondary === "Special wall") {
      parts[0] = parts[0].replace(/\.$/, "") + ", with solid bulk.";
    } else if (secondary === "Fast") {
      parts[0] = parts[0].replace(/\.$/, "") + ", and Speed is a standout.";
    } else if (secondary === "Slow") {
      parts[0] = parts[0].replace(/\.$/, "") + ", but don’t expect it to outspeed much.";
    } else if (
      secondary === "Physical attacker" ||
      secondary === "Special attacker" ||
      secondary === "Mixed attacker"
    ) {
      parts.push(TIPS[secondary]);
    } else if (secondary === "Glass cannon") {
      parts.push(TIPS[secondary]);
    }
  }

  const abilityLine = abilityNudge(ability);
  if (abilityLine) parts.push(abilityLine);

  const ivLine = ivNudge(
    [primary, secondary].filter(Boolean) as PlaystyleTag[],
    ivs,
    base,
  );
  if (ivLine) parts.push(ivLine);

  return parts.join(" ");
}

/**
 * Deterministic beginner playstyle hint from species base stats
 * (+ optional nature / ability / IV nudges). Returns null when species
 * base stats are unknown.
 */
export function recommendPlaystyle(input: {
  pokedexId: number | null | undefined;
  nature?: string | null;
  ability?: string | null;
  ivs?: StatSpread | null;
}): PlaystyleHint | null {
  const base = baseStatsForSpecies(input.pokedexId);
  if (!base) return null;

  const scores = scoreShape(base);
  const { primary, secondary } = pickTags(scores);
  const tags = [primary, secondary].filter(Boolean) as PlaystyleTag[];
  const { alignment, label } = natureAlignmentFor(tags, input.nature, base);

  return {
    primary,
    secondary,
    tip: buildTip(primary, secondary, input.ability, input.ivs, base),
    natureAlignment: alignment,
    natureAlignmentLabel: label,
  };
}
