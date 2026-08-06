import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";
import type {
  SurvivalMarketListItem,
  SurvivalMarketStatus,
  SurvivalMarketView,
  SurvivalPollTally,
  SurvivalPrediction,
  SurvivalVoteView,
} from "@/lib/survival-market-types";

const MAX_COMMENT_VOTES_PER_HOUR = 20;
export const SURVIVAL_COMMENT_MAX = 140;

type DbClient = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

type VoteRow = {
  id: string;
  prediction: SurvivalPrediction;
  comment: string | null;
  updatedAt: Date;
  user: {
    id: string;
    displayName: string | null;
    name: string | null;
    image: string | null;
  };
};

const voteUserSelect = {
  id: true,
  displayName: true,
  name: true,
  image: true,
} as const;

function displayNameFor(user: VoteRow["user"]): string {
  return user.displayName?.trim() || user.name?.trim() || "Trainer";
}

function isCorrect(
  status: SurvivalMarketStatus,
  prediction: SurvivalPrediction,
): boolean | null {
  if (status === "RESOLVED_DIE") return prediction === "DIE";
  if (status === "RESOLVED_SURVIVE") return prediction === "SURVIVE";
  return null;
}

function tallyVotes(votes: Array<{ prediction: SurvivalPrediction }>) {
  let survive = 0;
  let die = 0;
  for (const vote of votes) {
    if (vote.prediction === "SURVIVE") survive += 1;
    else die += 1;
  }
  const total = survive + die;
  return {
    survive,
    die,
    total,
    survivePct: total === 0 ? 0 : Math.round((survive / total) * 100),
  };
}

function mapVote(
  row: VoteRow,
  status: SurvivalMarketStatus,
): SurvivalVoteView {
  return {
    id: row.id,
    prediction: row.prediction,
    comment: row.comment,
    updatedAt: row.updatedAt.toISOString(),
    user: {
      id: row.user.id,
      displayName: displayNameFor(row.user),
      image: row.user.image,
    },
    correct: isCorrect(status, row.prediction),
  };
}

function toMarketView(
  market: {
    id: string;
    status: SurvivalMarketStatus;
    species: string;
    nickname: string | null;
    pokedexId: number | null;
    isShiny: boolean;
    resolvedAt: Date | null;
    votes: VoteRow[];
  },
  opts: {
    viewerUserId?: string | null;
    canVote: boolean;
    voteBlockedReason: string | null;
  },
): SurvivalMarketView {
  const counts = tallyVotes(market.votes);
  const votes = market.votes
    .slice()
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((row) => mapVote(row, market.status));
  const calledIt = votes.filter((v) => v.correct === true);
  const missed = votes.filter((v) => v.correct === false);
  const mine = opts.viewerUserId
    ? votes.find((v) => v.user.id === opts.viewerUserId)
    : undefined;
  return {
    id: market.id,
    status: market.status,
    species: market.species,
    nickname: market.nickname,
    pokedexId: market.pokedexId,
    isShiny: market.isShiny,
    ...counts,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    votes,
    calledIt,
    missed,
    myPrediction: mine?.prediction ?? null,
    canVote: opts.canVote,
    voteBlockedReason: opts.voteBlockedReason,
  };
}

/**
 * Batch slim tallies for board chips. Viewer prediction is optional (overlay
 * after shared cache) so Flight payloads stay light.
 */
export async function loadSurvivalPollTallies(
  pokemonIds: string[],
  viewerUserId?: string | null,
): Promise<Map<string, SurvivalPollTally>> {
  const out = new Map<string, SurvivalPollTally>();
  if (pokemonIds.length === 0) return out;

  const rows = await getPrisma().survivalMarket.findMany({
    where: { pokemonId: { in: pokemonIds } },
    select: {
      id: true,
      pokemonId: true,
      status: true,
      votes: {
        select: {
          prediction: true,
          userId: true,
        },
      },
    },
  });

  for (const row of rows) {
    if (!row.pokemonId) continue;
    const counts = tallyVotes(row.votes);
    if (counts.total === 0 && row.status === "OPEN") continue;
    const mine = viewerUserId
      ? row.votes.find((v) => v.userId === viewerUserId)
      : undefined;
    out.set(row.pokemonId, {
      marketId: row.id,
      status: row.status,
      survive: counts.survive,
      die: counts.die,
      total: counts.total,
      myPrediction: mine?.prediction ?? null,
    });
  }
  return out;
}

/**
 * Season-wide Survive/Die board for the Tools page — open + resolved markets
 * (void excluded). Slim tallies only; expand via getSurvivalMarketForPokemon.
 */
