/**
 * Swiss pairing + standings helpers.
 *
 * Pairing: sort by points → Buchholz → handle, then pair neighbors while
 * avoiding rematches when possible. Odd entrant at the bottom gets a bye.
 */

export type SwissEntrant = {
  trainerId: string;
  handle: string;
  points: number;
  buchholz: number;
  wins: number;
  losses: number;
  draws: number;
};

export type SwissPairing = {
  trainerAId: string | null;
  trainerBId: string | null;
  label: string;
};

export type SwissPriorMatch = {
  trainerAId: string | null;
  trainerBId: string | null;
};

/** Build Swiss pairings for the next round. */
export function buildSwissPairings(
  entrants: SwissEntrant[],
  priorMatches: SwissPriorMatch[],
  round: number,
): SwissPairing[] {
  const ranked = [...entrants].sort(compareSwissRank);
  const played = new Set<string>();
  for (const m of priorMatches) {
    if (m.trainerAId && m.trainerBId) {
      played.add(pairKey(m.trainerAId, m.trainerBId));
    }
  }

  const unpaired = ranked.map((e) => e.trainerId);
  const pairings: SwissPairing[] = [];
  let matchNum = 1;

  while (unpaired.length > 1) {
    const a = unpaired.shift()!;
    let bIndex = unpaired.findIndex(
      (b) => !played.has(pairKey(a, b)),
    );
    if (bIndex < 0) bIndex = 0;
    const b = unpaired.splice(bIndex, 1)[0]!;
    pairings.push({
      trainerAId: a,
      trainerBId: b,
      label: `Swiss R${round} · Match ${matchNum}`,
    });
    matchNum += 1;
  }

  if (unpaired.length === 1) {
    pairings.push({
      trainerAId: unpaired[0]!,
      trainerBId: null,
      label: `Swiss R${round} · Bye`,
    });
  }

  return pairings;
}

export function compareSwissRank(a: SwissEntrant, b: SwissEntrant): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.handle.localeCompare(b.handle);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Recompute wins/losses/points/Buchholz from completed matches. */
export function recomputeSwissStandings(input: {
  entrantIds: string[];
  handles: Map<string, string>;
  matches: Array<{
    trainerAId: string | null;
    trainerBId: string | null;
    winnerId: string | null;
  }>;
}): SwissEntrant[] {
  const byId = new Map<string, SwissEntrant>();
  for (const id of input.entrantIds) {
    byId.set(id, {
      trainerId: id,
      handle: input.handles.get(id) ?? id,
      points: 0,
      buchholz: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  const opponents = new Map<string, string[]>();
  for (const id of input.entrantIds) opponents.set(id, []);

  for (const m of input.matches) {
    const a = m.trainerAId;
    const b = m.trainerBId;
    if (!a) continue;

    // Bye: auto-win for A when B missing and winner is A (or winner null treated as bye win).
    if (!b) {
      const row = byId.get(a);
      if (!row) continue;
      row.wins += 1;
      row.points += 3;
      continue;
    }

    if (!m.winnerId) continue;

    const rowA = byId.get(a);
    const rowB = byId.get(b);
    if (!rowA || !rowB) continue;

    opponents.get(a)?.push(b);
    opponents.get(b)?.push(a);

    if (m.winnerId === a) {
      rowA.wins += 1;
      rowA.points += 3;
      rowB.losses += 1;
    } else if (m.winnerId === b) {
      rowB.wins += 1;
      rowB.points += 3;
      rowA.losses += 1;
    }
  }

  for (const [id, opps] of opponents) {
    const row = byId.get(id);
    if (!row) continue;
    row.buchholz = opps.reduce((sum, oid) => {
      return sum + (byId.get(oid)?.points ?? 0);
    }, 0);
  }

  return [...byId.values()].sort(compareSwissRank);
}
