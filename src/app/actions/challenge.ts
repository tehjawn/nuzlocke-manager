"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { findSpecies } from "@/data/species";
import {
  bumpActivityReactionRev,
  encodeActivityHead,
  publishActivityHead,
  readActivityHead,
  withReactionHead,
} from "@/lib/activity-watermark";
import { getPrisma } from "@/lib/db";
import {
  getAccessForChallenge,
  requireGm,
  requireTrainerEditAccess,
  requireUserId,
} from "@/lib/permissions";
import { readGmLensOn } from "@/lib/gm-lens.server";
import {
  AccountUpdateSchema,
  PokemonEntryInputSchema,
  PokemonSlotSchema,
  TrainerBoardUpdateSchema,
} from "@/lib/types";
import { sanitizeHandle } from "@/lib/handles";
import {
  CUSTOM_AVATAR_PREFIX,
  canUseCustomAvatarUrl,
  customAvatarKey,
  parseAvatarKey,
} from "@/lib/sprites";
import {
  ACTIVITY_COALESCE_WINDOW_MS,
  parseActivityCoalesceMeta,
  resolveBadgeCoalesce,
  resolveCatchCoalesce,
  resolveDeathCoalesce,
  resolveLocksCoalesce,
  resolveRulesCoalesce,
  resolveStatusCoalesce,
  type ActivityCoalesceCategory,
  type ActivityCoalesceMeta,
} from "@/lib/activity-coalesce";
import {
  createInitialActiveRunInTx,
  closeActiveRunAndStartNextInTx,
  ensureActiveRunInTx,
  setActiveRunReviveInTx,
} from "@/lib/trainer-runs";
import {
  currentRunNumber,
  memorialRowsAfterWipe,
} from "@/lib/wipe-memorial";
import {
  DEFAULT_IMPORT_REPLACE_SLOTS,
  importedGravesToAppend,
} from "@/lib/import-memorial";
import {
  memorialBackfillCandidates,
  type MemorialBackfillCandidate,
} from "@/lib/memorial-backfill";
import {
  canUseCustomTextureUrl,
  customTextureKey,
  parseCustomTextureUrl,
} from "@/lib/custom-texture";
import { isAvatarBackgroundKey } from "@/data/avatar-backgrounds";
import { isCardBackgroundKey } from "@/data/card-backgrounds";
import { findPokemonById, searchPokemonIndex } from "@/data/pokemon-index";
import {
  getChallenge,
  getChallengeAccessFields,
  listChallengeActivities,
  type ActivityPage,
} from "@/lib/challenges";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import {
  IvsSchema,
  isEmptySpread,
  StatSpreadSchema,
  type StatSpread,
} from "@/lib/stats";
import { Prisma } from "@/generated/prisma/client";
import { dispatchDiscordWebhook } from "@/lib/discord-webhook";
import {
  buildChallengeCsv,
  buildChallengeExport,
} from "@/lib/export-challenge";
import { canViewChallenge } from "@/lib/challenge-access";
import { ChallengeStatusSchema } from "@/lib/types";
import {
  buildFirstRoundPairings,
  buildRoundPairings,
  roundIsComplete,
} from "@/lib/tournament";
import {
  buildSnapshotSummaryLine,
  captureTrainerBoardSnapshotInTx,
  parseSnapshotPayload,
  snapshotTriggerLabel,
  type BoardSnapshotTrigger,
  type TrainerBoardSnapshotPayload,
  type TrainerBoardSnapshotSummary,
} from "@/lib/board-snapshot";

function jsonStatOrNull(
  value: StatSpread | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null || isEmptySpread(value)) return Prisma.DbNull;
  return value;
}

/** League board + trainer board only — avoids refreshing Setup/Rules/FAQ chrome. */
function revalidateBoardViews(slug: string, trainerId?: string) {
  updateTag(`season:${slug}:board`);
  revalidateTag(`season:${slug}`, "max");
  revalidatePath(`/challenges/${slug}`);
  revalidatePath(`/challenges/${slug}/memorial`);
  revalidatePath(`/challenges/${slug}/activity`);
  if (trainerId) {
    revalidatePath(`/challenges/${slug}/trainers/${trainerId}`);
  }
}

/** Heavier season-wide invalidation (GM/meta/join flows). */
function revalidateChallenge(slug: string, trainerId?: string) {
  updateTag(`season:${slug}`);
  updateTag(`season:${slug}:board`);
  updateTag(`season:${slug}:meta`);
  revalidateTag("seasons:index", "max");
  revalidateBoardViews(slug, trainerId);
  revalidatePath(`/challenges/${slug}/setup`);
  revalidatePath(`/challenges/${slug}/rules`);
  revalidatePath(`/challenges/${slug}/tools`);
  revalidatePath(`/challenges/${slug}/gm`);
  revalidatePath(`/challenges/${slug}/join`);
  revalidatePath(`/challenges/${slug}/tournament`);
  revalidatePath("/challenges");
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

type ActivityTypeName =
  | "STATUS_UPDATE"
  | "CATCH"
  | "DEATH"
  | "BADGE_EARNED"
  | "BADGE_REVOKED"
  | "REVIVE_USED"
  | "REVIVE_RESET"
  | "MAIN_SQUAD_LOCKED"
  | "MEMBER_JOINED"
  | "TRAINER_CLAIMED"
  | "RULE_UPDATED"
  | "NOTE"
  | "WIPE";

type ActivityDb = {
  activityEvent: {
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy: Record<string, unknown> | Record<string, unknown>[];
      select: { id: true; metadata: true; trainerId: true };
    }) => Promise<{
      id: string;
      metadata: unknown;
      trainerId: string | null;
    } | null>;
    create: (args: {
      data: {
        challengeId: string;
        actorId?: string;
        trainerId?: string | null;
        type: ActivityTypeName;
        message: string;
        metadata?: ActivityCoalesceMeta;
      };
    }) => Promise<{ id: string; createdAt: Date }>;
    update: (args: {
      where: { id: string };
      data: {
        type: ActivityTypeName;
        message: string;
        metadata: ActivityCoalesceMeta;
        createdAt: Date;
        trainerId?: string | null;
      };
    }) => Promise<unknown>;
  };
};

type CoalesceWrite = {
  category: ActivityCoalesceCategory;
  /** trainer = same board; actor = same GM; challenge = season-wide (rules). */
  scope: "trainer" | "actor" | "challenge";
  windowMs?: number;
  /** Legacy rows without metadata (e.g. old RULE_UPDATED). */
  legacyTypes?: ActivityTypeName[];
  resolve: (prev: ActivityCoalesceMeta | null) => {
    type: ActivityTypeName;
    message: string;
    metadata: ActivityCoalesceMeta;
    trainerId?: string | null;
  } | null;
};

/**
 * Facebook-style feed grouping: within the quiet window, merge into the open
 * row for this category instead of stacking near-duplicates. Discord fires only
 * when a new row is created — coalesce updates stay silent.
 */
async function writeActivityEvent(
  db: ActivityDb,
  input: {
    challengeId: string;
    actorId?: string;
    trainerId?: string;
    type?: ActivityTypeName;
    message?: string;
    metadata?: ActivityCoalesceMeta;
    coalesce?: CoalesceWrite;
    /** When false, caller posts Discord after its own transaction commits. */
    dispatchDiscord?: boolean;
  },
): Promise<{ created: boolean; type: ActivityTypeName; message: string }> {
  let type = input.type;
  let message = input.message;
  let metadata: ActivityCoalesceMeta | undefined = input.metadata;
  let trainerId: string | null | undefined = input.trainerId;
  let created = true;

  if (input.coalesce) {
    const windowMs = input.coalesce.windowMs ?? ACTIVITY_COALESCE_WINDOW_MS;
    const since = new Date(Date.now() - windowMs);
    const scopeWhere =
      input.coalesce.scope === "trainer" && input.trainerId
        ? { trainerId: input.trainerId }
        : input.coalesce.scope === "actor" && input.actorId
          ? { actorId: input.actorId }
          : {};

    let existing = await db.activityEvent.findFirst({
      where: {
        challengeId: input.challengeId,
        createdAt: { gte: since },
        metadata: {
          path: ["category"],
          equals: input.coalesce.category,
        },
        ...scopeWhere,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true, trainerId: true },
    });

    // Pre-metadata RULE_UPDATED / STATUS rows still coalesce by type.
    if (!existing && input.coalesce.legacyTypes?.length) {
      existing = await db.activityEvent.findFirst({
        where: {
          challengeId: input.challengeId,
          createdAt: { gte: since },
          type: { in: input.coalesce.legacyTypes },
          ...scopeWhere,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, metadata: true, trainerId: true },
      });
    }

    const resolved = input.coalesce.resolve(
      parseActivityCoalesceMeta(existing?.metadata),
    );
    if (!resolved) {
      throw new Error("Activity coalesce produced an empty update");
    }
    type = resolved.type;
    message = resolved.message;
    metadata = resolved.metadata;
    if (resolved.trainerId !== undefined) {
      trainerId = resolved.trainerId;
    }

    if (existing) {
      await db.activityEvent.update({
        where: { id: existing.id },
        data: {
          type,
          message,
          metadata,
          createdAt: new Date(),
          ...(trainerId !== undefined ? { trainerId } : {}),
        },
      });
      created = false;
      void publishActivityHead(
        input.challengeId,
        encodeActivityHead(new Date(), existing.id),
      );
    }
  }

  if (type == null || message == null) {
    throw new Error("Activity event requires type and message");
  }

  if (created) {
    const row = await db.activityEvent.create({
      data: {
        challengeId: input.challengeId,
        actorId: input.actorId,
        trainerId: trainerId ?? null,
        type,
        message,
        ...(metadata ? { metadata } : {}),
      },
    });
    void publishActivityHead(
      input.challengeId,
      encodeActivityHead(row.createdAt, row.id),
    );

    // Don't await — Discord outages must not block board saves.
    // Skip on coalesce updates so the channel isn't re-pinged for every merge.
    if (input.dispatchDiscord !== false) {
      void dispatchDiscordWebhook({
        challengeId: input.challengeId,
        type,
        message,
      });
    }
  }

  return { created, type, message };
}

async function logActivity(input: {
  challengeId: string;
  actorId?: string;
  trainerId?: string;
  type?: ActivityTypeName;
  message?: string;
  metadata?: ActivityCoalesceMeta;
  coalesce?: CoalesceWrite;
}) {
  return writeActivityEvent(getPrisma() as unknown as ActivityDb, input);
}


