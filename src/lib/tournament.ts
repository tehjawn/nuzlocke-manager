import type {
  MatchSideSnapshot,
  TournamentFormat,
  TournamentStandingView,
  TournamentSummary,
  TournamentView,
} from "@/lib/challenge-types";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { parseMatchSideSnapshot } from "@/lib/tournament-snapshots";

export type BracketPairing = {
  trainerAId: string | null;
  trainerBId: string | null;
  label: string;
};

/** Build single-elim pairings; byes when odd count. */
export function buildFirstRoundPairings(
  trainerIds: string[],
): BracketPairing[] {
  return buildRoundPairings(trainerIds, "Match");
}

/** Pair winners (or any ordered trainer list) into the next round. */
export function buildRoundPairings(
  trainerIds: string[],
  labelPrefix = "Match",
): BracketPairing[] {
  const ids = [...trainerIds];
  const pairings: BracketPairing[] = [];

  let matchNum = 1;
  while (ids.length > 0) {
    const a = ids.shift() ?? null;
    const b = ids.shift() ?? null;
    pairings.push({
      trainerAId: a,
      trainerBId: b,
      label: b ? `${labelPrefix} ${matchNum}` : `${labelPrefix} ${matchNum} (bye)`,
    });
    matchNum += 1;
  }

  return pairings;
}

/** True when every match in `round` has a winner. */
export function roundIsComplete(
  matches: Array<{ round: number; winnerId: string | null }>,
  round: number,
): boolean {
  const inRound = matches.filter((m) => m.round === round);
  return inRound.length > 0 && inRound.every((m) => Boolean(m.winnerId));
}

export function formatTournamentLabel(format: TournamentFormat): string {
  return format === "SWISS" ? "Swiss" : "Single elimination";
}

export function tournamentStatusLabel(status: string): string {
  if (status === "COMPLETE") return "Complete";
  if (status === "ACTIVE") return "Live";
  return "Draft";
}

/** List tournaments for a season (newest first). */
export async function listTournamentsForChallenge(
  challengeId: string,
): Promise<TournamentSummary[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const rows = await getPrisma().tournament.findMany({
      where: { challengeId },
      orderBy: { createdAt: "desc" },
      include: {
        matches: {
          select: { round: true },
          orderBy: { round: "desc" },
          take: 1,
        },
        _count: { select: { matches: true } },
      },
    });

    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format as TournamentFormat,
      status: t.status,
      swissRoundCount: t.swissRoundCount,
      matchCount: t._count.matches,
      currentRound: t.matches[0]?.round ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Full tournament detail with matches, snapshots, and Swiss standings. */
export async function getTournamentById(
  tournamentId: string,
): Promise<TournamentView | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const tournament = await getPrisma().tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          orderBy: [{ round: "asc" }, { sortOrder: "asc" }],
          include: {
            trainerA: { select: { handle: true } },
            trainerB: { select: { handle: true } },
            winner: { select: { handle: true } },
          },
        },
        standings: {
          orderBy: [{ points: "desc" }, { buchholz: "desc" }, { sortOrder: "asc" }],
          include: { trainer: { select: { handle: true } } },
        },
      },
    });
    if (!tournament) return null;

    const standings: TournamentStandingView[] = tournament.standings.map(
      (s, index) => ({
        trainerId: s.trainerId,
        handle: s.trainer.handle,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        points: s.points,
        buchholz: s.buchholz,
        sortOrder: s.sortOrder || index,
      }),
    );

    return {
      id: tournament.id,
      challengeId: tournament.challengeId,
      name: tournament.name,
      format: tournament.format as TournamentFormat,
      status: tournament.status,
      swissRoundCount: tournament.swissRoundCount,
      createdAt: tournament.createdAt.toISOString(),
      standings,
      matches: tournament.matches.map((m) => ({
        id: m.id,
        round: m.round,
        sortOrder: m.sortOrder,
        label: m.label,
        trainerAId: m.trainerAId,
        trainerBId: m.trainerBId,
        winnerId: m.winnerId,
        notes: m.notes,
        trainerAHandle: m.trainerA?.handle ?? null,
        trainerBHandle: m.trainerB?.handle ?? null,
        winnerHandle: m.winner?.handle ?? null,
        squadA: parseMatchSideSnapshot(m.squadA) as MatchSideSnapshot | null,
        squadB: parseMatchSideSnapshot(m.squadB) as MatchSideSnapshot | null,
        pokepasteA: m.pokepasteA,
        pokepasteB: m.pokepasteB,
        lockedAt: m.lockedAt?.toISOString() ?? null,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * @deprecated Prefer listTournamentsForChallenge / getTournamentById.
 * Kept for callers that still assume one tournament per season — returns
 * the newest ACTIVE tournament, else newest overall.
 */
export async function getTournamentForChallenge(
  challengeId: string,
): Promise<TournamentView | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const active = await getPrisma().tournament.findFirst({
      where: { challengeId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (active) return getTournamentById(active.id);

    const any = await getPrisma().tournament.findFirst({
      where: { challengeId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!any) return null;
    return getTournamentById(any.id);
  } catch {
    return null;
  }
}
