import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export type TrainerRunEndReasonName = "WIPE" | "GM_RESET" | "VICTORY";

export type TrainerRunRow = {
  id: string;
  trainerId: string;
  runNumber: number;
  status: "ACTIVE" | "CLOSED";
  endReason: TrainerRunEndReasonName | null;
  wipeCountAtStart: number;
  reviveUsed: boolean;
  earnedBadgeKeys: string[];
};

const runSelect = {
  id: true,
  trainerId: true,
  runNumber: true,
  status: true,
  endReason: true,
  wipeCountAtStart: true,
  reviveUsed: true,
  earnedBadgeKeys: true,
} as const;

/** Create the active run and point the trainer at it (new boards / GM hard reset / seed). */
export async function createInitialActiveRunInTx(
  tx: TxClient,
  trainerId: string,
  opts?: { wipeCount?: number; reviveUsed?: boolean },
): Promise<TrainerRunRow> {
  const wipeCount = opts?.wipeCount ?? 0;
  const reviveUsed = opts?.reviveUsed ?? false;
  const run = await tx.trainerRun.create({
    data: {
      trainerId,
      runNumber: wipeCount + 1,
      status: "ACTIVE",
      wipeCountAtStart: wipeCount,
      reviveUsed,
      earnedBadgeKeys: [],
      startedAt: new Date(),
    },
    select: runSelect,
  });
  await tx.trainerProfile.update({
    where: { id: trainerId },
    data: { activeRunId: run.id, wipeCount, reviveUsed },
  });
  return run;
}

/** A run closed as VICTORY stays the trainer's current run until they start the next one. */
export function isEndedRun(run: TrainerRunRow): boolean {
  return run.status === "CLOSED" && run.endReason === "VICTORY";
}

/**
 * Return the active run, creating run 1 if the trainer predates the ledger.
 *
 * A run closed as VICTORY is returned as-is: the board is frozen as the final
 * team, and edits to it (a GM fixing a typo) belong to the run that was won,
 * not to a resurrected or freshly minted attempt.
 */
export async function ensureActiveRunInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
): Promise<TrainerRunRow> {
  if (trainer.activeRunId) {
    const existing = await tx.trainerRun.findUnique({
      where: { id: trainer.activeRunId },
      select: runSelect,
    });
    if (existing && (existing.status === "ACTIVE" || isEndedRun(existing))) {
      return existing;
    }
  }

  const expectedNumber = trainer.wipeCount + 1;
  const byNumber = await tx.trainerRun.findUnique({
    where: {
      trainerId_runNumber: {
        trainerId: trainer.id,
        runNumber: expectedNumber,
      },
    },
    select: runSelect,
  });
  if (byNumber) {
    if (byNumber.status !== "ACTIVE") {
      // Repair drift: reopen without wiping the closed-run badge archive.
      const reopened = await tx.trainerRun.update({
        where: { id: byNumber.id },
        data: {
          status: "ACTIVE",
          endedAt: null,
          endReason: null,
          reviveUsed: false,
        },
        select: runSelect,
      });
      await tx.trainerProfile.update({
        where: { id: trainer.id },
        data: { activeRunId: reopened.id, reviveUsed: false },
      });
      return reopened;
    }
    await tx.trainerProfile.update({
      where: { id: trainer.id },
      data: { activeRunId: byNumber.id },
    });
    return byNumber;
  }

  const created = await tx.trainerRun.create({
    data: {
      trainerId: trainer.id,
      runNumber: expectedNumber,
      status: "ACTIVE",
      wipeCountAtStart: trainer.wipeCount,
      reviveUsed: false,
      earnedBadgeKeys: [],
      startedAt: new Date(),
    },
    select: runSelect,
  });
  await tx.trainerProfile.update({
    where: { id: trainer.id },
    data: { activeRunId: created.id },
  });
  return created;
}

export type CloseRunArchive = {
  reviveUsed: boolean;
  earnedBadgeKeys: string[];
};

