"use server";

import { failAction } from "@/lib/action-error";
import {
  pokemonSummarySelect,
  pokemonToolsMovesSelect,
} from "@/lib/challenge-queries";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  GM_ANALYTICS_SECTIONS,
  buildGmAppReport,
  buildGmGameReport,
  buildGmPokemonReport,
  buildGmTrainersReport,
  type GmAnalyticsSection,
  type GmAppReport,
  type GmGameReport,
  type GmPokemonReport,
  type GmTrainersReport,
} from "@/lib/gm-analytics";
import { mapPokemonRow } from "@/lib/map-pokemon-row";
import { requireGm } from "@/lib/permissions";

type ActionFail = { ok: false; error: string; code?: string };

export type GmAnalyticsPayload =
  | { ok: true; section: "app"; report: GmAppReport }
  | { ok: true; section: "trainers"; report: GmTrainersReport }
  | { ok: true; section: "pokemon"; report: GmPokemonReport }
  | { ok: true; section: "game"; report: GmGameReport };

const pokemonAnalyticsSelect = {
  ...pokemonToolsMovesSelect,
  heldItem: true,
} as const;

function isSection(value: string): value is GmAnalyticsSection {
  return (GM_ANALYTICS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Lazy GM Analytics by section (#404). Each section loads only the columns it
 * needs so other GM console tabs stay cheap (#365).
 */
export async function fetchGmAnalyticsAction(input: {
  slug: string;
  section: GmAnalyticsSection;
}): Promise<GmAnalyticsPayload | ActionFail> {
  try {
    if (!isDatabaseConfigured()) {
      return { ok: false, error: "Database is not configured" };
    }
    if (!isSection(input.section)) {
      return { ok: false, error: "Invalid analytics section" };
    }

    const prisma = getPrisma();
    const challengeMeta = await prisma.challenge.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (!challengeMeta) return { ok: false, error: "Season not found" };
    await requireGm(challengeMeta.id);

    switch (input.section) {
      case "app":
        return { ok: true, section: "app", report: await loadApp(input.slug) };
      case "trainers":
        return {
          ok: true,
          section: "trainers",
          report: await loadTrainers(input.slug),
        };
      case "pokemon":
        return {
          ok: true,
          section: "pokemon",
          report: await loadPokemon(input.slug),
        };
      case "game":
        return {
          ok: true,
          section: "game",
          report: await loadGame(input.slug),
        };
    }
  } catch (e) {
    return failAction("fetchGmAnalyticsAction", e, "Could not load analytics");
  }
}

async function loadApp(slug: string): Promise<GmAppReport> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: {
      id: true,
      trainers: {
        select: {
          id: true,
          handle: true,
          sortOrder: true,
          userId: true,
          wipeCount: true,
          completionCount: true,
          money: true,
          playTimeSeconds: true,
          introCompletedAt: true,
          nuzlockeEncounterBits: true,
          nuzlockeEncounterBitsReliable: true,
          safariZoneAreas: true,
          safariZoneAreasReliable: true,
          badges: {
            where: { earned: true },
            select: { badge: { select: { key: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!challenge) throw new Error("Season not found");

  const [activityGroups, activeTrainerRows] = await Promise.all([
    prisma.activityEvent.groupBy({
      by: ["type"],
      where: { challengeId: challenge.id, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.activityEvent.findMany({
      where: {
        challengeId: challenge.id,
        createdAt: { gte: since },
        trainerId: { not: null },
      },
      select: { trainerId: true },
      distinct: ["trainerId"],
    }),
  ]);

  const activityLast7d = activityGroups.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  return buildGmAppReport({
    trainers: challenge.trainers.map((t) => ({
      id: t.id,
      handle: t.handle,
      sortOrder: t.sortOrder,
      userId: t.userId,
      wipeCount: t.wipeCount,
      completionCount: t.completionCount,
      money: t.money,
      playTimeSeconds: t.playTimeSeconds,
      introCompletedAt: t.introCompletedAt,
      earnedBadgeKeys: t.badges.map((b) => b.badge.key),
      nuzlockeEncounterBits: t.nuzlockeEncounterBits,
      nuzlockeEncounterBitsReliable: t.nuzlockeEncounterBitsReliable,
      safariZoneAreas: t.safariZoneAreas,
      safariZoneAreasReliable: t.safariZoneAreasReliable,
    })),
    activityLast7d,
    activeTrainers7d: activeTrainerRows.length,
    activityByType: activityGroups.map((row) => ({
      type: row.type,
      count: row._count._all,
    })),
  });
}

async function loadTrainers(slug: string): Promise<GmTrainersReport> {
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: {
      trainers: {
        where: { userId: { not: null } },
        select: {
          id: true,
          handle: true,
          sortOrder: true,
          userId: true,
          wipeCount: true,
          completionCount: true,
          money: true,
          playTimeSeconds: true,
          introCompletedAt: true,
          nuzlockeEncounterBits: true,
          nuzlockeEncounterBitsReliable: true,
          safariZoneAreas: true,
          safariZoneAreasReliable: true,
          badges: {
            where: { earned: true },
            select: { badge: { select: { key: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!challenge) throw new Error("Season not found");

  return buildGmTrainersReport(
    challenge.trainers.map((t) => ({
      id: t.id,
      handle: t.handle,
      sortOrder: t.sortOrder,
      userId: t.userId,
      wipeCount: t.wipeCount,
      completionCount: t.completionCount,
      money: t.money,
      playTimeSeconds: t.playTimeSeconds,
      introCompletedAt: t.introCompletedAt,
      earnedBadgeKeys: t.badges.map((b) => b.badge.key),
      nuzlockeEncounterBits: t.nuzlockeEncounterBits,
      nuzlockeEncounterBitsReliable: t.nuzlockeEncounterBitsReliable,
      safariZoneAreas: t.safariZoneAreas,
      safariZoneAreasReliable: t.safariZoneAreasReliable,
    })),
  );
}

async function loadPokemon(slug: string): Promise<GmPokemonReport> {
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: {
      trainers: {
        where: { userId: { not: null } },
        select: {
          id: true,
          handle: true,
          pokemon: {
            select: pokemonAnalyticsSelect,
            orderBy: [
              { slot: "asc" as const },
              { partyIndex: "asc" as const },
            ],
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!challenge) throw new Error("Season not found");

  return buildGmPokemonReport({
    claimedTrainerCount: challenge.trainers.length,
    trainers: challenge.trainers.map((t) => ({
      id: t.id,
      handle: t.handle,
      pokemon: t.pokemon.map((row) => mapPokemonRow(row)),
    })),
  });
}

async function loadGame(slug: string): Promise<GmGameReport> {
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: {
      trainers: {
        where: { userId: { not: null } },
        select: {
          id: true,
          handle: true,
          nuzlockeEncounterBits: true,
          nuzlockeEncounterBitsReliable: true,
          safariZoneAreas: true,
          safariZoneAreasReliable: true,
          pokemon: {
            select: pokemonSummarySelect,
            orderBy: [
              { slot: "asc" as const },
              { partyIndex: "asc" as const },
            ],
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!challenge) throw new Error("Season not found");

  return buildGmGameReport({
    trainers: challenge.trainers.map((t) => ({
      id: t.id,
      handle: t.handle,
      bits: t.nuzlockeEncounterBits,
      bitsReliable: t.nuzlockeEncounterBitsReliable,
      safariAreas: t.safariZoneAreas,
      safariReliable: t.safariZoneAreasReliable,
      pokemon: t.pokemon.map((row) => mapPokemonRow(row)),
    })),
  });
}