export async function updateAccountAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const data = AccountUpdateSchema.parse(raw);
    await getPrisma().user.update({
      where: { id: userId },
      data: {
        displayName: data.displayName,
        bio: data.bio ?? null,
        image: data.image ?? undefined,
      },
    });
    revalidatePath("/account");
    return { ok: true, message: "Account updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function joinChallengeAction(input: {
  slug: string;
  inviteCode: string;
}): Promise<ActionResult & { trainerId?: string }> {
  try {
    const userId = await requireUserId();
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { slug: input.slug },
    });
    if (!challenge) return { ok: false, error: "Challenge not found" };

    const code = input.inviteCode.trim();
    let role: "PLAYER" | "GAME_MASTER" | "SPECTATOR" = "PLAYER";
    if (challenge.gmInviteCode && code === challenge.gmInviteCode) {
      role = "GAME_MASTER";
    } else if (
      challenge.playerInviteCode &&
      code === challenge.playerInviteCode
    ) {
      role = "PLAYER";
    } else {
      return { ok: false, error: "Invalid invite code" };
    }

    await prisma.challengeMembership.upsert({
      where: {
        challengeId_userId: { challengeId: challenge.id, userId },
      },
      create: { challengeId: challenge.id, userId, role },
      update: { role },
    });

    const { ensureTrainerForChallenge } = await import("@/lib/provision");
    const provisioned = await ensureTrainerForChallenge({
      userId,
      slug: challenge.slug,
      allowAutoJoin: true,
    });

    await logActivity({
      challengeId: challenge.id,
      actorId: userId,
      type: "MEMBER_JOINED",
      message: `Joined as ${role.replace("_", " ").toLowerCase()}`,
    });

    revalidateChallenge(challenge.slug);
    return {
      ok: true,
      message:
        role === "GAME_MASTER"
          ? "You're a Game Master — open your board or the GM console."
          : "You're in — open your trainer board.",
      trainerId: provisioned.ok ? provisioned.trainerId : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Join failed" };
  }
}

