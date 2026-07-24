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
import { parseAvatarKey } from "@/lib/sprites";
import { findPokemonById, searchPokemonIndex } from "@/data/pokemon-index";

function revalidateChallenge(slug: string, trainerId?: string) {
  revalidatePath(`/challenges/${slug}`);
  revalidatePath(`/challenges/${slug}/setup`);
  revalidatePath(`/challenges/${slug}/rules`);
  revalidatePath(`/challenges/${slug}/faq`);
  revalidatePath(`/challenges/${slug}/gm`);
  revalidatePath(`/challenges/${slug}/join`);
  if (trainerId) {
    revalidatePath(`/challenges/${slug}/trainers/${trainerId}`);
  }
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
    | "NOTE";
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
  avatarSpriteKey?: string | null;
  reviveUsed?: boolean;
  handle?: string;
  realName?: string | null;
}): Promise<ActionResult> {
  try {
    const parsed = TrainerBoardUpdateSchema.safeParse({
      statusText: input.statusText,
      avatarSpriteKey: input.avatarSpriteKey,
      reviveUsed: input.reviveUsed,
      handle: input.handle,
      realName: input.realName,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { trainer, access, userId } = await requireTrainerEditAccess(
      input.trainerId,
    );
    const prisma = getPrisma();
    const updates = parsed.data;

    const data: {
      statusText?: string | null;
      avatarSpriteKey?: string | null;
      reviveUsed?: boolean;
      realName?: string | null;
      handle?: string;
    } = {};

    if (updates.statusText !== undefined) data.statusText = updates.statusText;
    if (updates.avatarSpriteKey !== undefined) {
      const avatar = parseAvatarKey(updates.avatarSpriteKey);
      data.avatarSpriteKey =
        avatar.kind === "pokemon"
          ? updates.avatarSpriteKey
          : avatar.key;
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

    if (
      updates.statusText !== undefined &&
      updates.statusText !== trainer.statusText
    ) {
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

    revalidateChallenge(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Board updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function setBadgeProgressAction(input: {
  trainerId: string;
  badgeKey: string;
  earned: boolean;
}): Promise<ActionResult> {
  try {
    const { trainer, userId } = await requireTrainerEditAccess(input.trainerId);
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

    revalidateChallenge(trainer.challenge.slug, trainer.id);
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

    const types =
      data.types.length > 0 ? data.types : (speciesMeta?.types ?? []);
    const pokedexId =
      speciesMeta?.pokedexId ?? indexHit?.pokedexId ?? null;

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

    revalidateChallenge(trainer.challenge.slug, trainer.id);
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
    revalidateChallenge(trainer.challenge.slug, trainer.id);
    return { ok: true, message: "Pokémon removed" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

const SaveImportMonSchema = z.object({
  nickname: z.string().max(32).optional().nullable(),
  species: z.string().min(1).max(64),
  pokedexId: z.number().int().positive().optional().nullable(),
  level: z.number().int().min(1).max(100).optional().nullable(),
  isShiny: z.boolean().default(false),
  slot: PokemonSlotSchema,
});

const ImportFromSaveSchema = z.object({
  trainerId: z.string().min(1),
  pokemon: z.array(SaveImportMonSchema).max(80),
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
    const indexes: Record<string, number> = {
      MAIN: 0,
      RESERVE: 0,
      GRAVEYARD: 0,
      ENCOUNTERED: 0,
    };

    const replaceSet = new Set(data.replaceSlots);
    const rows = data.pokemon
      .filter((mon) => replaceSet.has(mon.slot))
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

        return {
          trainerId: trainer.id,
          slot: mon.slot,
          partyIndex,
          nickname: mon.nickname?.trim() || null,
          species: mon.species.trim(),
          pokedexId:
            mon.pokedexId ??
            speciesMeta?.pokedexId ??
            indexHit?.pokedexId ??
            null,
          isShiny: mon.isShiny,
          types: speciesMeta?.types ?? [],
          level: mon.level ?? null,
          nature: null,
          ability: null,
          catchRoute: null,
          heldItem: null,
          moves: [] as string[],
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
        if (rows.length > 0) {
          await tx.pokemonEntry.createMany({ data: rows });
        }
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

    revalidateChallenge(trainer.challenge.slug, trainer.id);
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
  playerInviteCode?: string;
  gmInviteCode?: string;
  description?: string;
}): Promise<ActionResult> {
  try {
    await requireGm(input.challengeId);
    const prisma = getPrisma();
    const challenge = await prisma.challenge.update({
      where: { id: input.challengeId },
      data: {
        visibility: input.visibility,
        playerInviteCode: input.playerInviteCode,
        gmInviteCode: input.gmInviteCode,
        description: input.description,
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

function isValidReactionEmoji(emoji: string): boolean {
  const trimmed = emoji.trim();
  // Allow any single emoji / ZWJ sequence; reject blanks and junk payloads.
  if (!trimmed || trimmed.length > 32) return false;
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
      include: { challenge: { select: { slug: true } } },
    });
    if (!activity) return { ok: false, error: "Activity not found" };

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

    revalidateChallenge(activity.challenge.slug);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reaction failed",
    };
  }
}