/**
 * Close the active run (wipe) and open the next attempt.
 * Archives revive + badges onto the closed run; new run starts with a fresh revive.
 * Caller increments trainer.wipeCount to match closed-run count.
 */
/**
 * Close the active run without opening the next one (Championship finish).
 *
 * The trainer keeps pointing at the closed run: the live board is still the
 * team that won, and `wipeCount` does not move until they start a new attempt —
 * so `wipeCount + 1` keeps naming the run on screen.
 */
export async function closeActiveRunInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
  endReason: TrainerRunEndReasonName,
  archive: CloseRunArchive = { reviveUsed: false, earnedBadgeKeys: [] },
): Promise<TrainerRunRow> {
  const active = await ensureActiveRunInTx(tx, trainer);
  return tx.trainerRun.update({
    where: { id: active.id },
    data: {
      status: "CLOSED",
      endedAt: new Date(),
      endReason,
      reviveUsed: archive.reviveUsed,
      earnedBadgeKeys: archive.earnedBadgeKeys,
    },
    select: runSelect,
  });
}

/**
 * Open the attempt after a run that was already closed (see `closeActiveRunInTx`).
 * Moves `wipeCount` up to the closed run's number so the invariant
 * `activeRunNumber === wipeCount + 1` holds again, and clears the ended marker.
 * Caller clears the live board.
 */
export async function startNextRunAfterEndInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
): Promise<TrainerRunRow> {
  const ended = await ensureActiveRunInTx(tx, trainer);
  const nextNumber = ended.runNumber + 1;
  const next = await tx.trainerRun.create({
    data: {
      trainerId: trainer.id,
      runNumber: nextNumber,
      status: "ACTIVE",
      wipeCountAtStart: nextNumber - 1,
      reviveUsed: false,
      earnedBadgeKeys: [],
      startedAt: new Date(),
    },
    select: runSelect,
  });
  await tx.trainerProfile.update({
    where: { id: trainer.id },
    data: {
      activeRunId: next.id,
      wipeCount: nextNumber - 1,
      reviveUsed: false,
      runEndedAt: null,
    },
  });
  return next;
}

export async function closeActiveRunAndStartNextInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
  endReason: TrainerRunEndReasonName = "WIPE",
  archive: CloseRunArchive = { reviveUsed: false, earnedBadgeKeys: [] },
): Promise<{ closed: TrainerRunRow; next: TrainerRunRow }> {
  const active = await ensureActiveRunInTx(tx, trainer);
  const now = new Date();

  const closed = await tx.trainerRun.update({
    where: { id: active.id },
    data: {
      status: "CLOSED",
      endedAt: now,
      endReason,
      reviveUsed: archive.reviveUsed,
      earnedBadgeKeys: archive.earnedBadgeKeys,
    },
    select: runSelect,
  });

  const nextNumber = active.runNumber + 1;
  const next = await tx.trainerRun.create({
    data: {
      trainerId: trainer.id,
      runNumber: nextNumber,
      status: "ACTIVE",
      // Invariant: runNumber === wipeCountAtStart + 1.
      wipeCountAtStart: nextNumber - 1,
      reviveUsed: false,
      earnedBadgeKeys: [],
      startedAt: now,
    },
    select: runSelect,
  });

  await tx.trainerProfile.update({
    where: { id: trainer.id },
    data: { activeRunId: next.id, reviveUsed: false },
  });

  return { closed, next };
}

/** Sync TrainerProfile.reviveUsed + active TrainerRun.reviveUsed together. */
export async function setActiveRunReviveInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
  reviveUsed: boolean,
): Promise<void> {
  const active = await ensureActiveRunInTx(tx, trainer);
  await tx.trainerRun.update({
    where: { id: active.id },
    data: { reviveUsed },
  });
  await tx.trainerProfile.update({
    where: { id: trainer.id },
    data: { reviveUsed },
  });
}