/** No-code path for public seasons: membership + trainer board. */
export async function enterChallengeAction(input: {
  slug: string;
}): Promise<ActionResult & { trainerId?: string }> {
  try {
    const userId = await requireUserId();
    const { ensureTrainerForChallenge } = await import("@/lib/provision");
    const result = await ensureTrainerForChallenge({
      userId,
      slug: input.slug,
      allowAutoJoin: true,
    });
    if (!result.ok) {
      if (result.reason === "invite_required") {
        return {
          ok: false,
          error: "This season needs an invite code. Ask a GM.",
        };
      }
      return { ok: false, error: "Could not enter challenge" };
    }
    revalidateChallenge(result.slug, result.trainerId);
    return {
      ok: true,
      message: result.created ? "Trainer board created" : "Welcome back",
      trainerId: result.trainerId,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Enter failed" };
  }
}

export async function claimTrainerAction(input: {
  slug: string;
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const prisma = getPrisma();
    const trainer = await prisma.trainerProfile.findFirst({
      where: { id: input.trainerId, challenge: { slug: input.slug } },
      include: { challenge: true },
    });
    if (!trainer) return { ok: false, error: "Trainer not found" };

    const access = await getAccessForChallenge(trainer.challengeId);
    if (!access || (access.role !== "PLAYER" && !access.isGm)) {
      return { ok: false, error: "Join the challenge before claiming a trainer" };
    }

    if (trainer.userId && trainer.userId !== userId && !access.isGm) {
      return { ok: false, error: "Trainer already claimed" };
    }

    const existing = await prisma.trainerProfile.findFirst({
      where: {
        challengeId: trainer.challengeId,
        userId,
        NOT: { id: trainer.id },
      },
    });
    if (existing && !access.isGm) {
      return {
        ok: false,
        error: `You already claimed ${existing.handle}. Ask a GM to reassign.`,
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (existing) {
          // One claimed board per user: GM reassignment frees the previous claim.
          await tx.trainerProfile.update({
            where: { id: existing.id },
            data: { userId: null },
          });
        }
        await tx.trainerProfile.update({
          where: { id: trainer.id },
          data: { userId },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return { ok: false, error: "Trainer already claimed" };
      }
      throw e;
    }

    await logActivity({
      challengeId: trainer.challengeId,
      actorId: userId,
      trainerId: trainer.id,
      type: "TRAINER_CLAIMED",
      message: `Claimed trainer ${trainer.handle}`,
    });

    revalidateChallenge(trainer.challenge.slug, trainer.id);
    return { ok: true, message: `Claimed ${trainer.handle}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Claim failed" };
  }
}

export async function updateTrainerBoardAction(input: {
  trainerId: string;
  statusText?: string | null;
  statusEmoji?: string | null;
  avatarSpriteKey?: string | null;
  avatarBackgroundKey?: string | null;
  cardBackgroundKey?: string | null;
  reviveUsed?: boolean;
  handle?: string;
  realName?: string | null;
}): Promise<ActionResult> {
  try {
    const parsed = TrainerBoardUpdateSchema.safeParse({
      statusText: input.statusText,
      statusEmoji: input.statusEmoji,
      avatarSpriteKey: input.avatarSpriteKey,
      avatarBackgroundKey: input.avatarBackgroundKey,
      cardBackgroundKey: input.cardBackgroundKey,
      reviveUsed: input.reviveUsed,
      handle: input.handle,
      realName: input.realName,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === "avatarBackgroundKey") {
        return {
          ok: false,
          error: "Pick an avatar backdrop from the list or import your own",
        };
      }
      if (issue?.path[0] === "cardBackgroundKey") {
        return {
          ok: false,
          error: "Pick a card background from the list or import your own",
        };
      }
      return { ok: false, error: issue?.message ?? "Invalid input" };
    }

    const { trainer, access, userId } = await requireTrainerEditAccess(
      input.trainerId,
    );
    const prisma = getPrisma();
    const updates = parsed.data;

    if (
      updates.statusEmoji !== undefined &&
      updates.statusEmoji != null &&
      !isValidStatusEmoji(updates.statusEmoji)
    ) {
      return { ok: false, error: "Pick a single emoji for your status" };
    }

    const data: {
      statusText?: string | null;
      statusEmoji?: string | null;
      avatarSpriteKey?: string | null;
      avatarBackgroundKey?: string | null;
      cardBackgroundKey?: string | null;
      reviveUsed?: boolean;
      realName?: string | null;
      handle?: string;
    } = {};
    let reviveTouched = false;

    if (updates.statusText !== undefined) data.statusText = updates.statusText;
    if (updates.statusEmoji !== undefined) data.statusEmoji = updates.statusEmoji;
    if (updates.avatarBackgroundKey !== undefined) {
      const raw = updates.avatarBackgroundKey;
      if (raw == null) {
        data.avatarBackgroundKey = null;
      } else if (isAvatarBackgroundKey(raw)) {
        data.avatarBackgroundKey = raw;
      } else {
        const url = parseCustomTextureUrl(raw);
        if (!url) {
          return { ok: false, error: "Invalid custom backdrop" };
        }
        const currentUrl = parseCustomTextureUrl(trainer.avatarBackgroundKey);
        const alreadySaved = currentUrl === url;
        if (
          !canUseCustomTextureUrl(
            url,
            "avatar-bg",
            userId,
            trainer.userId,
            alreadySaved,
          )
        ) {
          return { ok: false, error: "Invalid custom backdrop" };
        }
        data.avatarBackgroundKey = customTextureKey(url);
      }
    }
    if (updates.cardBackgroundKey !== undefined) {
      const raw = updates.cardBackgroundKey;
      if (raw == null) {
        data.cardBackgroundKey = null;
      } else if (isCardBackgroundKey(raw)) {
        data.cardBackgroundKey = raw;
      } else {
        const url = parseCustomTextureUrl(raw);
        if (!url) {
          return { ok: false, error: "Invalid custom card background" };
        }
        const currentUrl = parseCustomTextureUrl(trainer.cardBackgroundKey);
        const alreadySaved = currentUrl === url;
        if (
          !canUseCustomTextureUrl(
            url,
            "card-bg",
            userId,
            trainer.userId,
            alreadySaved,
          )
        ) {
          return { ok: false, error: "Invalid custom card background" };
        }
        data.cardBackgroundKey = customTextureKey(url);
      }
    }
    if (updates.avatarSpriteKey !== undefined) {
      const raw = updates.avatarSpriteKey ?? "";
      if (raw.toLowerCase().startsWith(CUSTOM_AVATAR_PREFIX)) {
        const avatar = parseAvatarKey(raw);
        if (avatar.kind !== "custom") {
          return { ok: false, error: "Invalid custom avatar" };
        }
        const current = parseAvatarKey(trainer.avatarSpriteKey);
        const alreadySaved =
          current.kind === "custom" && current.url === avatar.url;
        if (!canUseCustomAvatarUrl(avatar.url, userId, alreadySaved)) {
          return { ok: false, error: "Invalid custom avatar" };
        }
        data.avatarSpriteKey = customAvatarKey(avatar.url);
      } else {
        const avatar = parseAvatarKey(raw);
        if (avatar.kind === "pokemon" || avatar.kind === "pokemon-ani") {
          data.avatarSpriteKey = raw;
        } else if (avatar.kind === "trainer") {
          data.avatarSpriteKey = avatar.key;
        } else {
          return { ok: false, error: "Invalid custom avatar" };
        }
      }
    }
    if (updates.realName !== undefined) data.realName = updates.realName;

    if (updates.handle !== undefined) {
      const nextHandle = sanitizeHandle(updates.handle);
      if (!nextHandle) {
        return { ok: false, error: "Nickname can’t be empty" };
      }
      if (nextHandle !== trainer.handle) {
        const clash = await prisma.trainerProfile.findUnique({
          where: {
            challengeId_handle: {
              challengeId: trainer.challengeId,
              handle: nextHandle,
            },
          },
        });
        if (clash && clash.id !== trainer.id) {
          return {
            ok: false,
            error: `Nickname “${nextHandle}” is already taken this season`,
          };
        }
        data.handle = nextHandle;
      }
    }

    if (updates.reviveUsed !== undefined) {
      if (updates.reviveUsed && !trainer.reviveUsed) {
        await prisma.$transaction(async (tx) => {
          await setActiveRunReviveInTx(
            tx,
            {
              id: trainer.id,
              wipeCount: trainer.wipeCount,
              activeRunId: trainer.activeRunId,
            },
            true,
          );
        });
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "REVIVE_USED",
          message: `${data.handle ?? trainer.handle} used their Revive Token`,
        });
        delete data.reviveUsed;
        reviveTouched = true;
      } else if (!updates.reviveUsed && trainer.reviveUsed && access.isGm) {
        await prisma.$transaction(async (tx) => {
          await setActiveRunReviveInTx(
            tx,
            {
              id: trainer.id,
              wipeCount: trainer.wipeCount,
              activeRunId: trainer.activeRunId,
            },
            false,
          );
        });
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "REVIVE_RESET",
          message: `GM reset Revive Token for ${data.handle ?? trainer.handle}`,
        });
        delete data.reviveUsed;
        reviveTouched = true;
      } else if (updates.reviveUsed === trainer.reviveUsed) {
        // no-op
      } else if (!access.isGm && !updates.reviveUsed) {
        return { ok: false, error: "Only a GM can reset a used Revive Token" };
      }
    }

    const statusChanged =
      (updates.statusText !== undefined &&
        updates.statusText !== trainer.statusText) ||
      (updates.statusEmoji !== undefined &&
        updates.statusEmoji !== trainer.statusEmoji);
    if (statusChanged) {
      const handle = data.handle ?? trainer.handle;
      await logActivity({
        challengeId: trainer.challengeId,
        actorId: userId,
        trainerId: trainer.id,
        coalesce: {
          category: "status",
          scope: "trainer",
          legacyTypes: ["STATUS_UPDATE"],
          resolve: () => resolveStatusCoalesce(handle),
        },
      });
    }

    if (Object.keys(data).length === 0 && !reviveTouched) {
      return { ok: true, message: "Nothing to update" };
    }

    if (Object.keys(data).length > 0) {
      await prisma.trainerProfile.update({
        where: { id: trainer.id },
        data,
      });
    }

    // Soft refresh: league cards + this trainer. Client keeps optimistic drafts.
    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Board updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

/** Restart the living run: memorializes Main/Reserve, clears Encountered +
 *  badges, closes the active TrainerRun and opens the next. */
export async function recordWipeAction(input: {
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const { trainer, userId } = await requireTrainerEditAccess(input.trainerId);

    const prisma = getPrisma();
    let wipeCount = 0;
    let wipeMessage = "";

    await prisma.$transaction(async (tx) => {
      const activeBefore = await ensureActiveRunInTx(tx, {
        id: trainer.id,
        wipeCount: trainer.wipeCount,
        activeRunId: trainer.activeRunId,
      });
      const earnedRows = await tx.badgeProgress.findMany({
        where: { trainerId: trainer.id, earned: true },
        select: { badge: { select: { key: true } } },
      });
      const earnedBadgeKeys = earnedRows.map((row) => row.badge.key);

      await captureTrainerBoardSnapshotInTx(tx, {
        challengeId: trainer.challengeId,
        trainerId: trainer.id,
        actorId: userId,
        trigger: "WIPE",
        runId: activeBefore.id,
      });

      const { closed, next } = await closeActiveRunAndStartNextInTx(
        tx,
        {
          id: trainer.id,
          wipeCount: trainer.wipeCount,
          activeRunId: activeBefore.id,
        },
        "WIPE",
        {
          reviveUsed: trainer.reviveUsed,
          earnedBadgeKeys,
        },
      );
      const nextWipe = closed.runNumber;

      const board = await tx.pokemonEntry.findMany({
        where: { trainerId: trainer.id },
        select: {
          id: true,
          slot: true,
          partyIndex: true,
          causeOfDeath: true,
          diedOnRun: true,
          runId: true,
        },
      });
      const after = memorialRowsAfterWipe(board, nextWipe, closed.id);
      const keepIds = new Set(after.map((p) => p.id));
      const byId = new Map(after.map((p) => [p.id, p]));
      const dropIds = board
        .filter((row) => !keepIds.has(row.id))
        .map((row) => row.id);

      for (const row of board) {
        const memorial = byId.get(row.id);
        if (!memorial) continue;
        if (
          row.slot === memorial.slot &&
          row.partyIndex === memorial.partyIndex &&
          row.causeOfDeath === memorial.causeOfDeath &&
          row.diedOnRun === memorial.diedOnRun &&
          row.runId === memorial.runId
        ) {
          continue;
        }
        await tx.pokemonEntry.update({
          where: { id: row.id },
          data: {
            slot: memorial.slot,
            partyIndex: memorial.partyIndex,
            causeOfDeath: memorial.causeOfDeath,
            diedOnRun: memorial.diedOnRun,
            runId: memorial.runId,
          },
        });
      }

      if (dropIds.length > 0) {
        await tx.pokemonEntry.deleteMany({
          where: { id: { in: dropIds } },
        });
      }
      await tx.badgeProgress.updateMany({
        where: { trainerId: trainer.id },
        data: { earned: false, earnedAt: null },
      });
      const updated = await tx.trainerProfile.update({
        where: { id: trainer.id },
        data: {
          wipeCount: { increment: 1 },
          // Living board is empty — unlock so the run can be rebuilt.
          mainSquadLocked: false,
          activeRunId: next.id,
          // Fresh run gets a fresh revive token.
          reviveUsed: false,
        },
        select: { wipeCount: true },
      });
      wipeCount = updated.wipeCount;
      const memorializedCount =
        after.length - board.filter((p) => p.slot === "GRAVEYARD").length;
      wipeMessage =
        memorializedCount > 0
          ? `${trainer.handle} restarted their run (wipe #${wipeCount}) — ${memorializedCount} partner${memorializedCount === 1 ? "" : "s"} memorialized`
          : `${trainer.handle} restarted their run (wipe #${wipeCount})`;
      await tx.activityEvent.create({
        data: {
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "WIPE",
          message: wipeMessage,
        },
      });
    });

    void dispatchDiscordWebhook({
      challengeId: trainer.challengeId,
      type: "WIPE",
      message: wipeMessage,
    });

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: `Wipe #${wipeCount} recorded` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Wipe failed" };
  }
}

type TxClient = Parameters<
  Parameters<ReturnType<typeof getPrisma>["$transaction"]>[0]
>[0];

/**
 * Official clean start for one trainer: clear run progress (every Pokémon slot
 * including memorial, badges, wipe counter, revive, main lock). Keeps player
 * identity: handle, real name, avatar, backdrops, and status.
 */
async function hardResetTrainerInTx(
  tx: TxClient,
  trainerId: string,
): Promise<void> {
  await tx.trainerProfile.update({
    where: { id: trainerId },
    data: { activeRunId: null },
  });
  await tx.pokemonEntry.deleteMany({ where: { trainerId } });
  await tx.trainerRun.deleteMany({ where: { trainerId } });
  await tx.badgeProgress.updateMany({
    where: { trainerId },
    data: { earned: false, earnedAt: null },
  });
  await createInitialActiveRunInTx(tx, trainerId);
  await tx.trainerProfile.update({
    where: { id: trainerId },
    data: {
      reviveUsed: false,
      mainSquadLocked: false,
    },
  });
}

/** GM-only: hard-reset one trainer board to a pre-challenge blank slate. */
export async function gmResetTrainerBoardAction(input: {
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const trainer = await prisma.trainerProfile.findUnique({
      where: { id: input.trainerId },
      include: { challenge: { select: { id: true, slug: true, status: true } } },
    });
    if (!trainer) return { ok: false, error: "Trainer not found" };
    if (trainer.challenge.status === "ARCHIVED") {
      return { ok: false, error: "This season is archived and read-only" };
    }

    const { userId } = await requireGm(trainer.challengeId);

    await prisma.$transaction(async (tx) => {
      await captureTrainerBoardSnapshotInTx(tx, {
        challengeId: trainer.challengeId,
        trainerId: trainer.id,
        actorId: userId,
        trigger: "GM_RESET",
      });
      await hardResetTrainerInTx(tx, trainer.id);
      await tx.activityEvent.create({
        data: {
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "NOTE",
          message: `GM reset ${trainer.handle}'s board for a fresh start`,
        },
      });
    });

    revalidateChallenge(trainer.challenge.slug, trainer.id);
    return { ok: true, message: `${trainer.handle} board reset` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Board reset failed",
    };
  }
}

/** GM-only: hard-reset every trainer board for an official season start. */
export async function gmResetAllTrainerBoardsAction(input: {
  challengeId?: string;
  slug?: string;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const challenge = input.challengeId
      ? await prisma.challenge.findUnique({
          where: { id: input.challengeId },
          select: {
            id: true,
            slug: true,
            status: true,
            trainers: { select: { id: true } },
          },
        })
      : input.slug
        ? await prisma.challenge.findUnique({
            where: { slug: input.slug },
            select: {
              id: true,
              slug: true,
              status: true,
              trainers: { select: { id: true } },
            },
          })
        : null;
    if (!challenge) return { ok: false, error: "Challenge not found" };
    if (challenge.status === "ARCHIVED") {
      return { ok: false, error: "This season is archived and read-only" };
    }

    const { userId } = await requireGm(challenge.id);

    const count = challenge.trainers.length;
    await prisma.$transaction(async (tx) => {
      for (const trainer of challenge.trainers) {
        await captureTrainerBoardSnapshotInTx(tx, {
          challengeId: challenge.id,
          trainerId: trainer.id,
          actorId: userId,
          trigger: "GM_RESET",
        });
        await hardResetTrainerInTx(tx, trainer.id);
      }
      await tx.activityEvent.create({
        data: {
          challengeId: challenge.id,
          actorId: userId,
          type: "NOTE",
          message: `GM reset all ${count} trainer board${count === 1 ? "" : "s"} for an official season start`,
        },
      });
    });

    revalidateChallenge(challenge.slug);
    return {
      ok: true,
      message: `Reset ${count} trainer board${count === 1 ? "" : "s"}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Season board reset failed",
    };
  }
}

export type ListTrainerBoardSnapshotsResult =
  | { ok: true; snapshots: TrainerBoardSnapshotSummary[] }
  | { ok: false; error: string };

async function requireTrainerHistoryAccess(trainerId: string) {
  const prisma = getPrisma();
  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      challengeId: true,
      userId: true,
      handle: true,
      challenge: { select: { slug: true } },
    },
  });
  if (!trainer) throw new Error("Trainer not found");

  const access = await getAccessForChallenge(trainer.challengeId);
  if (!access) throw new Error("Sign in required");

  if (access.ownsTrainer(trainer.userId)) {
    return { trainer, access, isGm: access.isGm };
  }

  if (!access.isGm) {
    throw new Error("You cannot view this trainer's history");
  }
  if (!(await readGmLensOn(trainer.challenge.slug))) {
    throw new Error("Turn on GM view to browse another trainer's history");
  }
  return { trainer, access, isGm: true };
}

/** Owner or GM (with lens): list board history for a trainer (newest first). */
export async function listTrainerBoardSnapshotsAction(input: {
  trainerId: string;
}): Promise<ListTrainerBoardSnapshotsResult> {
  try {
    const { trainer } = await requireTrainerHistoryAccess(input.trainerId);
    const prisma = getPrisma();

    const rows = await prisma.trainerBoardSnapshot.findMany({
      where: { trainerId: trainer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        trigger: true,
        label: true,
        payload: true,
        createdAt: true,
        runId: true,
      },
    });

    const snapshots: TrainerBoardSnapshotSummary[] = [];
    for (const row of rows) {
      const payload = parseSnapshotPayload(row.payload);
      if (!payload) continue;
      const trigger = row.trigger as BoardSnapshotTrigger;
      snapshots.push({
        id: row.id,
        trigger,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
        wipeCount: payload.wipeCount,
        summary: buildSnapshotSummaryLine(payload),
        runId: row.runId,
      });
    }

    return { ok: true, snapshots };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load board history",
    };
  }
}

export type TrainerHistoryRunSummary = {
  id: string;
  runNumber: number;
  status: "ACTIVE" | "CLOSED";
  startedAt: string;
  endedAt: string | null;
  endReason: "WIPE" | "GM_RESET" | null;
  reviveUsed: boolean;
  earnedBadgeKeys: string[];
  snapshots: TrainerBoardSnapshotSummary[];
};

export type ListTrainerHistoryResult =
  | { ok: true; runs: TrainerHistoryRunSummary[]; canClearSnapshots: boolean }
  | { ok: false; error: string };

/** Owner or GM (with lens): runs accordion data + nested board snapshots. */
export async function listTrainerHistoryAction(input: {
  trainerId: string;
}): Promise<ListTrainerHistoryResult> {
  try {
    const { trainer, isGm } = await requireTrainerHistoryAccess(input.trainerId);
    const prisma = getPrisma();

    const [runs, snapRows] = await Promise.all([
      prisma.trainerRun.findMany({
        where: { trainerId: trainer.id },
        orderBy: { runNumber: "desc" },
        select: {
          id: true,
          runNumber: true,
          status: true,
          startedAt: true,
          endedAt: true,
          endReason: true,
          reviveUsed: true,
          earnedBadgeKeys: true,
        },
      }),
      prisma.trainerBoardSnapshot.findMany({
        where: { trainerId: trainer.id },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          trigger: true,
          label: true,
          payload: true,
          createdAt: true,
          runId: true,
        },
      }),
    ]);

    const snapsByRun = new Map<string, TrainerBoardSnapshotSummary[]>();
    const orphanSnaps: TrainerBoardSnapshotSummary[] = [];
    for (const row of snapRows) {
      const payload = parseSnapshotPayload(row.payload);
      if (!payload) continue;
      const summary: TrainerBoardSnapshotSummary = {
        id: row.id,
        trigger: row.trigger as BoardSnapshotTrigger,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
        wipeCount: payload.wipeCount,
        summary: buildSnapshotSummaryLine(payload),
        runId: row.runId,
      };
      if (row.runId) {
        const list = snapsByRun.get(row.runId) ?? [];
        list.push(summary);
        snapsByRun.set(row.runId, list);
      } else {
        orphanSnaps.push(summary);
      }
    }

    const historyRuns: TrainerHistoryRunSummary[] = runs.map((run) => ({
      id: run.id,
      runNumber: run.runNumber,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
      endReason: run.endReason,
      reviveUsed: run.reviveUsed,
      earnedBadgeKeys: run.earnedBadgeKeys,
      snapshots: snapsByRun.get(run.id) ?? [],
    }));

    // Legacy snapshots without runId: attach to matching closed run by wipeCount,
    // else leave under the active run as "ungrouped" via the newest run.
    if (orphanSnaps.length > 0 && historyRuns.length > 0) {
      for (const snap of orphanSnaps) {
        const match =
          historyRuns.find(
            (run) =>
              run.status === "CLOSED" &&
              run.runNumber === snap.wipeCount + 1,
          ) ?? historyRuns[0];
        match?.snapshots.push(snap);
      }
      for (const run of historyRuns) {
        run.snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
    }

    return { ok: true, runs: historyRuns, canClearSnapshots: isGm };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load trainer history",
    };
  }
}

export type GetTrainerBoardSnapshotResult =
  | {
      ok: true;
      snapshot: {
        id: string;
        trigger: BoardSnapshotTrigger;
        triggerLabel: string;
        label: string | null;
        createdAt: string;
        summary: string;
        payload: TrainerBoardSnapshotPayload;
      };
    }
  | { ok: false; error: string };

/** Owner or GM (with lens): load one snapshot's full board payload. */
export async function getTrainerBoardSnapshotAction(input: {
  snapshotId: string;
}): Promise<GetTrainerBoardSnapshotResult> {
  try {
    const prisma = getPrisma();
    const row = await prisma.trainerBoardSnapshot.findUnique({
      where: { id: input.snapshotId },
      select: {
        id: true,
        trainerId: true,
        challengeId: true,
        trigger: true,
        label: true,
        payload: true,
        createdAt: true,
      },
    });
    if (!row) return { ok: false, error: "Snapshot not found" };

    await requireTrainerHistoryAccess(row.trainerId);

    const payload = parseSnapshotPayload(row.payload);
    if (!payload) return { ok: false, error: "Snapshot data is unreadable" };

    const trigger = row.trigger as BoardSnapshotTrigger;
    return {
      ok: true,
      snapshot: {
        id: row.id,
        trigger,
        triggerLabel: snapshotTriggerLabel(trigger),
        label: row.label,
        createdAt: row.createdAt.toISOString(),
        summary: buildSnapshotSummaryLine(payload),
        payload,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load snapshot",
    };
  }
}

/** GM-only: permanently delete all board history snapshots for a trainer. */
export async function gmClearTrainerBoardHistoryAction(input: {
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const trainer = await prisma.trainerProfile.findUnique({
      where: { id: input.trainerId },
      include: {
        challenge: { select: { id: true, slug: true, status: true } },
      },
    });
    if (!trainer) return { ok: false, error: "Trainer not found" };
    if (trainer.challenge.status === "ARCHIVED") {
      return { ok: false, error: "This season is archived and read-only" };
    }

    const { userId } = await requireGm(trainer.challengeId);

    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.trainerBoardSnapshot.deleteMany({
        where: { trainerId: trainer.id },
      });
      if (result.count > 0) {
        await tx.activityEvent.create({
          data: {
            challengeId: trainer.challengeId,
            actorId: userId,
            trainerId: trainer.id,
            type: "NOTE",
            message: `GM cleared ${result.count} board history snapshot${result.count === 1 ? "" : "s"} for ${trainer.handle}`,
          },
        });
      }
      return result.count;
    });

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return {
      ok: true,
      message:
        deleted === 0
          ? "No board history to clear"
          : `Cleared ${deleted} snapshot${deleted === 1 ? "" : "s"}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not clear board history",
    };
  }
}

export type MemorialBackfillPreviewItem = Pick<
  MemorialBackfillCandidate,
  | "label"
  | "species"
  | "nickname"
  | "pokedexId"
  | "isShiny"
  | "diedOnRun"
  | "causeOfDeath"
  | "source"
>;

export type PreviewMemorialBackfillResult =
  | {
      ok: true;
      candidates: MemorialBackfillPreviewItem[];
      runsRestored: number[];
      runsSkipped: number[];
    }
  | { ok: false; error: string };

async function buildMemorialBackfillPlanForTrainer(trainerId: string) {
  const prisma = getPrisma();
  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    include: {
      challenge: { select: { id: true, slug: true, status: true } },
      pokemon: {
        where: { slot: "GRAVEYARD" },
        select: {
          species: true,
          nickname: true,
          partyIndex: true,
        },
      },
    },
  });
  if (!trainer) throw new Error("Trainer not found");
  if (trainer.challenge.status === "ARCHIVED") {
    throw new Error("This season is archived and read-only");
  }

  const [runs, snapRows] = await Promise.all([
    prisma.trainerRun.findMany({
      where: { trainerId: trainer.id },
      orderBy: { runNumber: "asc" },
      select: { id: true, runNumber: true, status: true },
    }),
    prisma.trainerBoardSnapshot.findMany({
      where: { trainerId: trainer.id },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        trigger: true,
        createdAt: true,
        runId: true,
        payload: true,
      },
    }),
  ]);

  const snapshots = [];
  for (const row of snapRows) {
    const payload = parseSnapshotPayload(row.payload);
    if (!payload) continue;
    snapshots.push({
      id: row.id,
      trigger: row.trigger as BoardSnapshotTrigger,
      createdAt: row.createdAt.toISOString(),
      runId: row.runId,
      wipeCount: payload.wipeCount,
      pokemon: payload.pokemon,
    });
  }

  const plan = memorialBackfillCandidates({
    runs: runs.map((run) => ({
      id: run.id,
      runNumber: run.runNumber,
      status: run.status as "ACTIVE" | "CLOSED",
    })),
    snapshots,
    existingGraves: trainer.pokemon,
  });

  return { trainer, plan };
}

