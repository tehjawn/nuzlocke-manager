"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { failAction } from "@/lib/action-error";
import { getPrisma } from "@/lib/db";
import { getAccessForChallenge, requireUserId } from "@/lib/permissions";
import {
  SURVIVAL_COMMENT_MAX,
  castSurvivalVote,
  getSurvivalMarketForPokemon,
  listSurvivalMarketsForChallenge,
} from "@/lib/survival-markets";
import type {
  SurvivalMarketListItem,
  SurvivalMarketView,
} from "@/lib/survival-market-types";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; code?: string };

function revalidateBoardViews(slug: string, trainerId?: string) {
  updateTag(`season:${slug}:board`);
  revalidateTag(`season:${slug}`, "max");
  revalidatePath(`/challenges/${slug}`);
  revalidatePath(`/challenges/${slug}/season-stats`);
  revalidatePath(`/challenges/${slug}/activity`);
  if (trainerId) {
    revalidatePath(`/challenges/${slug}/trainers/${trainerId}`);
  }
}

const CastVoteSchema = z.object({
  pokemonId: z.string().min(1),
  prediction: z.enum(["SURVIVE", "DIE"]),
  comment: z
    .string()
    .max(SURVIVAL_COMMENT_MAX)
    .optional()
    .nullable(),
});

export async function castSurvivalVoteAction(
  raw: unknown,
): Promise<ActionResult> {
  try {
    const data = CastVoteSchema.parse(raw);
    const userId = await requireUserId();
    const prisma = getPrisma();
    const mon = await prisma.pokemonEntry.findUnique({
      where: { id: data.pokemonId },
      select: {
        trainerId: true,
        trainer: {
          select: {
            challengeId: true,
            challenge: { select: { slug: true } },
          },
        },
      },
    });
    if (!mon) return { ok: false, error: "Pokémon not found" };

    const access = await getAccessForChallenge(mon.trainer.challengeId);
    if (!access?.role) {
      return { ok: false, error: "Join this season to vote" };
    }

    const result = await castSurvivalVote({
      pokemonId: data.pokemonId,
      userId,
      prediction: data.prediction,
      comment: data.comment,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidateBoardViews(mon.trainer.challenge.slug, mon.trainerId);
    revalidatePath(`/challenges/${mon.trainer.challenge.slug}/tools`);
    return { ok: true, message: "Vote saved" };
  } catch (e) {
    return failAction("survival-vote-failed", e, "Couldn’t save vote");
  }
}

/** Details modal — full market + callers (or empty open shell). */
export async function getSurvivalMarketAction(input: {
  pokemonId: string;
}): Promise<SurvivalMarketView | null> {
  try {
    const prisma = getPrisma();
    const mon = await prisma.pokemonEntry.findUnique({
      where: { id: input.pokemonId },
      select: {
        trainer: { select: { challengeId: true } },
      },
    });
    if (!mon) return null;
    const access = await getAccessForChallenge(mon.trainer.challengeId);
    return getSurvivalMarketForPokemon({
      pokemonId: input.pokemonId,
      viewerUserId: access?.userId ?? null,
      isMember: Boolean(access?.role),
    });
  } catch {
    return null;
  }
}

/** Survive/Die Tools board — slim season markets (void excluded). */
export async function listSurvivalMarketsAction(input: {
  slug: string;
}): Promise<SurvivalMarketListItem[]> {
  try {
    const prisma = getPrisma();
    const challenge = await prisma.challenge.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (!challenge) return [];
    const access = await getAccessForChallenge(challenge.id);
    return listSurvivalMarketsForChallenge({
      challengeId: challenge.id,
      viewerUserId: access?.userId ?? null,
    });
  } catch {
    return [];
  }
}
