import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import { clampEvs, clampIvs, IvsSchema, parseStatSpread } from "@/lib/stats";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";

export type BoardSnapshotTrigger = "IMPORT" | "WIPE" | "GM_RESET";

export type TrainerBoardSnapshotPayload = {
  wipeCount: number;
  reviveUsed: boolean;
  mainSquadLocked: boolean;
  earnedBadgeKeys: string[];
  pokemon: PokemonEntry[];
};

export type TrainerBoardSnapshotSummary = {
  id: string;
  trigger: BoardSnapshotTrigger;
  label: string | null;
  createdAt: string;
  wipeCount: number;
  summary: string;
  runId?: string | null;
};

/** Keep the most recent N snapshots per trainer. */
export const BOARD_SNAPSHOT_RETENTION = 30;

type TxClient = Parameters<
  Parameters<ReturnType<typeof getPrisma>["$transaction"]>[0]
>[0];

type DbPokemonRow = {
  id: string;
  slot: PokemonSlot;
  partyIndex: number;
  nickname: string | null;
  species: string;
  pokedexId: number | null;
  isShiny: boolean;
  types: string[];
  nature: string | null;
  level: number | null;
  ability: string | null;
  catchRoute: string | null;
  heldItem: string | null;
  moves: string[];
  ivs: unknown;
  evs: unknown;
  causeOfDeath: string | null;
  diedOnRun: number | null;
  runId: string | null;
};

function mapPokemonRow(p: DbPokemonRow): PokemonEntry {
  return {
    id: p.id,
    slot: p.slot,
    partyIndex: p.partyIndex,
    nickname: p.nickname,
    species: p.species,
    pokedexId: p.pokedexId,
    isShiny: p.isShiny,
    types: resolvePokemonTypes({
      types: p.types,
      pokedexId: p.pokedexId,
      species: p.species,
    }),
    nature: p.nature,
    level: p.level,
    ability: p.ability,
    catchRoute: p.catchRoute,
    heldItem: p.heldItem,
    moves: p.moves,
    ivs: (() => {
      if (p.ivs == null) return null;
      const parsed = IvsSchema.safeParse(p.ivs);
      return clampIvs(
        parsed.success ? parsed.data : (parseStatSpread(p.ivs) ?? undefined),
      );
    })(),
    evs: p.evs != null ? clampEvs(parseStatSpread(p.evs) ?? undefined) : null,
    causeOfDeath: p.causeOfDeath,
    diedOnRun: p.diedOnRun ?? null,
    runId: p.runId ?? null,
  };
}

export function buildSnapshotSummaryLine(
  payload: Pick<
    TrainerBoardSnapshotPayload,
    "pokemon" | "wipeCount" | "earnedBadgeKeys"
  >,
): string {
  const main = payload.pokemon.filter((p) => p.slot === "MAIN").length;
  const reserves = payload.pokemon.filter((p) => p.slot === "RESERVE").length;
  const graves = payload.pokemon.filter((p) => p.slot === "GRAVEYARD").length;
  const badges = payload.earnedBadgeKeys.length;
  const parts = [
    `${main} Main`,
    `${reserves} reserve${reserves === 1 ? "" : "s"}`,
    `${graves} grave${graves === 1 ? "" : "s"}`,
  ];
  if (badges > 0) {
    parts.push(`${badges} badge${badges === 1 ? "" : "s"}`);
  }
  if (payload.wipeCount > 0) {
    parts.push(`Wipe #${payload.wipeCount}`);
  }
  return parts.join(" · ");
}

export function defaultSnapshotLabel(
  trigger: BoardSnapshotTrigger,
  wipeCount: number,
): string {
  switch (trigger) {
    case "IMPORT":
      return "Pre-import";
    case "WIPE":
      return `Wipe #${wipeCount + 1}`;
    case "GM_RESET":
      return "Pre-GM reset";
  }
}

function isWorthCapturing(payload: TrainerBoardSnapshotPayload): boolean {
  return (
    payload.pokemon.length > 0 ||
    payload.earnedBadgeKeys.length > 0 ||
    payload.wipeCount > 0 ||
    payload.reviveUsed
  );
}

type CaptureSnapshotInput = {
  challengeId: string;
  trainerId: string;
  actorId?: string | null;
  trigger: BoardSnapshotTrigger;
  label?: string | null;
  /** When omitted, uses the trainer's activeRunId. */
  runId?: string | null;
};

const SNAPSHOT_SAVEPOINT = "board_snapshot_capture";

/**
 * Capture a point-in-time board copy inside an open transaction.
 *
 * Fail-open: a snapshot problem must never block the wipe/reset/import that
 * asked for it. Postgres aborts the whole transaction on any failed statement,
 * so catching the error is not enough on its own — every later statement would
 * fail with 25P02 and mask the real cause. The capture therefore runs inside a
 * savepoint that we roll back to, which leaves the parent transaction usable.
 */