async function loadMemorialBackfillPlan(trainerId: string) {
  const { trainer, plan } = await buildMemorialBackfillPlanForTrainer(trainerId);
  const { userId } = await requireGm(trainer.challengeId);
  return { trainer, plan, userId };
}

/** GM-only: preview graves that would be restored from board history. */
export async function previewMemorialBackfillAction(input: {
  trainerId: string;
}): Promise<PreviewMemorialBackfillResult> {
  try {
    const { plan } = await loadMemorialBackfillPlan(input.trainerId);
    return {
      ok: true,
      candidates: plan.candidates.map((c) => ({
        label: c.label,
        species: c.species,
        nickname: c.nickname,
        pokedexId: c.pokedexId,
        isShiny: c.isShiny,
        diedOnRun: c.diedOnRun,
        causeOfDeath: c.causeOfDeath,
        source: c.source,
      })),
      runsRestored: plan.runsRestored,
      runsSkipped: plan.runsSkipped,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Could not preview memorial restore",
    };
  }
}

/** GM-only: append missing memorial rows reconstructed from board history. */
export async function gmApplyMemorialBackfillAction(input: {
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const { trainer, plan, userId } = await loadMemorialBackfillPlan(
      input.trainerId,
    );

    if (plan.candidates.length === 0) {
      return {
        ok: true,
        message: "Memorial already has every recoverable R.I.P. from history",
      };
    }

    await prismaMemorialBackfillCreate(trainer, plan, {
      actorId: userId,
      logActivity: true,
    });

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    revalidatePath(`/challenges/${trainer.challenge.slug}/memorial`);
    return {
      ok: true,
      message: `Restored ${plan.candidates.length} memorial entr${
        plan.candidates.length === 1 ? "y" : "ies"
      } from board history`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not restore memorial from history",
    };
  }
}

export type SeasonMemorialBackfillTrainerPreview = {
  trainerId: string;
  handle: string;
  count: number;
  sample: string[];
};

export type PreviewSeasonMemorialBackfillResult =
  | {
      ok: true;
      totalCandidates: number;
      trainersAffected: number;
      trainers: SeasonMemorialBackfillTrainerPreview[];
    }
  | { ok: false; error: string };

/** GM-only: preview season-wide memorial reconstruction from board history. */
export async function previewSeasonMemorialBackfillAction(input: {
  challengeId: string;
}): Promise<PreviewSeasonMemorialBackfillResult> {
  try {
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { id: input.challengeId },
      select: {
        id: true,
        status: true,
        trainers: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, handle: true },
        },
      },
    });
    if (!challenge) return { ok: false, error: "Challenge not found" };
    if (challenge.status === "ARCHIVED") {
      return { ok: false, error: "This season is archived and read-only" };
    }
    await requireGm(challenge.id);

    const trainers: SeasonMemorialBackfillTrainerPreview[] = [];
    let totalCandidates = 0;
    for (const row of challenge.trainers) {
      const { plan } = await buildMemorialBackfillPlanForTrainer(row.id);
      if (plan.candidates.length === 0) continue;
      totalCandidates += plan.candidates.length;
      trainers.push({
        trainerId: row.id,
        handle: row.handle,
        count: plan.candidates.length,
        sample: plan.candidates.slice(0, 4).map((c) => c.label),
      });
    }

    return {
      ok: true,
      totalCandidates,
      trainersAffected: trainers.length,
      trainers,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not preview memorial reconstruction",
    };
  }
}

/**
 * GM-only: reconstruct missing memorial rows for every trainer from retained
 * board history snapshots (same rules as per-trainer restore).
 */
