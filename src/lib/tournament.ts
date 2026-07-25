import type { TournamentView } from "@/lib/challenge-types";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export async function getTournamentForChallenge(
  challengeId: string,
): Promise<TournamentView | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const tournament = await getPrisma().tournament.findUnique({
      where: { challengeId },
      include: {
        matches: {
          orderBy: [{ round: "asc" }, { sortOrder: "asc" }],
          include: {
            trainerA: { select: { handle: true } },
            trainerB: { select: { handle: true } },
            winner: { select: { handle: true } },
          },
        },
      },
    });
    if (!tournament) return null;

    return {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
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
      })),
    };
  } catch {
    return null;
  }
}

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