export async function captureTrainerBoardSnapshotInTx(
  tx: TxClient,
  input: CaptureSnapshotInput,
): Promise<string | null> {
  await tx.$executeRawUnsafe(`SAVEPOINT ${SNAPSHOT_SAVEPOINT}`);
  try {
    const label = await captureSnapshot(tx, input);
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${SNAPSHOT_SAVEPOINT}`);
    return label;
  } catch (error) {
    console.error("[board-snapshot] capture failed (fail-open)", {
      trainerId: input.trainerId,
      trigger: input.trigger,
      error,
    });
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${SNAPSHOT_SAVEPOINT}`);
    return null;
  }
}

async function captureSnapshot(
  tx: TxClient,
  input: CaptureSnapshotInput,
): Promise<string | null> {
  const trainer = await tx.trainerProfile.findUnique({
    where: { id: input.trainerId },
    select: {
      wipeCount: true,
      reviveUsed: true,
      mainSquadLocked: true,
      activeRunId: true,
      pokemon: true,
      badges: {
        where: { earned: true },
        select: { badge: { select: { key: true } } },
      },
    },
  });
  if (!trainer) return null;

  const payload: TrainerBoardSnapshotPayload = {
    wipeCount: trainer.wipeCount,
    reviveUsed: trainer.reviveUsed,
    mainSquadLocked: trainer.mainSquadLocked,
    earnedBadgeKeys: trainer.badges.map((b) => b.badge.key),
    pokemon: trainer.pokemon.map((p) => mapPokemonRow(p as DbPokemonRow)),
  };

  if (!isWorthCapturing(payload)) return null;

  const label =
    input.label ?? defaultSnapshotLabel(input.trigger, trainer.wipeCount);
  const runId =
    input.runId !== undefined ? input.runId : trainer.activeRunId;

  await tx.trainerBoardSnapshot.create({
    data: {
      challengeId: input.challengeId,
      trainerId: input.trainerId,
      runId: runId ?? null,
      actorId: input.actorId ?? null,
      trigger: input.trigger,
      label,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  const stale = await tx.trainerBoardSnapshot.findMany({
    where: { trainerId: input.trainerId },
    orderBy: { createdAt: "desc" },
    skip: BOARD_SNAPSHOT_RETENTION,
    select: { id: true },
  });
  if (stale.length > 0) {
    await tx.trainerBoardSnapshot.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  }

  return label;
}

export function parseSnapshotPayload(
  raw: unknown,
): TrainerBoardSnapshotPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.pokemon)) return null;

  const pokemon: PokemonEntry[] = [];
  for (const row of obj.pokemon) {
    if (!row || typeof row !== "object") continue;
    const p = row as Record<string, unknown>;
    if (typeof p.species !== "string" || typeof p.slot !== "string") continue;
    const slot = p.slot as PokemonSlot;
    if (
      slot !== "MAIN" &&
      slot !== "RESERVE" &&
      slot !== "GRAVEYARD" &&
      slot !== "ENCOUNTERED"
    ) {
      continue;
    }
    pokemon.push({
      id: typeof p.id === "string" ? p.id : `snap-${pokemon.length}`,
      slot,
      partyIndex: typeof p.partyIndex === "number" ? p.partyIndex : 0,
      nickname: typeof p.nickname === "string" ? p.nickname : null,
      species: p.species,
      pokedexId: typeof p.pokedexId === "number" ? p.pokedexId : null,
      isShiny: Boolean(p.isShiny),
      types: resolvePokemonTypes({
        types: Array.isArray(p.types)
          ? p.types.filter((t): t is string => typeof t === "string")
          : [],
        pokedexId: typeof p.pokedexId === "number" ? p.pokedexId : null,
        species: p.species,
      }),
      nature: typeof p.nature === "string" ? p.nature : null,
      level: typeof p.level === "number" ? p.level : null,
      ability: typeof p.ability === "string" ? p.ability : null,
      catchRoute: typeof p.catchRoute === "string" ? p.catchRoute : null,
      heldItem: typeof p.heldItem === "string" ? p.heldItem : null,
      moves: Array.isArray(p.moves)
        ? p.moves.filter((m): m is string => typeof m === "string")
        : [],
      ivs: (() => {
        if (p.ivs == null) return null;
        const parsed = IvsSchema.safeParse(p.ivs);
        return clampIvs(
          parsed.success ? parsed.data : (parseStatSpread(p.ivs) ?? undefined),
        );
      })(),
      evs: p.evs != null ? clampEvs(parseStatSpread(p.evs) ?? undefined) : null,
      causeOfDeath:
        typeof p.causeOfDeath === "string" ? p.causeOfDeath : null,
      diedOnRun: typeof p.diedOnRun === "number" ? p.diedOnRun : null,
      runId: typeof p.runId === "string" ? p.runId : null,
    });
  }

  return {
    wipeCount: typeof obj.wipeCount === "number" ? obj.wipeCount : 0,
    reviveUsed: Boolean(obj.reviveUsed),
    mainSquadLocked: Boolean(obj.mainSquadLocked),
    earnedBadgeKeys: Array.isArray(obj.earnedBadgeKeys)
      ? obj.earnedBadgeKeys.filter((k): k is string => typeof k === "string")
      : [],
    pokemon,
  };
}

export function snapshotTriggerLabel(trigger: BoardSnapshotTrigger): string {
  switch (trigger) {
    case "IMPORT":
      return "Import";
    case "WIPE":
      return "Wipe";
    case "GM_RESET":
      return "GM reset";
  }
}