export async function gmReconstructMemorialHistoryAction(input: {
  challengeId: string;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { id: input.challengeId },
      select: {
        id: true,
        slug: true,
        status: true,
        trainers: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, handle: true },
        },
      },
    });
    if (!challenge) return { ok: false, error: "Challenge not found" };
    if (challenge.status === "ARCHIVED") {
      return { ok: false, error: "This season is archived and read-only" };
    }

    const { userId } = await requireGm(challenge.id);

    let totalRestored = 0;
    let trainersUpdated = 0;
    const touchedHandles: string[] = [];

    for (const row of challenge.trainers) {
      const { trainer, plan } = await buildMemorialBackfillPlanForTrainer(
        row.id,
      );
      if (plan.candidates.length === 0) continue;
      await prismaMemorialBackfillCreate(trainer, plan, {
        actorId: userId,
        logActivity: false,
      });
      totalRestored += plan.candidates.length;
      trainersUpdated += 1;
      touchedHandles.push(trainer.handle);
    }

    if (totalRestored > 0) {
      await prisma.activityEvent.create({
        data: {
          challengeId: challenge.id,
          actorId: userId,
          type: "NOTE",
          message: `GM reconstructed memorial history — ${totalRestored} entr${
            totalRestored === 1 ? "y" : "ies"
          } across ${trainersUpdated} trainer${
            trainersUpdated === 1 ? "" : "s"
          }${
            touchedHandles.length
              ? ` (${touchedHandles.slice(0, 6).join(", ")}${
                  touchedHandles.length > 6
                    ? ` +${touchedHandles.length - 6}`
                    : ""
                })`
              : ""
          }`,
        },
      });
    }

    revalidateChallenge(challenge.slug);
    revalidatePath(`/challenges/${challenge.slug}/memorial`);

    if (totalRestored === 0) {
      return {
        ok: true,
        message:
          "No missing memorial entries found in retained board history",
      };
    }

    return {
      ok: true,
      message: `Restored ${totalRestored} memorial entr${
        totalRestored === 1 ? "y" : "ies"
      } across ${trainersUpdated} trainer${trainersUpdated === 1 ? "" : "s"}`,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not reconstruct memorial history",
    };
  }
}

