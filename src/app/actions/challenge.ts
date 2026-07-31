"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { findSpecies } from "@/data/species";
import { getPrisma } from "@/lib/db";
import {
  getAccessForChallenge,
  requireGm,
  requireTrainerEditAccess,
  requireUserId,
} from "@/lib/permissions";
import {
  AccountUpdateSchema,
  PokemonEntryInputSchema,
  PokemonSlotSchema,
  TrainerBoardUpdateSchema,
} from "@/lib/types";
import { sanitizeHandle } from "@/lib/handles";
import {
  CUSTOM_AVATAR_PREFIX,
  customAvatarKey,
  isOwnedCustomAvatarUrl,
  parseAvatarKey,
} from "@/lib/sprites";
import {
  canUseCustomTextureUrl,
  customTextureKey,
  parseCustomTextureUrl,
} from "@/lib/custom-texture";
import { isAvatarBackgroundKey } from "@/data/avatar-backgrounds";
import { isCardBackgroundKey } from "@/data/card-backgrounds";
import { findPokemonById, searchPokemonIndex } from "@/data/pokemon-index";
import type { ActivityItem } from "@/lib/challenge-types";
import { listChallengeActivities } from "@/lib/challenges";
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
import { getChallenge } from "@/lib/challenges";
import { ChallengeStatusSchema } from "@/lib/types";
import {
  buildFirstRoundPairings,
  buildRoundPairings,
  roundIsComplete,
} from "@/lib/tournament";

function jsonStatOrNull(
  value: StatSpread | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null || isEmptySpread(value)) return Prisma.DbNull;
  return value;
}

/** League board + trainer board only — avoids refreshing Setup/Rules/FAQ chrome. */
function revalidateBoardViews(slug: string, trainerId?: string) {
  revalidatePath(`/challenges/${slug}`);
  revalidatePath(`/challenges/${slug}/memorial`);
  if (trainerId) {
    revalidatePath(`/challenges/${slug}/trainers/${trainerId}`);
  }
}

/** Heavier season-wide invalidation (GM/meta/join flows). */
function revalidateChallenge(slug: string, trainerId?: string) {
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

async function logActivity(input: {
  challengeId: string;
  actorId?: string;
  trainerId?: string;
  type:
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
  message: string;
}) {
  await getPrisma().activityEvent.create({
    data: {
      challengeId: input.challengeId,
      actorId: input.actorId,
      trainerId: input.trainerId,
      type: input.type,
      message: input.message,
    },
  });

  // Don't await — Discord outages must not block board saves.
  void dispatchDiscordWebhook({
    challengeId: input.challengeId,
    type: input.type,
    message: input.message,
  });
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

    await prisma.trainerProfile.update({
      where: { id: trainer.id },
      data: { userId },
    });

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
        if (!alreadySaved && !isOwnedCustomAvatarUrl(avatar.url, userId)) {
          return { ok: false, error: "Invalid custom avatar" };
        }
        data.avatarSpriteKey = customAvatarKey(avatar.url);
      } else {
        const avatar = parseAvatarKey(raw);
        if (avatar.kind === "pokemon") {
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
        data.reviveUsed = true;
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "REVIVE_USED",
          message: `${data.handle ?? trainer.handle} used their Revive Token`,
        });
      } else if (!updates.reviveUsed && trainer.reviveUsed && access.isGm) {
        data.reviveUsed = false;
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "REVIVE_RESET",
          message: `GM reset Revive Token for ${data.handle ?? trainer.handle}`,
        });
      } else if (updates.reviveUsed === trainer.reviveUsed) {
        // no-op
      } else if (!access.isGm && !updates.reviveUsed) {
        return { ok: false, error: "Only a GM can reset a used Revive Token" };
      } else {
        data.reviveUsed = updates.reviveUsed;
      }
    }

    const statusChanged =
      (updates.statusText !== undefined &&
        updates.statusText !== trainer.statusText) ||
      (updates.statusEmoji !== undefined &&
        updates.statusEmoji !== trainer.statusEmoji);
    if (statusChanged) {
      await logActivity({
        challengeId: trainer.challengeId,
        actorId: userId,
        trainerId: trainer.id,
        type: "STATUS_UPDATE",
        message: `${data.handle ?? trainer.handle} updated status`,
      });
    }

    if (Object.keys(data).length === 0) {
      return { ok: true, message: "Nothing to update" };
    }

    await prisma.trainerProfile.update({
      where: { id: trainer.id },
      data,
    });

    // Soft refresh: league cards + this trainer. Client keeps optimistic drafts.
    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Board updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

