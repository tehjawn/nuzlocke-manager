import { normalizeAskQuestion } from "@/features/search/ask-canned";
import type {
  AskAnswer,
  AskPokemonRankingItem,
} from "@/features/search/ask-types";
import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Zero-model Ask answers (#395 Phase 0).
 *
 * Rankings, roster lists, badge standings, and simple counts never needed
 * Gemini — emit structured cards / template prose from season context already
 * in the browser. Matched after canned orientation and before Gemini.
 */

const FALLEN_SLOT = "GRAVEYARD";
const LIST_LIMIT = 8;

type SeasonTrainer = SearchSeasonContext["trainers"][number];
type SeasonMon = SeasonTrainer["pokemon"][number];

type RankedMon = {
  mon: SeasonMon;
  trainer: SeasonTrainer;
};

function livingMons(trainer: SeasonTrainer): SeasonMon[] {
  return (trainer.pokemon ?? []).filter((m) => m.slot !== FALLEN_SLOT);
}

function fallenMons(trainer: SeasonTrainer): SeasonMon[] {
  return (trainer.pokemon ?? []).filter((m) => m.slot === FALLEN_SLOT);
}

function resolveMyTrainer(
  season: SearchSeasonContext,
): SeasonTrainer | null {
  if (!season.myTrainerId) return null;
  return season.trainers.find((t) => t.id === season.myTrainerId) ?? null;
}

/** Match a trainer handle mentioned in the question (case-insensitive). */
function findMentionedTrainer(
  normalized: string,
  season: SearchSeasonContext,
): SeasonTrainer | null {
  let best: SeasonTrainer | null = null;
  let bestLen = 0;
  for (const trainer of season.trainers) {
    const handle = trainer.handle.trim().toLowerCase();
    if (handle.length < 2) continue;
    if (!normalized.includes(handle)) continue;
    if (handle.length > bestLen) {
      best = trainer;
      bestLen = handle.length;
    }
  }
  return best;
}

function wantsMyTeam(normalized: string): boolean {
  return (
    /\bmy\s+(team|party|squad|roster|mons?|pok[eé]mon)\b/.test(normalized) ||
    /\b(on|for)\s+my\s+(team|party|squad|roster)\b/.test(normalized) ||
    (/\b(my|mine)\b/.test(normalized) &&
      /\b(strongest|weakest|best|top|highest|lowest|show|list|see|fallen|memorial|grave)\b/.test(
        normalized,
      ))
  );
}

function isMetaQuestion(normalized: string): boolean {
  return /\b(bst|base\s*stats?|tier|ou\b|uber|competitive|type\s*chart|movepool|learnset)\b/.test(
    normalized,
  );
}

function isLevelRankingQuestion(normalized: string): boolean {
  if (isMetaQuestion(normalized)) return false;
  // Memorial / fallen rankings need the fallen-list path or Gemini.
  if (/\b(fallen|dead|deaths?|memorial|grave|rip|wiped)\b/.test(normalized)) {
    return false;
  }
  return (
    /\b(strongest|weakest|highest\s*level|lowest\s*level)\b/.test(normalized) ||
    /\b(best|top)\s+(party|team|mons?|pok[eé]mon)\b/.test(normalized) ||
    /\b(what|which)\s+(are\s+)?(the\s+)?(strongest|weakest|highest|lowest)\b/.test(
      normalized,
    ) ||
    /\bwho('s| is)?\s*(the\s+)?(strongest|weakest|highest|lowest)\b/.test(
      normalized,
    )
  );
}

function rankingAscending(normalized: string): boolean {
  return /\b(weakest|lowest)\b/.test(normalized);
}

function isFallenListQuestion(normalized: string): boolean {
  if (isMetaQuestion(normalized)) return false;
  // Counts stay in the count handler; weakest/strongest fallen → Gemini for now.
  if (/\b(how many|count|number of)\b/.test(normalized)) return false;
  if (/\b(strongest|weakest|highest|lowest|best|top)\b/.test(normalized)) {
    return false;
  }
  return (
    /\b(fallen|memorial|graveyard|graves?|rip)\b/.test(normalized) &&
    /\b(show|list|see|what|who|my|mine|team|party|roster|mons?|pok[eé]mon)\b/.test(
      normalized,
    )
  );
}

/**
 * "Show me my pokemon", "what's on my team", "list ash's party" — not a
 * strongest/weakest ranking, just the living roster.
 */
function isRosterListQuestion(normalized: string): boolean {
  if (isMetaQuestion(normalized)) return false;
  if (isLevelRankingQuestion(normalized)) return false;
  if (isFallenListQuestion(normalized)) return false;
  if (/\b(how many|count|number of)\b/.test(normalized)) return false;

  const teamNoun =
    /\b(team|party|squad|roster|mons?|pok[eé]mon|box)\b/.test(normalized);
  if (!teamNoun) return false;

  const listVerb =
    /\b(show|list|see|display|view)\b/.test(normalized) ||
    /\b(what('s| is)|whats)\s+(on|in)\b/.test(normalized) ||
    /\b(who('s| is)|whos)\s+on\b/.test(normalized) ||
    /\b(my|mine)\s+(team|party|squad|roster|mons?|pok[eé]mon)\b/.test(
      normalized,
    );

  return listVerb;
}

function isBadgeStandingsQuestion(normalized: string): boolean {
  if (
    /\b(badge|badges)\b/.test(normalized) &&
    /\b(ahead|standings?|leaderboard|most|lead|leading|race|count|how many)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  return (
    /\bwho('s| is)?\s*(ahead|leading|in\s+the\s+lead)\b/.test(normalized) ||
    /\b(badge\s+standings?|badge\s+race|most\s+badges)\b/.test(normalized)
  );
}

function isCountQuestion(normalized: string): boolean {
  return (
    /\b(how many|count|number of)\b/.test(normalized) &&
    /\b(living|alive|fallen|dead|deaths?|memorial|grave|badges?|trainers?)\b/.test(
      normalized,
    )
  );
}

function isWipeQuestion(normalized: string): boolean {
  // normalizeAskQuestion strips apostrophes → "who's" becomes "who s".
  return (
    /\b(who|which)\b/.test(normalized) &&
    /\b(wiped|wipe|wipes)\b/.test(normalized)
  );
}

function toRankingItem(entry: RankedMon, reason?: string): AskPokemonRankingItem {
  return {
    species: entry.mon.species,
    nickname: entry.mon.nickname?.trim() || undefined,
    level: entry.mon.level ?? undefined,
    trainerHandle: entry.trainer.handle,
    reason,
  };
}

function resolveScope(
  season: SearchSeasonContext,
  normalized: string,
): { trainers: SeasonTrainer[]; scopeLabel: string } | null {
  const myTeam = wantsMyTeam(normalized);
  const mentioned = findMentionedTrainer(normalized, season);

  if (myTeam) {
    const me = resolveMyTrainer(season);
    if (!me) return null;
    return { trainers: [me], scopeLabel: "on your team" };
  }
  if (mentioned) {
    return {
      trainers: [mentioned],
      scopeLabel: `on ${mentioned.handle}'s team`,
    };
  }
  return { trainers: season.trainers, scopeLabel: "across the board" };
}

function buildLevelRanking(
  season: SearchSeasonContext,
  normalized: string,
): AskAnswer | null {
  const ascending = rankingAscending(normalized);
  const scope = resolveScope(season, normalized);
  if (!scope) {
    return {
      kind: "prose",
      markdown: "Sign in and claim a trainer board to ask about your team.",
    };
  }

  const pool: RankedMon[] = [];
  for (const trainer of scope.trainers) {
    for (const mon of livingMons(trainer)) {
      if (mon.level == null) continue;
      pool.push({ mon, trainer });
    }
  }

  if (!pool.length) {
    return {
      kind: "prose",
      markdown: `No living Pokémon with levels ${scope.scopeLabel} yet.`,
    };
  }

  pool.sort((a, b) => {
    const levelDiff = (a.mon.level ?? 0) - (b.mon.level ?? 0);
    return ascending ? levelDiff : -levelDiff;
  });

  const items = pool
    .slice(0, LIST_LIMIT)
    .map((entry) =>
      toRankingItem(
        entry,
        entry.mon.level != null ? `Lv. ${entry.mon.level}` : undefined,
      ),
    );

  const adj = ascending ? "weakest" : "strongest";
  return {
    kind: "pokemon_ranking",
    summaryMarkdown: `**${adj[0]!.toUpperCase()}${adj.slice(1)}** living Pokémon ${scope.scopeLabel} (by level).`,
    items,
  };
}

function buildRosterList(
  season: SearchSeasonContext,
  normalized: string,
  opts: { fallen: boolean },
): AskAnswer | null {
  const scope = resolveScope(season, normalized);
  if (!scope) {
    return {
      kind: "prose",
      markdown: "Sign in and claim a trainer board to ask about your team.",
    };
  }

  // League-wide "show me every pokemon" is too large — require a scope.
  if (
    scope.trainers.length > 1 &&
    !wantsMyTeam(normalized) &&
    !findMentionedTrainer(normalized, season)
  ) {
    return {
      kind: "prose",
      markdown:
        "Ask about **your** team or name a trainer (e.g. “show me ash’s team”).",
    };
  }

  const pool: RankedMon[] = [];
  for (const trainer of scope.trainers) {
    const mons = opts.fallen ? fallenMons(trainer) : livingMons(trainer);
    for (const mon of mons) {
      pool.push({ mon, trainer });
    }
  }

  const kindLabel = opts.fallen ? "Fallen" : "Living";
  if (!pool.length) {
    return {
      kind: "prose",
      markdown: opts.fallen
        ? `No fallen Pokémon ${scope.scopeLabel} yet.`
        : `No living Pokémon ${scope.scopeLabel} yet.`,
    };
  }

  const items = pool.slice(0, LIST_LIMIT).map((entry) =>
    toRankingItem(
      entry,
      entry.mon.level != null ? `Lv. ${entry.mon.level}` : undefined,
    ),
  );

  const more =
    pool.length > LIST_LIMIT
      ? ` Showing ${LIST_LIMIT} of ${pool.length}.`
      : "";

  return {
    kind: "pokemon_ranking",
    summaryMarkdown: `**${kindLabel} Pokémon** ${scope.scopeLabel}.${more}`,
    items,
  };
}

function buildBadgeStandings(season: SearchSeasonContext): AskAnswer {
  const rows = [...season.trainers]
    .map((t) => ({
      handle: t.handle,
      badges: t.earnedBadgeKeys?.length ?? 0,
    }))
    .sort((a, b) => b.badges - a.badges || a.handle.localeCompare(b.handle));

  if (!rows.length) {
    return { kind: "prose", markdown: "No trainers on the board yet." };
  }

  const lines = rows.slice(0, 12).map((row, i) => {
    const n = row.badges;
    return `${i + 1}. **${row.handle}** — ${n} badge${n === 1 ? "" : "s"}`;
  });

  return {
    kind: "prose",
    markdown: ["**Badge standings** (most first):", "", ...lines].join("\n"),
  };
}

function buildWipeAnswer(season: SearchSeasonContext): AskAnswer {
  const wiped = season.trainers.filter((t) => {
    const status = (t.statusText ?? "").toLowerCase();
    if (/\bwipe/.test(status)) return true;
    // No living mons left and at least one fallen → treat as wiped.
    return livingMons(t).length === 0 && fallenMons(t).length > 0;
  });

  if (!wiped.length) {
    return {
      kind: "prose",
      markdown: "No trainers look wiped on the board right now.",
    };
  }

  const names = wiped.map((t) => `**${t.handle}**`).join(", ");
  return {
    kind: "prose",
    markdown: `Wiped: ${names}.`,
  };
}

function buildCountAnswer(
  season: SearchSeasonContext,
  normalized: string,
): AskAnswer | null {
  const mentioned = findMentionedTrainer(normalized, season);
  const myTeam = wantsMyTeam(normalized);
  const me = myTeam ? resolveMyTrainer(season) : null;
  const scoped = mentioned ?? me;

  if (/\b(trainers?)\b/.test(normalized) && !/\b(badge|living|fallen)\b/.test(normalized)) {
    return {
      kind: "prose",
      markdown: `There ${season.trainers.length === 1 ? "is" : "are"} **${season.trainers.length}** trainer${season.trainers.length === 1 ? "" : "s"} on the board.`,
    };
  }

  if (/\b(badge|badges)\b/.test(normalized)) {
    if (scoped) {
      const n = scoped.earnedBadgeKeys?.length ?? 0;
      return {
        kind: "prose",
        markdown: `**${scoped.handle}** has **${n}** badge${n === 1 ? "" : "s"}.`,
      };
    }
    const total = season.trainers.reduce(
      (sum, t) => sum + (t.earnedBadgeKeys?.length ?? 0),
      0,
    );
    return {
      kind: "prose",
      markdown: `Trainers have earned **${total}** badges combined.`,
    };
  }

  if (/\b(fallen|dead|deaths?|memorial|grave)\b/.test(normalized)) {
    if (scoped) {
      const n = fallenMons(scoped).length;
      return {
        kind: "prose",
        markdown: `**${scoped.handle}** has **${n}** fallen Pokémon in the memorial.`,
      };
    }
    const n = season.trainers.reduce(
      (sum, t) => sum + fallenMons(t).length,
      0,
    );
    return {
      kind: "prose",
      markdown: `There ${n === 1 ? "is" : "are"} **${n}** fallen Pokémon in the memorial.`,
    };
  }

  if (/\b(living|alive)\b/.test(normalized) || /\bpok[eé]mon\b/.test(normalized)) {
    if (scoped) {
      const n = livingMons(scoped).length;
      return {
        kind: "prose",
        markdown: `**${scoped.handle}** has **${n}** living Pokémon.`,
      };
    }
    const n = season.trainers.reduce(
      (sum, t) => sum + livingMons(t).length,
      0,
    );
    return {
      kind: "prose",
      markdown: `There ${n === 1 ? "is" : "are"} **${n}** living Pokémon on the board.`,
    };
  }

  return null;
}

/**
 * Try to answer from season data alone. Returns null when the question needs
 * Gemini (rules prose, meta, open-ended).
 */
export function matchDeterministicAsk(
  question: string,
  season?: SearchSeasonContext | null,
): AskAnswer | null {
  if (!season?.trainers.length) return null;

  const normalized = normalizeAskQuestion(question);
  if (!normalized) return null;

  if (isLevelRankingQuestion(normalized)) {
    return buildLevelRanking(season, normalized);
  }

  if (isFallenListQuestion(normalized)) {
    return buildRosterList(season, normalized, { fallen: true });
  }

  if (isRosterListQuestion(normalized)) {
    return buildRosterList(season, normalized, { fallen: false });
  }

  if (isWipeQuestion(normalized)) {
    return buildWipeAnswer(season);
  }

  if (isBadgeStandingsQuestion(normalized)) {
    if (
      /\bhow many\b/.test(normalized) &&
      findMentionedTrainer(normalized, season)
    ) {
      return buildCountAnswer(season, normalized);
    }
    return buildBadgeStandings(season);
  }

  if (isCountQuestion(normalized)) {
    return buildCountAnswer(season, normalized);
  }

  return null;
}