async function prismaMemorialBackfillCreate(
  trainer: {
    id: string;
    challengeId: string;
    handle: string;
  },
  plan: Awaited<
    ReturnType<typeof buildMemorialBackfillPlanForTrainer>
  >["plan"],
  options: { actorId: string; logActivity: boolean },
) {
  const prisma = getPrisma();
  let partyIndex = plan.nextPartyIndex;
  const rows = plan.candidates.map((c) => {
    const mon = c.pokemon;
    const index = partyIndex++;
    return {
      trainerId: trainer.id,
      slot: "GRAVEYARD" as const,
      partyIndex: index,
      nickname: mon.nickname,
      species: mon.species,
      pokedexId: mon.pokedexId,
      isShiny: mon.isShiny,
      types: resolvePokemonTypes({
        types: mon.types,
        pokedexId: mon.pokedexId,
        species: mon.species,
      }),
      level: mon.level,
      nature: mon.nature,
      ability: mon.ability,
      catchRoute: mon.catchRoute,
      heldItem: mon.heldItem,
      moves: mon.moves,
      ivs: jsonStatOrNull(mon.ivs),
      evs: jsonStatOrNull(mon.evs),
      causeOfDeath: c.causeOfDeath,
      diedOnRun: c.diedOnRun,
      runId: c.runId,
      notes: `Restored from board history (run ${c.diedOnRun})`,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.pokemonEntry.createMany({ data: rows });
    if (options.logActivity) {
      await tx.activityEvent.create({
        data: {
          challengeId: trainer.challengeId,
          actorId: options.actorId,
          trainerId: trainer.id,
          type: "NOTE",
          message: `GM restored ${rows.length} memorial entr${
            rows.length === 1 ? "y" : "ies"
          } for ${trainer.handle} from board history`,
        },
      });
    }
  });
}

const BadgeChangeSchema = z.object({
  badgeKey: z.string().min(1),
  earned: z.boolean(),
});

const SetBadgesProgressSchema = z.object({
  trainerId: z.string().min(1),
  changes: z.array(BadgeChangeSchema).min(1).max(32),
  /** Reject stale writes that raced a wipe (client wipeCount at schedule time). */
  expectedWipeCount: z.number().int().nonnegative().optional(),
});

/** Apply one or many badge toggles and log a single condensed Pack-feed entry. */
export async function setBadgesProgressAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const input = SetBadgesProgressSchema.parse(raw);
    const { trainer, userId } = await requireTrainerEditAccess(input.trainerId);
    if (
      input.expectedWipeCount != null &&
      trainer.wipeCount !== input.expectedWipeCount
    ) {
      return { ok: false, error: "Board changed — refresh and try again" };
    }

    // Last write wins if the same key appears twice in one flush.
    const desired = new Map<string, boolean>();
    for (const change of input.changes) {
      desired.set(change.badgeKey, change.earned);
    }

    const prisma = getPrisma();
    const badges = await prisma.badgeDefinition.findMany({
      where: {
        challengeId: trainer.challengeId,
        key: { in: [...desired.keys()] },
      },
    });
    if (badges.length !== desired.size) {
      return { ok: false, error: "Badge not found" };
    }

    const byKey = new Map(badges.map((b) => [b.key, b]));
    const earnedLabels: string[] = [];
    const lostLabels: string[] = [];
    const now = new Date();

    await prisma.$transaction(
      [...desired.entries()].map(([badgeKey, earned]) => {
        const badge = byKey.get(badgeKey)!;
        if (earned) earnedLabels.push(badge.label);
        else lostLabels.push(badge.label);
        return prisma.badgeProgress.upsert({
          where: {
            trainerId_badgeId: { trainerId: trainer.id, badgeId: badge.id },
          },
          create: {
            trainerId: trainer.id,
            badgeId: badge.id,
            earned,
            earnedAt: earned ? now : null,
          },
          update: {
            earned,
            earnedAt: earned ? now : null,
          },
        });
      }),
    );

    // Keep gym / elite display order in the feed line.
    const order = new Map(badges.map((b) => [b.label, b.sortOrder]));
    earnedLabels.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    lostLabels.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

    if (earnedLabels.length > 0 || lostLabels.length > 0) {
      await logActivity({
        challengeId: trainer.challengeId,
        actorId: userId,
        trainerId: trainer.id,
        coalesce: {
          category: "badges",
          scope: "trainer",
          resolve: (prev) =>
            resolveBadgeCoalesce(
              trainer.handle,
              prev,
              earnedLabels,
              lostLabels,
            ),
        },
      });
    }

    // League board only — avoid remounting the trainer editor mid-toggle.
    updateTag(`season:${trainer.challenge.slug}:board`);
    revalidatePath(`/challenges/${trainer.challenge.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Badge update failed" };
  }
}

export async function setBadgeProgressAction(input: {
  trainerId: string;
  badgeKey: string;
  earned: boolean;
  /** Reject stale writes that raced a wipe (client wipeCount at schedule time). */
  expectedWipeCount?: number;
}): Promise<ActionResult> {
  return setBadgesProgressAction({
    trainerId: input.trainerId,
    changes: [{ badgeKey: input.badgeKey, earned: input.earned }],
    expectedWipeCount: input.expectedWipeCount,
  });
}

const UpsertPokemonSchema = PokemonEntryInputSchema.extend({
  id: z.string().optional(),
  trainerId: z.string().min(1),
});

export async function upsertPokemonAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const data = UpsertPokemonSchema.parse(raw);
    const { trainer, userId, access } = await requireTrainerEditAccess(
      data.trainerId,
    );

    if (
      data.slot === "MAIN" &&
      trainer.mainSquadLocked &&
      !access.isGm
    ) {
      return {
        ok: false,
        error: "Main Squad is locked after Championship",
      };
    }

    const speciesMeta = findSpecies(data.species);
    const q = data.species.trim().toLowerCase();
    const indexHit =
      (speciesMeta
        ? findPokemonById(speciesMeta.pokedexId)
        : undefined) ??
      searchPokemonIndex(q, { limit: 8 }).find(
        (p) =>
          p.name.toLowerCase() === q ||
          p.slug === q ||
          p.slug === q.replace(/\s+/g, "-"),
      );

    const pokedexId =
      speciesMeta?.pokedexId ?? indexHit?.pokedexId ?? null;
    const types = resolvePokemonTypes({
      types: data.types,
      pokedexId,
      species: data.species,
    });

    const prisma = getPrisma();
    const enteringGraveyard = data.slot === "GRAVEYARD";
    const runAtDeath = currentRunNumber(trainer.wipeCount);
    const activeRun = await ensureActiveRunInTx(prisma, {
      id: trainer.id,
      wipeCount: trainer.wipeCount,
      activeRunId: trainer.activeRunId,
    });
    const payload = {
      slot: data.slot,
      partyIndex: data.partyIndex,
      nickname: data.nickname ?? null,
      species: data.species,
      pokedexId,
      isShiny: data.isShiny,
      types,
      nature: data.nature ?? null,
      level: data.level ?? null,
      ability: data.ability ?? null,
      catchRoute: data.catchRoute ?? null,
      heldItem: data.heldItem ?? null,
      moves: data.moves,
      ivs: jsonStatOrNull(data.ivs ?? null),
      evs: jsonStatOrNull(data.evs ?? null),
      causeOfDeath: data.causeOfDeath ?? null,
      notes: data.notes ?? null,
    };

    if (data.id) {
      const existing = await prisma.pokemonEntry.findFirst({
        where: { id: data.id, trainerId: trainer.id },
      });
      if (!existing) return { ok: false, error: "Pokémon not found" };
      const becameGrave =
        existing.slot !== "GRAVEYARD" && enteringGraveyard;
      await prisma.pokemonEntry.update({
        where: { id: data.id },
        data: {
          ...payload,
          diedOnRun: enteringGraveyard
            ? becameGrave || existing.diedOnRun == null
              ? runAtDeath
              : existing.diedOnRun
            : null,
          runId: enteringGraveyard
            ? becameGrave ||
              (existing.runId == null &&
                (existing.diedOnRun == null ||
                  existing.diedOnRun === runAtDeath))
              ? activeRun.id
              : existing.runId
            : activeRun.id,
        },
      });
      if (becameGrave) {
        const label = data.nickname || data.species;
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          coalesce: {
            category: "deaths",
            scope: "trainer",
            resolve: (prev) =>
              resolveDeathCoalesce(trainer.handle, prev, [label]),
          },
        });
      }
    } else {
      await prisma.pokemonEntry.create({
        data: {
          trainerId: trainer.id,
          ...payload,
          diedOnRun: enteringGraveyard ? runAtDeath : null,
          runId: activeRun.id,
        },
      });
      const label = data.nickname || data.species;
      if (enteringGraveyard) {
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          coalesce: {
            category: "deaths",
            scope: "trainer",
            resolve: (prev) =>
              resolveDeathCoalesce(trainer.handle, prev, [label]),
          },
        });
      } else {
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          coalesce: {
            category: "catches",
            scope: "trainer",
            resolve: (prev) =>
              resolveCatchCoalesce(trainer.handle, prev, [label]),
          },
        });
      }
    }

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Pokémon saved" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Pokémon save failed",
    };
  }
}

export async function deletePokemonAction(input: {
  trainerId: string;
  pokemonId: string;
}): Promise<ActionResult> {
  try {
    const { trainer, access } = await requireTrainerEditAccess(input.trainerId);
    const prisma = getPrisma();
    const mon = await prisma.pokemonEntry.findFirst({
      where: { id: input.pokemonId, trainerId: trainer.id },
    });
    if (!mon) return { ok: false, error: "Pokémon not found" };
    if (mon.slot === "MAIN" && trainer.mainSquadLocked && !access.isGm) {
      return { ok: false, error: "Main Squad is locked" };
    }
    await prisma.pokemonEntry.delete({ where: { id: mon.id } });
    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Pokémon removed" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

/** Memorial-only: update a grave's cause of death without opening the full form. */
export async function updateGraveCauseAction(input: {
  trainerId: string;
  pokemonId: string;
  causeOfDeath: string | null;
}): Promise<ActionResult> {
  try {
    const cause = z
      .string()
      .max(500)
      .nullable()
      .optional()
      .parse(input.causeOfDeath);
    const { trainer } = await requireTrainerEditAccess(input.trainerId);
    const prisma = getPrisma();
    const mon = await prisma.pokemonEntry.findFirst({
      where: {
        id: input.pokemonId,
        trainerId: trainer.id,
        slot: "GRAVEYARD",
      },
      select: { id: true },
    });
    if (!mon) return { ok: false, error: "Memorial entry not found" };

    const trimmed = cause?.trim() || null;
    await prisma.pokemonEntry.update({
      where: { id: mon.id },
      data: { causeOfDeath: trimmed },
    });

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Cause of death updated" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

const RelocatablePokemonSlotSchema = z.enum(["MAIN", "RESERVE", "GRAVEYARD"]);

const RelocatePokemonSchema = z
  .object({
    trainerId: z.string().min(1),
    updates: z
      .array(
        z.object({
          id: z.string().min(1),
          slot: RelocatablePokemonSlotSchema,
          // Reserves/RIP can grow past the old 0–11 add-form scan.
          partyIndex: z.number().int().min(0).max(999),
        }),
      )
      .min(1)
      .max(200),
  })
  .superRefine((data, ctx) => {
    const seenIds = new Set<string>();
    const seenPositions = new Set<string>();
    for (const [i, update] of data.updates.entries()) {
      if (seenIds.has(update.id)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate Pokémon id in relocate payload",
          path: ["updates", i, "id"],
        });
      }
      seenIds.add(update.id);

      if (update.slot === "MAIN" && update.partyIndex > 5) {
        ctx.addIssue({
          code: "custom",
          message: "Main Squad partyIndex must be 0–5",
          path: ["updates", i, "partyIndex"],
        });
      }

      const pos = `${update.slot}:${update.partyIndex}`;
      if (seenPositions.has(pos)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate slot/partyIndex in relocate payload",
          path: ["updates", i, "partyIndex"],
        });
      }
      seenPositions.add(pos);
    }
  });

/** Persist slot / partyIndex changes from board drag-and-drop. */
export async function relocatePokemonAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const data = RelocatePokemonSchema.parse(raw);
    const { trainer, userId, access } = await requireTrainerEditAccess(
      data.trainerId,
    );
    const prisma = getPrisma();

    const discordDeaths: string[] = [];

    await prisma.$transaction(async (tx) => {
      const relocatable = await tx.pokemonEntry.findMany({
        where: {
          trainerId: trainer.id,
          slot: { in: ["MAIN", "RESERVE", "GRAVEYARD"] },
        },
      });
      const byId = new Map(relocatable.map((m) => [m.id, m]));

      for (const update of data.updates) {
        if (!byId.has(update.id)) {
          throw new Error("Pokémon not found");
        }
      }

      if (trainer.mainSquadLocked && !access.isGm) {
        for (const update of data.updates) {
          const mon = byId.get(update.id)!;
          if (mon.slot === "MAIN" || update.slot === "MAIN") {
            throw new Error("Main Squad is locked after Championship");
          }
        }
      }

      const finalPositions = new Map(
        relocatable.map((m) => [
          m.id,
          { slot: m.slot, partyIndex: m.partyIndex },
        ]),
      );
      for (const update of data.updates) {
        finalPositions.set(update.id, {
          slot: update.slot,
          partyIndex: update.partyIndex,
        });
      }

      const occupied = new Set<string>();
      for (const pos of finalPositions.values()) {
        const key = `${pos.slot}:${pos.partyIndex}`;
        if (occupied.has(key)) {
          throw new Error("Duplicate party position after relocate");
        }
        occupied.add(key);
      }

      const memorialized: Array<{ id: string; label: string }> = [];
      const runAtDeath = currentRunNumber(trainer.wipeCount);
      const activeRun = await ensureActiveRunInTx(tx, {
        id: trainer.id,
        wipeCount: trainer.wipeCount,
        activeRunId: trainer.activeRunId,
      });
      for (const update of data.updates) {
        const mon = byId.get(update.id)!;
        if (mon.slot !== "GRAVEYARD" && update.slot === "GRAVEYARD") {
          memorialized.push({
            id: update.id,
            label: mon.nickname || mon.species,
          });
        }
        const enteringGraveyard =
          mon.slot !== "GRAVEYARD" && update.slot === "GRAVEYARD";
        const leavingGraveyard =
          mon.slot === "GRAVEYARD" && update.slot !== "GRAVEYARD";
        await tx.pokemonEntry.update({
          where: { id: update.id },
          data: {
            slot: update.slot,
            partyIndex: update.partyIndex,
            ...(enteringGraveyard
              ? {
                  diedOnRun: mon.diedOnRun ?? runAtDeath,
                  runId: mon.runId ?? activeRun.id,
                }
              : leavingGraveyard
                ? { diedOnRun: null, runId: activeRun.id }
                : { runId: mon.runId ?? activeRun.id }),
          },
        });
      }

      const deathLabels = memorialized.map((entry) => entry.label);
      if (deathLabels.length > 0) {
        const written = await writeActivityEvent(tx as unknown as ActivityDb, {
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          dispatchDiscord: false,
          coalesce: {
            category: "deaths",
            scope: "trainer",
            resolve: (prev) =>
              resolveDeathCoalesce(trainer.handle, prev, deathLabels),
          },
        });
        if (written.created) {
          discordDeaths.push(written.message);
        }
      }
    });

    // Discord only after the party + activity write commits.
    for (const message of discordDeaths) {
      void dispatchDiscordWebhook({
        challengeId: trainer.challengeId,
        type: "DEATH",
        message,
      });
    }

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Party updated" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Party move failed",
    };
  }
}

const SaveImportMonSchema = z.object({
  nickname: z.string().max(32).optional().nullable(),
  species: z.string().min(1).max(64),
  pokedexId: z.number().int().positive().optional().nullable(),
  level: z.number().int().min(1).max(100).optional().nullable(),
  isShiny: z.boolean().default(false),
  nature: z.string().max(32).optional().nullable(),
  ability: z.string().max(64).optional().nullable(),
  catchRoute: z.string().max(128).optional().nullable(),
  heldItem: z.string().max(64).optional().nullable(),
  moves: z.array(z.string().max(64)).max(4).default([]),
  ivs: IvsSchema.optional().nullable(),
  evs: StatSpreadSchema.optional().nullable(),
  slot: PokemonSlotSchema,
});

const ImportFromSaveSchema = z.object({
  trainerId: z.string().min(1),
  // Party + box + R.I.P. + wild buffer + Pokédex-seen stubs (capped in parser).
  pokemon: z.array(SaveImportMonSchema).max(512),
  trainerName: z.string().min(1).max(32).optional().nullable(),
  applyTrainerName: z.boolean().default(false),
  badgeKeys: z.array(z.string().min(1).max(32)).max(16).default([]),
  applyBadges: z.boolean().default(false),
  reviveUsed: z.boolean().optional().nullable(),
  applyRevive: z.boolean().default(false),
  money: z.number().int().min(0).max(999_999).optional().nullable(),
  applyMoney: z.boolean().default(false),
  /**
   * Which living / Encountered slots to overwrite from this import.
   * GRAVEYARD is season-wide: omitted here means append imported R.I.P.
   * (deduped); including GRAVEYARD still hard-replaces the memorial.
   */
  replaceSlots: z.array(PokemonSlotSchema).default(DEFAULT_IMPORT_REPLACE_SLOTS),
});

/** Apply categorized save import (party/box/rip/encounters + optional name/badges). */
export async function importFromSaveAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const data = ImportFromSaveSchema.parse(raw);
    const { trainer, userId, access } = await requireTrainerEditAccess(
      data.trainerId,
    );

    if (
      trainer.mainSquadLocked &&
      !access.isGm &&
      data.replaceSlots.includes("MAIN")
    ) {
      return {
        ok: false,
        error: "Main Squad is locked after Championship",
      };
    }

    const prisma = getPrisma();

    // Living + Encountered mirror this save snapshot (re-import replaces those
    // slots). Memorial is season-wide: by default we append imported R.I.P.
    // instead of wiping prior graves. Opt into replaceSlots: ["GRAVEYARD"] to
    // hard-replace the memorial.
    const indexes: Record<string, number> = {
      MAIN: 0,
      RESERVE: 0,
      GRAVEYARD: 0,
      ENCOUNTERED: 0,
    };

    const replaceSet = new Set(data.replaceSlots);
    const replaceMemorial = replaceSet.has("GRAVEYARD");
    // Within-payload Encountered dedupe only (existing rows are wiped below).
    // Always key on species+route so null vs resolved pokedexId cannot diverge.
    const seenEncounterKeys = new Set<string>();
    const encounterDedupeKey = (mon: {
      species: string;
      catchRoute?: string | null;
    }) =>
      `${mon.species.trim().toLowerCase()}|${
        mon.catchRoute?.trim().toLowerCase() || ""
      }`;

    function buildImportRow(mon: (typeof data.pokemon)[number], partyIndex: number) {
      const speciesMeta = findSpecies(mon.species);
      const indexHit =
        (mon.pokedexId ? findPokemonById(mon.pokedexId) : undefined) ??
        (speciesMeta ? findPokemonById(speciesMeta.pokedexId) : undefined) ??
        searchPokemonIndex(mon.species.trim().toLowerCase(), {
          limit: 8,
        }).find(
          (p) => p.name.toLowerCase() === mon.species.trim().toLowerCase(),
        );

      const pokedexId =
        mon.pokedexId ??
        speciesMeta?.pokedexId ??
        indexHit?.pokedexId ??
        null;

      return {
        trainerId: trainer.id,
        slot: mon.slot,
        partyIndex,
        nickname: mon.nickname?.trim() || null,
        species: mon.species.trim(),
        pokedexId,
        isShiny: mon.isShiny,
        types: resolvePokemonTypes({
          pokedexId,
          species: mon.species,
        }),
        level: mon.level ?? null,
        nature: mon.nature?.trim() || null,
        ability: mon.ability?.trim() || null,
        catchRoute: mon.catchRoute?.trim() || null,
        heldItem: mon.heldItem?.trim() || null,
        moves: mon.moves ?? [],
        ivs: jsonStatOrNull(mon.ivs ?? null),
        evs: jsonStatOrNull(mon.evs ?? null),
        causeOfDeath:
          mon.slot === "GRAVEYARD" ? "Imported from save (fainted)" : null,
        diedOnRun:
          mon.slot === "GRAVEYARD"
            ? currentRunNumber(trainer.wipeCount)
            : null,
        runId: null as string | null,
        notes: `Imported from save (${mon.slot.toLowerCase()})`,
      };
    }

    const livingRows = data.pokemon
      .filter((mon) => mon.slot !== "GRAVEYARD" && replaceSet.has(mon.slot))
      .filter((mon) => {
        if (mon.slot !== "ENCOUNTERED") return true;
        const key = encounterDedupeKey(mon);
        if (seenEncounterKeys.has(key)) return false;
        seenEncounterKeys.add(key);
        return true;
      })
      .map((mon) => {
        const partyIndex = indexes[mon.slot] ?? 0;
        indexes[mon.slot] = partyIndex + 1;
        return buildImportRow(mon, partyIndex);
      });

    const incomingGraves = data.pokemon.filter((mon) => mon.slot === "GRAVEYARD");

    const txResult = await prisma.$transaction(async (tx) => {
      await captureTrainerBoardSnapshotInTx(tx, {
        challengeId: trainer.challengeId,
        trainerId: trainer.id,
        actorId: userId,
        trigger: "IMPORT",
      });
      const activeRun = await ensureActiveRunInTx(tx, {
        id: trainer.id,
        wipeCount: trainer.wipeCount,
        activeRunId: trainer.activeRunId,
      });

      const slotsToClear = replaceMemorial
        ? data.replaceSlots
        : data.replaceSlots.filter((slot) => slot !== "GRAVEYARD");
      if (slotsToClear.length > 0) {
        await tx.pokemonEntry.deleteMany({
          where: {
            trainerId: trainer.id,
            slot: { in: slotsToClear },
          },
        });
      }

      let graveRows: ReturnType<typeof buildImportRow>[] = [];
      if (replaceMemorial) {
        graveRows = incomingGraves.map((mon) => {
          const partyIndex = indexes.GRAVEYARD ?? 0;
          indexes.GRAVEYARD = partyIndex + 1;
          return buildImportRow(mon, partyIndex);
        });
      } else if (incomingGraves.length > 0) {
        const existingGraves = await tx.pokemonEntry.findMany({
          where: { trainerId: trainer.id, slot: "GRAVEYARD" },
          select: { species: true, nickname: true, partyIndex: true },
          orderBy: { partyIndex: "asc" },
        });
        const { toCreate, nextPartyIndex } = importedGravesToAppend(
          existingGraves,
          incomingGraves,
        );
        let partyIndex = nextPartyIndex;
        graveRows = toCreate.map((mon) => buildImportRow(mon, partyIndex++));
      }

      const importRows = [...livingRows, ...graveRows].map((row) => ({
        ...row,
        runId: activeRun.id,
      }));
      if (importRows.length > 0) {
        await tx.pokemonEntry.createMany({ data: importRows });
      }

      if (data.applyTrainerName && data.trainerName) {
        const nextHandle = sanitizeHandle(data.trainerName);
        if (nextHandle && nextHandle !== trainer.handle) {
          const clash = await tx.trainerProfile.findUnique({
            where: {
              challengeId_handle: {
                challengeId: trainer.challengeId,
                handle: nextHandle,
              },
            },
          });
          if (!clash) {
            await tx.trainerProfile.update({
              where: { id: trainer.id },
              data: { handle: nextHandle },
            });
          }
        }
      }

      if (data.applyBadges) {
        const defs = await tx.badgeDefinition.findMany({
          where: { challengeId: trainer.challengeId },
        });
        for (const def of defs) {
          if (!def.key.startsWith("gym-")) continue;
          const earned = data.badgeKeys.includes(def.key);
          await tx.badgeProgress.upsert({
            where: {
              trainerId_badgeId: {
                trainerId: trainer.id,
                badgeId: def.id,
              },
            },
            create: {
              trainerId: trainer.id,
              badgeId: def.id,
              earned,
              earnedAt: earned ? new Date() : null,
            },
            update: {
              earned,
              earnedAt: earned ? new Date() : null,
            },
          });
        }
      }

      let reviveTransition: { from: boolean; to: boolean } | null = null;
      // Imports may only spend a revive. Clearing it stays GM-only.
      if (
        data.applyRevive &&
        data.reviveUsed != null &&
        data.reviveUsed !== trainer.reviveUsed &&
        (data.reviveUsed || access.isGm)
      ) {
        await setActiveRunReviveInTx(
          tx,
          {
            id: trainer.id,
            wipeCount: trainer.wipeCount,
            activeRunId: trainer.activeRunId,
          },
          data.reviveUsed,
        );
        reviveTransition = {
          from: trainer.reviveUsed,
          to: data.reviveUsed,
        };
      }

      if (data.applyMoney && data.money != null) {
        await tx.trainerProfile.update({
          where: { id: trainer.id },
          data: { money: data.money },
        });
      }

      return { reviveTransition, importedCount: importRows.length };
    });

    const handleLabel =
      data.applyTrainerName && data.trainerName
        ? sanitizeHandle(data.trainerName)
        : trainer.handle;

    await logActivity({
      challengeId: trainer.challengeId,
      actorId: userId,
      trainerId: trainer.id,
      type: "NOTE",
      message: `${handleLabel} imported save data (${txResult.importedCount} Pokémon)`,
    });

    if (txResult.reviveTransition) {
      const reviveTransition = txResult.reviveTransition;
      await logActivity({
        challengeId: trainer.challengeId,
        actorId: userId,
        trainerId: trainer.id,
        type: reviveTransition.to ? "REVIVE_USED" : "REVIVE_RESET",
        message: reviveTransition.to
          ? `${handleLabel} marked Revive Token used via save import`
          : `GM reset Revive Token for ${handleLabel} via save import`,
      });
    }

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return {
      ok: true,
      message: `Imported ${txResult.importedCount} Pokémon from save`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save import failed",
    };
  }
}

/** @deprecated Use importFromSaveAction */
export async function replaceLivingRosterAction(
  raw: unknown,
): Promise<ActionResult> {
  return importFromSaveAction(raw);
}

export async function gmUpdateRuleAction(input: {
  challengeId: string;
  ruleId?: string;
  sortOrder: number;
  title: string;
  body: string;
  isCore: boolean;
  delete?: boolean;
}): Promise<ActionResult> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { id: input.challengeId },
    });
    if (!challenge) return { ok: false, error: "Challenge not found" };

    if (input.delete && input.ruleId) {
      await prisma.challengeRule.delete({ where: { id: input.ruleId } });
    } else if (input.ruleId) {
      await prisma.challengeRule.update({
        where: { id: input.ruleId },
        data: {
          sortOrder: input.sortOrder,
          title: input.title,
          body: input.body,
          isCore: input.isCore,
        },
      });
    } else {
      await prisma.challengeRule.create({
        data: {
          challengeId: input.challengeId,
          sortOrder: input.sortOrder,
          title: input.title,
          body: input.body,
          isCore: input.isCore,
        },
      });
    }

    const session = await auth();
    await logActivity({
      challengeId: input.challengeId,
      actorId: session?.user?.id,
      coalesce: {
        category: "rules",
        scope: "challenge",
        legacyTypes: ["RULE_UPDATED"],
        resolve: () => resolveRulesCoalesce(),
      },
    });

    revalidateChallenge(challenge.slug);
    return { ok: true, message: "Rules saved" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Rule update failed" };
  }
}

export async function gmUpdateFaqAction(input: {
  challengeId: string;
  faqId?: string;
  sortOrder: number;
  question: string;
  answer: string;
  delete?: boolean;
}): Promise<ActionResult> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { id: input.challengeId },
    });
    if (!challenge) return { ok: false, error: "Challenge not found" };

    if (input.delete && input.faqId) {
      await prisma.faqEntry.delete({ where: { id: input.faqId } });
    } else if (input.faqId) {
      await prisma.faqEntry.update({
        where: { id: input.faqId },
        data: {
          sortOrder: input.sortOrder,
          question: input.question,
          answer: input.answer,
        },
      });
    } else {
      await prisma.faqEntry.create({
        data: {
          challengeId: input.challengeId,
          sortOrder: input.sortOrder,
          question: input.question,
          answer: input.answer,
        },
      });
    }

    revalidateChallenge(challenge.slug);
    return { ok: true, message: "FAQ saved" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "FAQ update failed" };
  }
}

export async function gmSetTrainerLockAction(input: {
  trainerId: string;
  locked: boolean;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const trainer = await prisma.trainerProfile.findUnique({
      where: { id: input.trainerId },
      include: { challenge: true },
    });
    if (!trainer) return { ok: false, error: "Trainer not found" };
    if (trainer.challenge.status === "ARCHIVED") {
      return { ok: false, error: "This season is archived and read-only" };
    }
    const { userId } = await requireGm(trainer.challengeId);

    await prisma.trainerProfile.update({
      where: { id: trainer.id },
      data: { mainSquadLocked: input.locked },
    });

    if (input.locked) {
      await logActivity({
        challengeId: trainer.challengeId,
        actorId: userId,
        trainerId: trainer.id,
        coalesce: {
          category: "locks",
          scope: "actor",
          resolve: (prev) => {
            const resolved = resolveLocksCoalesce(prev, [trainer.handle]);
            if (!resolved) return null;
            return {
              ...resolved,
              trainerId:
                resolved.metadata.handles.length === 1 ? trainer.id : null,
            };
          },
        },
      });
    }

    revalidateChallenge(trainer.challenge.slug, trainer.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lock failed" };
  }
}

export async function gmUnclaimTrainerAction(input: {
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const trainer = await prisma.trainerProfile.findUnique({
      where: { id: input.trainerId },
      include: { challenge: true },
    });
    if (!trainer) return { ok: false, error: "Trainer not found" };
    await requireGm(trainer.challengeId);
    await prisma.trainerProfile.update({
      where: { id: trainer.id },
      data: { userId: null },
    });
    revalidateChallenge(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Trainer unclaimed" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unclaim failed" };
  }
}

export async function gmUpdateChallengeMetaAction(input: {
  challengeId: string;
  name?: string;
  game?: string | null;
  visibility?: "INVITE" | "UNLISTED" | "PUBLIC";
  status?: "DRAFT" | "ACTIVE" | "TOURNAMENT" | "ARCHIVED";
  playerInviteCode?: string;
  gmInviteCode?: string;
  description?: string;
  discordWebhookUrl?: string | null;
  welcomeVideoUrl?: string | null;
  welcomeVideoPublishAt?: string | null;
  romUrl?: string | null;
}): Promise<ActionResult> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();

    const status = input.status
      ? ChallengeStatusSchema.parse(input.status)
      : undefined;

    let name: string | undefined;
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) {
        return { ok: false, error: "Season name is required" };
      }
      if (trimmed.length > 120) {
        return { ok: false, error: "Season name is too long" };
      }
      name = trimmed;
    }

    let game: string | null | undefined;
    if (input.game !== undefined) {
      const trimmed = (input.game ?? "").trim();
      game = trimmed ? trimmed.slice(0, 120) : null;
    }

    let webhookUrl: string | null | undefined = undefined;
    if (input.discordWebhookUrl !== undefined) {
      const trimmed = (input.discordWebhookUrl ?? "").trim();
      if (!trimmed) {
        webhookUrl = null;
      } else {
        try {
          const parsed = new URL(trimmed);
          if (
            parsed.protocol !== "https:" ||
            !(
              parsed.hostname === "discord.com" ||
              parsed.hostname === "discordapp.com"
            ) ||
            !parsed.pathname.startsWith("/api/webhooks/")
          ) {
            return {
              ok: false,
              error: "Discord webhook URL must be a discord.com /api/webhooks/… link",
            };
          }
          webhookUrl = trimmed;
        } catch {
          return { ok: false, error: "Invalid Discord webhook URL" };
        }
      }
    }

    let welcomeVideoUrl: string | null | undefined = undefined;
    if (input.welcomeVideoUrl !== undefined) {
      const parsed = parseOptionalHttpsUrl(input.welcomeVideoUrl, "Welcome video");
      if (!parsed.ok) return parsed;
      welcomeVideoUrl = parsed.value;
    }

    let romUrl: string | null | undefined = undefined;
    if (input.romUrl !== undefined) {
      const parsed = parseOptionalHttpsUrl(input.romUrl, "ROM");
      if (!parsed.ok) return parsed;
      romUrl = parsed.value;
    }

    let welcomeVideoPublishAt: Date | null | undefined = undefined;
    if (input.welcomeVideoPublishAt !== undefined) {
      if (
        input.welcomeVideoPublishAt === null ||
        input.welcomeVideoPublishAt.trim() === ""
      ) {
        welcomeVideoPublishAt = null;
      } else {
        const parsed = new Date(input.welcomeVideoPublishAt);
        if (Number.isNaN(parsed.getTime())) {
          return { ok: false, error: "Invalid welcome video publish time" };
        }
        welcomeVideoPublishAt = parsed;
      }
    }

    const challenge = await prisma.challenge.update({
      where: { id: input.challengeId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(game !== undefined ? { game } : {}),
        visibility: input.visibility,
        status,
        playerInviteCode: input.playerInviteCode,
        gmInviteCode: input.gmInviteCode,
        description: input.description,
        ...(webhookUrl !== undefined
          ? { discordWebhookUrl: webhookUrl }
          : {}),
        ...(welcomeVideoUrl !== undefined ? { welcomeVideoUrl } : {}),
        ...(welcomeVideoPublishAt !== undefined
          ? { welcomeVideoPublishAt }
          : {}),
        ...(romUrl !== undefined ? { romUrl } : {}),
      },
    });
    revalidateChallenge(challenge.slug);
    return { ok: true, message: "Challenge settings saved" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Settings update failed",
    };
  }
}

function parseOptionalHttpsUrl(
  raw: string | null | undefined,
  label: string,
):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > 2000) {
    return { ok: false, error: `${label} URL is too long` };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return { ok: false, error: `${label} URL must start with https://` };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, error: `Invalid ${label.toLowerCase()} URL` };
  }
}

