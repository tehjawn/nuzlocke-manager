import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export type TrainerRunRow = {
  id: string;
  trainerId: string;
  runNumber: number;
  status: "ACTIVE" | "CLOSED";
  wipeCountAtStart: number;
};

/** Create run 1 and point the trainer at it (new boards / GM hard reset). */
export async function createInitialActiveRunInTx(
  tx: TxClient,
  trainerId: string,
): Promise<TrainerRunRow> {
  const run = await tx.trainerRun.create({
    data: {
      trainerId,
      runNumber: 1,
      status: "ACTIVE",
      wipeCountAtStart: 0,
      startedAt: new Date(),
    },
    select: {
      id: true,
      trainerId: true,
      runNumber: true,
      status: true,
      wipeCountAtStart: true,
    },
  });
  await tx.trainerProfile.update({
    where: { id: trainerId },
    data: { activeRunId: run.id, wipeCount: 0 },
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
      select: {
        id: true,
        trainerId: true,
        runNumber: true,
        status: true,
        wipeCountAtStart: true,
      },
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
    select: {
      id: true,
      trainerId: true,
      runNumber: true,
      status: true,
      wipeCountAtStart: true,
    },
  });
  if (byNumber) {
    if (byNumber.status !== "ACTIVE") {
      await tx.trainerRun.update({
        where: { id: byNumber.id },
        data: { status: "ACTIVE", endedAt: null, endReason: null },
      });
    }
    await tx.trainerProfile.update({
      where: { id: trainer.id },
      data: { activeRunId: byNumber.id },
    });
    return { ...byNumber, status: "ACTIVE" };
  }

  const created = await tx.trainerRun.create({
    data: {
      trainerId: trainer.id,
      runNumber: expectedNumber,
      status: "ACTIVE",
      wipeCountAtStart: trainer.wipeCount,
      startedAt: new Date(),
    },
    select: {
      id: true,
      trainerId: true,
      runNumber: true,
      status: true,
      wipeCountAtStart: true,
    },
  });
  await tx.trainerProfile.update({
    where: { id: trainer.id },
    data: { activeRunId: created.id },
  });
  return created;
}

/**
 * Close the active run (wipe) and open the next attempt.
 * Caller increments trainer.wipeCount to match closed-run count.
 */
export async function closeActiveRunAndStartNextInTx(
  tx: TxClient,
  trainer: { id: string; wipeCount: number; activeRunId: string | null },
  endReason: "WIPE" | "GM_RESET" = "WIPE",
): Promise<{ closed: TrainerRunRow; next: TrainerRunRow }> {
  const active = await ensureActiveRunInTx(tx, trainer);
  const now = new Date();

  const closed = await tx.trainerRun.update({
    where: { id: active.id },
    data: {
      status: "CLOSED",
      endedAt: now,
      endReason,
    },
    select: {
      id: true,
      trainerId: true,
      runNumber: true,
      status: true,
      wipeCountAtStart: true,
    },
  });

  const nextNumber = active.runNumber + 1;
  const next = await tx.trainerRun.create({
    data: {
      trainerId: trainer.id,
      runNumber: nextNumber,
      status: "ACTIVE",
      wipeCountAtStart: trainer.wipeCount + 1,
      startedAt: now,
    },
    select: {
      id: true,
      trainerId: true,
      runNumber: true,
      status: true,
      wipeCountAtStart: true,
    },
  });

  await tx.trainerProfile.update({
    where: { id: trainer.id },
    data: { activeRunId: next.id },
  });

  return { closed, next };
}

/** Clear run history and start a fresh run 1 (GM hard reset). */
export async function resetRunsForFreshStartInTx(
  tx: TxClient,
  trainerId: string,
): Promise<TrainerRunRow> {
  await tx.trainerProfile.update({
    where: { id: trainerId },
    data: { activeRunId: null },
  });
  await tx.pokemonEntry.updateMany({
    where: { trainerId },
    data: { runId: null },
  });
  await tx.trainerRun.deleteMany({ where: { trainerId } });
  return createInitialActiveRunInTx(tx, trainerId);
}
