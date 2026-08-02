import {
  baseStatsForSpecies,
  natureStatMod,
  STAT_KEYS,
  type StatKey,
  type StatSpread,
} from "@/lib/stats";
import { classifyIv } from "@/lib/iv-quality";

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

const TAG_KEY_STATS: Record<PlaystyleTag, StatKey[]> = {
  "Physical attacker": ["atk"],
  "Special attacker": ["spa"],
  "Mixed attacker": ["atk", "spa"],
  Bulky: ["hp", "def", "spd"],
  "Physical wall": ["def", "hp"],
  "Special wall": ["spd", "hp"],
  Fast: ["spe"],
  "Glass cannon": ["atk", "spa", "spe"],
  Slow: ["hp", "def", "spd"],
  Balanced: [],
};

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
  const primary = scores[0]?.tag ?? "Balanced";
  const secondaryCandidate = scores[1]?.tag ?? null;

  // Avoid redundant pairs (e.g. Physical wall + Bulky).
  const redundant =
    (primary === "Physical wall" || primary === "Special wall") &&
    secondaryCandidate === "Bulky";
  const sameFamily =
    (primary === "Physical attacker" && secondaryCandidate === "Mixed attacker") ||
    (primary === "Special attacker" && secondaryCandidate === "Mixed attacker");

  if (
    !secondaryCandidate ||
    secondaryCandidate === primary ||
    redundant ||
    sameFamily ||
    (scores[1]?.score ?? 0) < (scores[0]?.score ?? 0) * 0.55
  ) {
    return { primary, secondary: null };
  }

  // Prefer complementary secondaries (bulk + attacker, fast + attacker, etc.)
  return { primary, secondary: secondaryCandidate };
}

function natureAlignmentFor(
  tags: PlaystyleTag[],
  nature: string | null | undefined,
): { alignment: NatureAlignment; label: string } {
  const mod = natureStatMod(nature);
  if (!mod) {
    return { alignment: "neutral", label: "Nature neutral" };
  }

  const keyStats = new Set<StatKey>();
  for (const tag of tags) {
    for (const k of TAG_KEY_STATS[tag]) keyStats.add(k);
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
): string | null {
  if (!ivs) return null;
  const keyStats = new Set<StatKey>();
  for (const tag of tags) {
    for (const k of TAG_KEY_STATS[tag]) {
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
  const { alignment, label } = natureAlignmentFor(tags, input.nature);

  return {
    primary,
    secondary,
    tip: buildTip(primary, secondary, input.ability, input.ivs),
    natureAlignment: alignment,
    natureAlignmentLabel: label,
  };
}