export async function listSurvivalMarketsForChallenge(input: {
  challengeId: string;
  viewerUserId?: string | null;
}): Promise<SurvivalMarketListItem[]> {
  const prisma = getPrisma();
  const rows = await prisma.survivalMarket.findMany({
    where: {
      challengeId: input.challengeId,
      status: { not: "VOID" },
    },
    select: {
      id: true,
      pokemonId: true,
      trainerId: true,
      status: true,
      species: true,
      nickname: true,
      pokedexId: true,
      isShiny: true,
      resolvedAt: true,
      votes: {
        select: {
          prediction: true,
          userId: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  const trainerIds = [...new Set(rows.map((row) => row.trainerId))];
  const trainers =
    trainerIds.length === 0
      ? []
      : await prisma.trainerProfile.findMany({
          where: { id: { in: trainerIds } },
          select: { id: true, handle: true },
        });
  const handleById = new Map(trainers.map((t) => [t.id, t.handle]));

  return rows.map((row) => {
    const counts = tallyVotes(row.votes);
    const mine = input.viewerUserId
      ? row.votes.find((v) => v.userId === input.viewerUserId)
      : undefined;
    return {
      id: row.id,
      status: row.status,
      pokemonId: row.pokemonId,
      species: row.species,
      nickname: row.nickname,
      pokedexId: row.pokedexId,
      isShiny: row.isShiny,
      survive: counts.survive,
      die: counts.die,
      total: counts.total,
      survivePct: counts.survivePct,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      myPrediction: mine?.prediction ?? null,
      trainer: {
        id: row.trainerId,
        handle: handleById.get(row.trainerId) ?? "Trainer",
      },
    };
  });
}

/** Details / grave: full market with voter chrome. */
export async function getSurvivalMarketForPokemon(input: {
  pokemonId: string;
  viewerUserId?: string | null;
  isMember: boolean;
}): Promise<SurvivalMarketView | null> {
  const prisma = getPrisma();
  const mon = await prisma.pokemonEntry.findUnique({
    where: { id: input.pokemonId },
    select: {
      id: true,
      slot: true,
      trainerId: true,
      runId: true,
      species: true,
      nickname: true,
      pokedexId: true,
      isShiny: true,
      trainer: {
        select: {
          challengeId: true,
          challenge: {
            select: {
              survivalMarketsEnabled: true,
              status: true,
            },
          },
        },
      },
      survivalMarket: {
        include: {
          votes: {
            include: { user: { select: voteUserSelect } },
          },
        },
      },
    },
  });
  if (!mon) return null;

  const enabled = mon.trainer.challenge.survivalMarketsEnabled;
  if (!enabled && !mon.survivalMarket) return null;

  if (mon.survivalMarket) {
    const open = mon.survivalMarket.status === "OPEN";
    const archived = mon.trainer.challenge.status === "ARCHIVED";
    let voteBlockedReason: string | null = null;
    let canVote = false;
    if (!enabled) {
      voteBlockedReason = "Polls are disabled for this season";
    } else if (!input.viewerUserId) {
      voteBlockedReason = "Sign in to weigh in";
    } else if (!input.isMember) {
      voteBlockedReason = "Join this season to vote";
    } else if (archived) {
      voteBlockedReason = "This season is archived";
    } else if (!open) {
      voteBlockedReason = "This poll is closed";
    } else if (mon.slot !== "MAIN" && mon.slot !== "RESERVE") {
      voteBlockedReason = "Only living party and box mons can be polled";
    } else {
      canVote = true;
    }
    return toMarketView(mon.survivalMarket, {
      viewerUserId: input.viewerUserId,
      canVote,
      voteBlockedReason,
    });
  }

  // No market yet — still show an empty open poll shell for eligible living mons.
  if (
    !enabled ||
    (mon.slot !== "MAIN" && mon.slot !== "RESERVE") ||
    mon.trainer.challenge.status === "ARCHIVED"
  ) {
    return null;
  }

  let voteBlockedReason: string | null = null;
  let canVote = false;
  if (!input.viewerUserId) {
    voteBlockedReason = "Sign in to weigh in";
  } else if (!input.isMember) {
    voteBlockedReason = "Join this season to vote";
  } else {
    canVote = true;
  }

  return {
    id: "",
    status: "OPEN",
    species: mon.species,
    nickname: mon.nickname,
    pokedexId: mon.pokedexId,
    isShiny: mon.isShiny,
    survive: 0,
    die: 0,
    total: 0,
    survivePct: 0,
    resolvedAt: null,
    votes: [],
    calledIt: [],
    missed: [],
    myPrediction: null,
    canVote,
    voteBlockedReason,
  };
}

async function getOrOpenMarketForPokemon(
  db: DbClient,
  pokemonId: string,
): Promise<{ id: string; status: SurvivalMarketStatus } | { error: string }> {
  const mon = await db.pokemonEntry.findUnique({
    where: { id: pokemonId },
    select: {
      id: true,
      slot: true,
      trainerId: true,
      runId: true,
      species: true,
      nickname: true,
      pokedexId: true,
      isShiny: true,
      trainer: {
        select: {
          challengeId: true,
          challenge: {
            select: {
              survivalMarketsEnabled: true,
              status: true,
            },
          },
          activeRun: { select: { id: true, status: true } },
        },
      },
      survivalMarket: { select: { id: true, status: true } },
    },
  });
  if (!mon) return { error: "Pokémon not found" };
  if (!mon.trainer.challenge.survivalMarketsEnabled) {
    return { error: "Survival polls are disabled for this season" };
  }
  if (mon.trainer.challenge.status === "ARCHIVED") {
    return { error: "This season is archived and read-only" };
  }
  if (mon.slot !== "MAIN" && mon.slot !== "RESERVE") {
    return { error: "Only living party and box mons can be polled" };
  }
  if (mon.trainer.activeRun?.status !== "ACTIVE") {
    return { error: "This run is finished — polls are closed" };
  }
  if (mon.survivalMarket) {
    if (mon.survivalMarket.status !== "OPEN") {
      return { error: "This poll is already closed" };
    }
    return mon.survivalMarket;
  }

  const created = await db.survivalMarket.create({
    data: {
      challengeId: mon.trainer.challengeId,
      trainerId: mon.trainerId,
      runId: mon.runId ?? mon.trainer.activeRun?.id ?? null,
      pokemonId: mon.id,
      species: mon.species,
      nickname: mon.nickname,
      pokedexId: mon.pokedexId,
      isShiny: mon.isShiny,
    },
    select: { id: true, status: true },
  });
  return created;
}

export async function castSurvivalVote(input: {
  pokemonId: string;
  userId: string;
  prediction: SurvivalPrediction;
  comment?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = getPrisma();
  const comment =
    input.comment == null ? null : input.comment.trim() || null;
  if (comment && comment.length > SURVIVAL_COMMENT_MAX) {
    return {
      ok: false,
      error: `Comment must be ${SURVIVAL_COMMENT_MAX} characters or fewer`,
    };
  }

  if (comment) {
    const recent = await prisma.survivalVote.count({
      where: {
        userId: input.userId,
        comment: { not: null },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1_000) },
      },
    });
    if (recent >= MAX_COMMENT_VOTES_PER_HOUR) {
      return {
        ok: false,
        error: "Too many hot takes this hour — try again later",
      };
    }
  }

  try {
    const market = await getOrOpenMarketForPokemon(prisma, input.pokemonId);
    if ("error" in market) return { ok: false, error: market.error };

    await prisma.survivalVote.upsert({
      where: {
        marketId_userId: { marketId: market.id, userId: input.userId },
      },
      create: {
        marketId: market.id,
        userId: input.userId,
        prediction: input.prediction,
        comment,
      },
      update: {
        prediction: input.prediction,
        ...(comment !== undefined ? { comment } : {}),
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Vote failed";
    return { ok: false, error: message };
  }
}

export async function resolveMarketsForPokemonDeath(
  db: DbClient,
  pokemonIds: string | string[],
): Promise<void> {
  const ids = Array.isArray(pokemonIds) ? pokemonIds : [pokemonIds];
  if (ids.length === 0) return;
  await db.survivalMarket.updateMany({
    where: { pokemonId: { in: ids }, status: "OPEN" },
    data: { status: "RESOLVED_DIE", resolvedAt: new Date() },
  });
}

/** Championship finish — open party/box markets → Survive. */
export async function resolveMarketsForVictory(
  db: DbClient,
  trainerId: string,
  runId: string,
): Promise<void> {
  const living = await db.pokemonEntry.findMany({
    where: {
      trainerId,
      slot: { in: ["MAIN", "RESERVE"] },
    },
    select: { id: true },
  });
  const pokemonIds = living.map((m) => m.id);
  if (pokemonIds.length === 0) return;
  await db.survivalMarket.updateMany({
    where: {
      trainerId,
      runId,
      pokemonId: { in: pokemonIds },
      status: "OPEN",
    },
    data: { status: "RESOLVED_SURVIVE", resolvedAt: new Date() },
  });
}

/**
 * Mid-run wipe — remaining open markets on this run die.
 * Call **before** `pokemonEntry.deleteMany`.
 */
export async function resolveMarketsForWipe(
  db: DbClient,
  trainerId: string,
  runId: string,
): Promise<void> {
  await db.survivalMarket.updateMany({
    where: { trainerId, runId, status: "OPEN" },
    data: { status: "RESOLVED_DIE", resolvedAt: new Date() },
  });
}

/** GM hard reset — void open markets (do not score as Die). */
export async function voidMarketsForTrainer(
  db: DbClient,
  trainerId: string,
): Promise<void> {
  await db.survivalMarket.updateMany({
    where: { trainerId, status: "OPEN" },
    data: { status: "VOID", resolvedAt: new Date() },
  });
}

/** Import / hard delete — void open markets for rows about to disappear. */
export async function voidOpenMarketsForPokemonIds(
  db: DbClient,
  pokemonIds: string[],
): Promise<void> {
  if (pokemonIds.length === 0) return;
  await db.survivalMarket.updateMany({
    where: { pokemonId: { in: pokemonIds }, status: "OPEN" },
    data: { status: "VOID", resolvedAt: new Date() },
  });
}
