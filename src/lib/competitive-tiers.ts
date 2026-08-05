import competitiveTiersData from "@/data/competitive-tiers.json";
import {
  modernEmeraldNationalIds,
  modernEmeraldSpeciesRef,
} from "@/lib/modern-emerald-dex";
import {
  STAT_RANKS_BEST_FIRST,
  statRankToneClass,
  type StatRank,
} from "@/lib/species-ranks";

export type CompetitiveTierMeta = {
  label: string;
  blurb: string;
  updated: string;
};

export type CompetitiveTierEntry = {
  pokedexId: number;
  species: string;
  /** Null when the species has not been curated yet. */
  tier: StatRank | null;
  /** Required whenever `tier` is set; null for Untiered. */
  reason: string | null;
};

export type CompetitiveTierBucket = {
  key: StatRank | "untiered";
  entries: CompetitiveTierEntry[];
  /** How many Modern Emerald species sit in this bucket. */
  count: number;
};

type RawFile = {
  meta: CompetitiveTierMeta;
  byId: Record<string, { tier: string; reason: string }>;
};

const RANK_SET = new Set<string>(STAT_RANKS_BEST_FIRST);

const raw = competitiveTiersData as RawFile;

const curatedById = new Map<number, { tier: StatRank; reason: string }>();
for (const [idRaw, entry] of Object.entries(raw.byId)) {
  const pokedexId = Number(idRaw);
  if (!Number.isFinite(pokedexId) || pokedexId <= 0) continue;
  if (!RANK_SET.has(entry.tier)) continue;
  const reason = entry.reason.trim();
  if (!reason) continue;
  curatedById.set(pokedexId, {
    tier: entry.tier as StatRank,
    reason,
  });
}

export function competitiveTierMeta(): CompetitiveTierMeta {
  return raw.meta;
}

/** Lookup for briefing chips / hover — null when not curated. */
export function competitiveTierFor(
  pokedexId: number | null | undefined,
): CompetitiveTierEntry | null {
  if (pokedexId == null || pokedexId <= 0) return null;
  const ref = modernEmeraldSpeciesRef(pokedexId);
  const curated = curatedById.get(pokedexId);
  if (!curated) {
    return {
      pokedexId,
      species: ref.species,
      tier: null,
      reason: null,
    };
  }
  return {
    pokedexId,
    species: ref.species,
    tier: curated.tier,
    reason: curated.reason,
  };
}

let cachedBuckets: CompetitiveTierBucket[] | null = null;

/**
 * Hand-curated Modern Emerald nuzlocke viability ladder. Every ranked species
 * carries a one-line reason — the letter alone is never enough. Any ME species
 * still missing an entry lands in Untiered rather than a guessed letter.
 */
export function competitiveTierList(): CompetitiveTierBucket[] {
  if (cachedBuckets) return cachedBuckets;

  const byRank: Record<StatRank, CompetitiveTierEntry[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    F: [],
  };
  const untiered: CompetitiveTierEntry[] = [];

  for (const pokedexId of modernEmeraldNationalIds()) {
    const entry = competitiveTierFor(pokedexId)!;
    if (entry.tier == null) {
      untiered.push(entry);
      continue;
    }
    byRank[entry.tier].push(entry);
  }

  for (const rank of STAT_RANKS_BEST_FIRST) {
    byRank[rank].sort((a, b) => a.species.localeCompare(b.species));
  }
  untiered.sort((a, b) => a.pokedexId - b.pokedexId);

  cachedBuckets = [
    ...STAT_RANKS_BEST_FIRST.map((rank) => ({
      key: rank,
      entries: byRank[rank],
      count: byRank[rank].length,
    })),
    {
      key: "untiered" as const,
      entries: untiered,
      count: untiered.length,
    },
  ];
  return cachedBuckets;
}

export function competitiveTierBandBlurb(tier: StatRank): string {
  if (tier === "S") return "Run-defining — build the team around them";
  if (tier === "A") return "Core pieces — strong offense or defense";
  if (tier === "B") return "Solid role players with a clear flaw";
  if (tier === "C") return "Situational — one job, limited window";
  if (tier === "D") return "Last-resort fillers — replace when you can";
  return "Actively harmful — bench yesterday";
}

/** Re-export so competitive UI stays on the shared letter chrome. */
export { statRankToneClass as competitiveTierToneClass };