/** Restart the living run: clear playable slots + badges, keep memorial/revive. */
export async function recordWipeAction(input: {
  trainerId: string;
}): Promise<ActionResult> {
  try {
    const { trainer, userId } = await requireTrainerEditAccess(input.trainerId);

    const prisma = getPrisma();
    let wipeCount = 0;
    let wipeMessage = "";

    await prisma.$transaction(async (tx) => {
      await tx.pokemonEntry.deleteMany({
        where: {
          trainerId: trainer.id,
          slot: { in: ["MAIN", "RESERVE", "ENCOUNTERED"] },
        },
      });
      await tx.badgeProgress.updateMany({
        where: { trainerId: trainer.id },
        data: { earned: false, earnedAt: null },
      });
      const updated = await tx.trainerProfile.update({
        where: { id: trainer.id },
        data: {
          wipeCount: { increment: 1 },
          statusText: null,
          statusEmoji: null,
          // Living board is empty — unlock so the run can be rebuilt.
          mainSquadLocked: false,
        },
        select: { wipeCount: true },
      });
      wipeCount = updated.wipeCount;
      wipeMessage = `${trainer.handle} restarted their run (wipe #${wipeCount})`;
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

export async function setBadgeProgressAction(input: {
  trainerId: string;
  badgeKey: string;
  earned: boolean;
  /** Reject stale writes that raced a wipe (client wipeCount at schedule time). */
  expectedWipeCount?: number;
}): Promise<ActionResult> {
  try {
    const { trainer, userId } = await requireTrainerEditAccess(input.trainerId);
    if (
      input.expectedWipeCount != null &&
      trainer.wipeCount !== input.expectedWipeCount
    ) {
      return { ok: false, error: "Board changed — refresh and try again" };
    }
    const prisma = getPrisma();
    const badge = await prisma.badgeDefinition.findFirst({
      where: { challengeId: trainer.challengeId, key: input.badgeKey },
    });
    if (!badge) return { ok: false, error: "Badge not found" };

    await prisma.badgeProgress.upsert({
      where: {
        trainerId_badgeId: { trainerId: trainer.id, badgeId: badge.id },
      },
      create: {
        trainerId: trainer.id,
        badgeId: badge.id,
        earned: input.earned,
        earnedAt: input.earned ? new Date() : null,
      },
      update: {
        earned: input.earned,
        earnedAt: input.earned ? new Date() : null,
      },
    });

    await logActivity({
      challengeId: trainer.challengeId,
      actorId: userId,
      trainerId: trainer.id,
      type: input.earned ? "BADGE_EARNED" : "BADGE_REVOKED",
      message: input.earned
        ? `${trainer.handle} earned ${badge.label}`
        : `${trainer.handle} lost ${badge.label}`,
    });

    // League board only — avoid remounting the trainer editor mid-toggle.
    revalidatePath(`/challenges/${trainer.challenge.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Badge update failed" };
  }
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
      await prisma.pokemonEntry.update({
        where: { id: data.id },
        data: payload,
      });
      if (
        existing.slot !== "GRAVEYARD" &&
        data.slot === "GRAVEYARD"
      ) {
        await logActivity({
          challengeId: trainer.challengeId,
          actorId: userId,
          trainerId: trainer.id,
          type: "DEATH",
          message: `${trainer.handle} memorialized ${data.nickname || data.species}`,
        });
      }
    } else {
      await prisma.pokemonEntry.create({
        data: { trainerId: trainer.id, ...payload },
      });
      await logActivity({
        challengeId: trainer.challengeId,
        actorId: userId,
        trainerId: trainer.id,
        type: data.slot === "GRAVEYARD" ? "DEATH" : "CATCH",
        message:
          data.slot === "GRAVEYARD"
            ? `${trainer.handle} memorialized ${data.nickname || data.species}`
            : `${trainer.handle} logged ${data.nickname || data.species}`,
      });
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
      for (const update of data.updates) {
        const mon = byId.get(update.id)!;
        if (mon.slot !== "GRAVEYARD" && update.slot === "GRAVEYARD") {
          memorialized.push({
            id: update.id,
            label: mon.nickname || mon.species,
          });
        }
        await tx.pokemonEntry.update({
          where: { id: update.id },
          data: { slot: update.slot, partyIndex: update.partyIndex },
        });
      }

      for (const entry of memorialized) {
        const message = `${trainer.handle} memorialized ${entry.label}`;
        await tx.activityEvent.create({
          data: {
            challengeId: trainer.challengeId,
            actorId: userId,
            trainerId: trainer.id,
            type: "DEATH",
            message,
          },
        });
        discordDeaths.push(message);
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
  /** Which board slots to overwrite from this import. */
  replaceSlots: z
    .array(PokemonSlotSchema)
    .default(["MAIN", "RESERVE", "GRAVEYARD", "ENCOUNTERED"]),
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

    // All imported slots (including ENCOUNTERED) mirror this save snapshot.
    // Encountered is wild buffer ∪ Pokédex seen — re-import replaces the ledger
    // so it matches the save rather than accumulating across imports.
    const indexes: Record<string, number> = {
      MAIN: 0,
      RESERVE: 0,
      GRAVEYARD: 0,
      ENCOUNTERED: 0,
    };

    const replaceSet = new Set(data.replaceSlots);
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

    const rows = data.pokemon
      .filter((mon) => replaceSet.has(mon.slot))
      .filter((mon) => {
        if (mon.slot !== "ENCOUNTERED") return true;
        const key = encounterDedupeKey(mon);
        if (seenEncounterKeys.has(key)) return false;
        seenEncounterKeys.add(key);
        return true;
      })
      .map((mon) => {
        const speciesMeta = findSpecies(mon.species);
        const indexHit =
          (mon.pokedexId ? findPokemonById(mon.pokedexId) : undefined) ??
          (speciesMeta
            ? findPokemonById(speciesMeta.pokedexId)
            : undefined) ??
          searchPokemonIndex(mon.species.trim().toLowerCase(), {
            limit: 8,
          }).find(
            (p) => p.name.toLowerCase() === mon.species.trim().toLowerCase(),
          );

        const partyIndex = indexes[mon.slot] ?? 0;
        indexes[mon.slot] = partyIndex + 1;

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
          notes: `Imported from save (${mon.slot.toLowerCase()})`,
        };
      });

    await prisma.$transaction(async (tx) => {
      if (data.replaceSlots.length > 0) {
        await tx.pokemonEntry.deleteMany({
          where: {
            trainerId: trainer.id,
            slot: { in: data.replaceSlots },
          },
        });
      }
      if (rows.length > 0) {
        await tx.pokemonEntry.createMany({ data: rows });
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
      message: `${handleLabel} imported save data (${rows.length} Pokémon)`,
    });

    revalidateBoardViews(trainer.challenge.slug, trainer.id);
    return {
      ok: true,
      message: `Imported ${rows.length} Pokémon from save`,
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
      type: "RULE_UPDATED",
      message: "Rules updated by Game Master",
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
        type: "MAIN_SQUAD_LOCKED",
        message: `${trainer.handle}'s Main Squad locked`,
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
  visibility?: "INVITE" | "UNLISTED" | "PUBLIC";
  status?: "DRAFT" | "ACTIVE" | "TOURNAMENT" | "ARCHIVED";
  playerInviteCode?: string;
  gmInviteCode?: string;
  description?: string;
  discordWebhookUrl?: string | null;
  welcomeVideoPublishAt?: string | null;
}): Promise<ActionResult> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();

    const status = input.status
      ? ChallengeStatusSchema.parse(input.status)
      : undefined;

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
        visibility: input.visibility,
        status,
        playerInviteCode: input.playerInviteCode,
        gmInviteCode: input.gmInviteCode,
        description: input.description,
        ...(webhookUrl !== undefined
          ? { discordWebhookUrl: webhookUrl }
          : {}),
        ...(welcomeVideoPublishAt !== undefined
          ? { welcomeVideoPublishAt }
          : {}),
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

    // No revalidate — client is optimistic; Pack feed polls for freshness.
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reaction failed",
    };
  }
}

/** Lightweight Pack feed poll (activities + reaction aggregates). */
export async function fetchChallengeActivitiesAction(input: {
  slug: string;
}): Promise<ActivityItem[]> {
  const session = await auth();
  const challenge = await getChallenge(input.slug, session?.user?.id);
  if (!challenge) return [];

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  if (
    !canViewChallenge({
      visibility: challenge.visibility,
      source: challenge.source,
      hasMembership: Boolean(access?.role),
    })
  ) {
    return [];
  }

  return listChallengeActivities(input.slug, session?.user?.id);
}
