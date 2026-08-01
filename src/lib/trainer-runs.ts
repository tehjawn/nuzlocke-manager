import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export type TrainerRunRow = {
  id: string;
  trainerId: string;
  runNumber: number;
  status: "ACTIVE" | "CLOSED";
  wipeCountAtStart: number;
  reviveUsed: boolean;
  earnedBadgeKeys: string[];
};

const runSelect = {
  id: true,
  trainerId: true,
  runNumber: true,
  status: true,
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

/** Return the active run, creating run 1 if the trainer predates the ledger. */
export async function ensureActiveRunInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
): Promise<TrainerRunRow> {
  if (trainer.activeRunId) {
    const existing = await tx.trainerRun.findUnique({
      where: { id: trainer.activeRunId },
      select: runSelect,
    });
    if (existing && existing.status === "ACTIVE") return existing;
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
export async function closeActiveRunAndStartNextInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
  endReason: "WIPE" | "GM_RESET" = "WIPE",
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