export async function gmExportChallengeAction(input: {
  challengeId: string;
  format: "json" | "csv";
}): Promise<
  | { ok: true; filename: string; content: string; mimeType: string }
  | { ok: false; error: string }
> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();
    const row = await prisma.challenge.findUnique({
      where: { id: input.challengeId },
      select: { slug: true },
    });
    if (!row) return { ok: false, error: "Challenge not found" };

    const challenge = await getChallenge(row.slug);
    if (!challenge) return { ok: false, error: "Challenge not found" };

    if (input.format === "csv") {
      return {
        ok: true,
        filename: `${challenge.slug}-export.csv`,
        content: buildChallengeCsv(challenge),
        mimeType: "text/csv;charset=utf-8",
      };
    }

    return {
      ok: true,
      filename: `${challenge.slug}-export.json`,
      content: `${JSON.stringify(buildChallengeExport(challenge), null, 2)}\n`,
      mimeType: "application/json;charset=utf-8",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Export failed",
    };
  }
}

export async function gmInitTournamentAction(input: {
  challengeId: string;
}): Promise<ActionResult> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { id: input.challengeId },
      include: {
        trainers: {
          where: { mainSquadLocked: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, handle: true },
        },
      },
    });
    if (!challenge) return { ok: false, error: "Challenge not found" };
    if (challenge.trainers.length < 2) {
      return {
        ok: false,
        error: "Lock at least two Main Squads before seeding a bracket",
      };
    }

    const pairings = buildFirstRoundPairings(
      challenge.trainers.map((t) => t.id),
    );

    await prisma.$transaction(async (tx) => {
      const existing = await tx.tournament.findUnique({
        where: { challengeId: challenge.id },
      });
      if (existing) {
        await tx.tournamentMatch.deleteMany({
          where: { tournamentId: existing.id },
        });
        await tx.tournament.delete({ where: { id: existing.id } });
      }

      const tournament = await tx.tournament.create({
        data: {
          challengeId: challenge.id,
          name: `${challenge.name} Ladder`,
          status: "ACTIVE",
        },
      });

      await tx.tournamentMatch.createMany({
        data: pairings.map((p, index) => ({
          tournamentId: tournament.id,
          round: 1,
          sortOrder: index,
          label: p.label,
          trainerAId: p.trainerAId,
          trainerBId: p.trainerBId,
          // Bye: auto-advance the lone trainer
          winnerId: p.trainerAId && !p.trainerBId ? p.trainerAId : null,
        })),
      });
    });

    if (challenge.status === "ACTIVE" || challenge.status === "DRAFT") {
      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { status: "TOURNAMENT" },
      });
    }

    revalidateChallenge(challenge.slug);
    return {
      ok: true,
      message: `Bracket seeded with ${pairings.length} round-1 match(es)`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Tournament seed failed",
    };
  }
}

