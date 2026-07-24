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

/** Build single-elim first-round pairings; byes when odd count. */
export function buildFirstRoundPairings(
  trainerIds: string[],
): Array<{ trainerAId: string | null; trainerBId: string | null; label: string }> {
  const ids = [...trainerIds];
  const pairings: Array<{
    trainerAId: string | null;
    trainerBId: string | null;
    label: string;
  }> = [];

  let matchNum = 1;
  while (ids.length > 0) {
    const a = ids.shift() ?? null;
    const b = ids.shift() ?? null;
    pairings.push({
      trainerAId: a,
      trainerBId: b,
      label: b ? `Match ${matchNum}` : `Match ${matchNum} (bye)`,
    });
    matchNum += 1;
  }

  return pairings;
}