export async function gmSetMatchWinnerAction(input: {
  matchId: string;
  winnerId: string;
}): Promise<ActionResult> {
  try {
    const prisma = getPrisma();
    const match = await prisma.tournamentMatch.findUnique({
      where: { id: input.matchId },
      include: {
        tournament: { include: { challenge: true } },
      },
    });
    if (!match) return { ok: false, error: "Match not found" };
    await requireGm(match.tournament.challengeId);

    if (
      input.winnerId !== match.trainerAId &&
      input.winnerId !== match.trainerBId
    ) {
      return { ok: false, error: "Winner must be one of the match trainers" };
    }

    const advanceMessage = await prisma.$transaction(async (tx) => {
      // Serialize winner writes + round advance for this bracket.
      await tx.$executeRaw`SELECT 1 FROM "Tournament" WHERE id = ${match.tournamentId} FOR UPDATE`;

      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: { winnerId: input.winnerId },
      });

      return advanceTournamentRoundLocked(tx, match.tournamentId, match.round);
    });

    revalidatePath(
      `/challenges/${match.tournament.challenge.slug}/tournament`,
    );
    revalidateChallenge(match.tournament.challenge.slug);
    return {
      ok: true,
      message: advanceMessage ?? "Winner recorded",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not set winner",
    };
  }
}

type TournamentTx = Parameters<
  Parameters<ReturnType<typeof getPrisma>["$transaction"]>[0]
>[0];

/**
 * Advance while holding a tournament row lock (caller must FOR UPDATE first).
 * Cascades through bye-only rounds inside the same transaction.
 */
async function advanceTournamentRoundLocked(
  tx: TournamentTx,
  tournamentId: string,
  startRound: number,
): Promise<string | null> {
  let round = startRound;
  let lastSeeded: number | null = null;

  for (;;) {
    const matches = await tx.tournamentMatch.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { sortOrder: "asc" }],
    });

    if (!roundIsComplete(matches, round)) {
      break;
    }

    // Already advanced past this round (idempotent under concurrent picks)
    if (matches.some((m) => m.round > round)) {
      break;
    }

    const winners = matches
      .filter((m) => m.round === round && m.winnerId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.winnerId)
      .filter((id): id is string => Boolean(id));

    if (winners.length === 0) break;

    if (winners.length === 1) {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "COMPLETE" },
      });
      return "Winner recorded — champion crowned";
    }

    const nextRound = round + 1;
    const pairings = buildRoundPairings(winners, `R${nextRound}`);
    await tx.tournamentMatch.createMany({
      data: pairings.map((p, index) => ({
        tournamentId,
        round: nextRound,
        sortOrder: index,
        label: p.label,
        trainerAId: p.trainerAId,
        trainerBId: p.trainerBId,
        winnerId: p.trainerAId && !p.trainerBId ? p.trainerAId : null,
      })),
    });

    lastSeeded = nextRound;
    round = nextRound;
  }

  if (lastSeeded == null) return null;
  return `Winner recorded — round ${lastSeeded} seeded`;
}

function isValidReactionEmoji(emoji: string): boolean {
  const trimmed = emoji.trim();
  // Allow any single emoji / ZWJ sequence; reject blanks and junk payloads.
  if (!trimmed || trimmed.length > 32) return false;
  if (/\s/.test(trimmed)) return false;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  return true;
}

function isValidStatusEmoji(emoji: string): boolean {
  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 16) return false;
  if (/\s/.test(trimmed)) return false;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  return true;
}

export async function toggleActivityReactionAction(input: {
  activityId: string;
  emoji: string;
}): Promise<ActionResult> {
  try {
    if (!isValidReactionEmoji(input.emoji)) {
      return { ok: false, error: "Unsupported reaction" };
    }
    const userId = await requireUserId();
    const prisma = getPrisma();
    const activity = await prisma.activityEvent.findUnique({
      where: { id: input.activityId },
      include: {
        challenge: { select: { slug: true, visibility: true } },
      },
    });
    if (!activity) return { ok: false, error: "Activity not found" };

    const access = await getAccessForChallenge(activity.challengeId);
    if (
      !canViewChallenge({
        visibility: activity.challenge.visibility,
        source: "database",
        hasMembership: Boolean(access?.role),
      })
    ) {
      return { ok: false, error: "Not allowed" };
    }

    const existing = await prisma.activityReaction.findUnique({
      where: {
        activityId_userId_emoji: {
          activityId: input.activityId,
          userId,
          emoji: input.emoji,
        },
      },
    });

    if (existing) {
      await prisma.activityReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.activityReaction.create({
        data: {
          activityId: input.activityId,
          userId,
          emoji: input.emoji,
        },
      });
    }

    // Invalidate Upstash short-circuit so other clients refetch reaction state.
    void bumpActivityReactionRev(activity.challengeId);

    // No revalidate — client is optimistic; Pack feed polls for freshness.
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reaction failed",
    };
  }
}

/** Lightweight Pack feed poll / paginated activity page fetch. */
export async function fetchChallengeActivitiesAction(input: {
  slug: string;
  cursor?: string | null;
  limit?: number;
  /** Client watermark — when it matches Redis/DB head, skip the fat read. */
  head?: string | null;
}): Promise<ActivityPage> {
  const session = await auth();
  const challenge = await getChallengeAccessFields(input.slug);
  if (!challenge) return { items: [], nextCursor: null, unchanged: false };

  const access =
    challenge.source === "database"
      ? await getAccessForChallenge(challenge.id)
      : null;
  if (
    !canViewChallenge({
      visibility: challenge.visibility,
      source: challenge.source,
      hasMembership: Boolean(access?.role),
    })
  ) {
    return { items: [], nextCursor: null, unchanged: false };
  }

  // Upstash short-circuit for idle polls (zero Neon when head matches).
  if (input.head && !input.cursor && challenge.source === "database") {
    const cachedHead = await readActivityHead(challenge.id);
    if (cachedHead && cachedHead === input.head) {
      return {
        items: [],
        nextCursor: null,
        head: cachedHead,
        unchanged: true,
      };
    }
  }

  const page = await listChallengeActivities(input.slug, session?.user?.id, {
    cursor: input.cursor,
    limit: input.limit,
  });

  if (
    challenge.source === "database" &&
    page.head &&
    !input.cursor
  ) {
    void publishActivityHead(challenge.id, page.head);
  }

  if (challenge.source === "database" && page.head) {
    return {
      ...page,
      head: await withReactionHead(challenge.id, page.head),
    };
  }

  return page;
}
