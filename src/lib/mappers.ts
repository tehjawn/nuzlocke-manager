import type {
  Challenge,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { coalesceActivityItems } from "@/lib/activity-messages";
import { parseAvatarBackgroundKey } from "@/data/avatar-backgrounds";
import { parseCardBackgroundKey } from "@/data/card-backgrounds";
import { avatarImageUrl } from "@/lib/sprites";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import { clampEvs, clampIvs, IvsSchema, parseStatSpread } from "@/lib/stats";

type DbChallenge = {
  id: string;
  slug: string;
  name: string;
  year: number;
  game: string | null;
  description: string | null;
  status: Challenge["status"];
  visibility: Challenge["visibility"];
  playerInviteCode: string | null;
  gmInviteCode: string | null;
  welcomeVideoUrl: string | null;
  welcomeVideoPublishAt: Date | null;
  romUrl: string | null;
  survivalMarketsEnabled?: boolean;
  badges: Array<{
    id: string;
    key: string;
    label: string;
    category: string;
    sortOrder: number;
    leaderName: string | null;
  }>;
  rules: Array<{
    id: string;
    sortOrder: number;
    title: string | null;
    body: string;
    isCore: boolean;
  }>;
  faqs: Array<{
    id: string;
    sortOrder: number;
    question: string;
    answer: string;
  }>;
  trainers: Array<{
    id: string;
    handle: string;
    realName: string | null;
    avatarSpriteKey: string | null;
    avatarBackgroundKey: string | null;
    cardBackgroundKey: string | null;
    statusText: string | null;
    statusEmoji: string | null;
    reviveUsed: boolean;
    wipeCount: number;
    completionCount?: number;
    runEndedAt?: Date | null;
    money?: number | null;
    playTimeSeconds?: number | null;
    safariZoneAreas?: string[];
    safariZoneAreasReliable?: boolean;
    nuzlockeEncounterBits?: number[];
    nuzlockeEncounterBitsReliable?: boolean;
    activeRunId: string | null;
    introCompletedAt?: Date | null;
    mainSquadLocked: boolean;
    sortOrder: number;
    userId: string | null;
    updatedAt: Date;
    user?: {
      discordUsername: string | null;
      displayName: string | null;
      name: string | null;
    } | null;
    badges: Array<{ earned: boolean; badge: { key: string } }>;
    pokemon: Array<{
      id: string;
      slot: PokemonEntry["slot"];
      partyIndex: number;
      nickname: string | null;
      species: string;
      pokedexId: number | null;
      isShiny: boolean;
      types: string[];
      nature?: string | null;
      level: number | null;
      ability?: string | null;
      catchRoute: string | null;
      heldItem?: string | null;
      moves?: string[];
      ivs?: unknown;
      evs?: unknown;
      friendship?: number | null;
      causeOfDeath: string | null;
      diedOnRun: number | null;
      runId: string | null;
      updatedAt: Date;
    }>;
  }>;
  activities?: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: Date;
    trainer: {
      id: string;
      handle: string;
      avatarSpriteKey: string | null;
    } | null;
    actor: { image: string | null } | null;
    reactions?: Array<{ emoji: string; userId: string }>;
  }>;
};

/** Prefer linked trainer sprite, then Discord actor image. */
export function resolveActivityAvatarSrc(input: {
  trainerAvatarSpriteKey?: string | null;
  actorImage?: string | null;
}): string | null {
  const sprite = input.trainerAvatarSpriteKey?.trim();
  if (sprite) return avatarImageUrl(sprite);
  const image = input.actorImage?.trim();
  if (image) return image;
  return null;
}

export function mapDbChallenge(
  row: DbChallenge,
  viewerUserId?: string | null,
): Challenge {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    year: row.year,
    game: row.game ?? "Unknown",
    description: row.description ?? "",
    status: row.status,
    visibility: row.visibility,
    // Invite codes are secrets — never serialize into public Flight payloads.
    // GM console loads them via a privileged select (same pattern as webhook URL).
    playerInviteCode: null,
    gmInviteCode: null,
    welcomeVideoUrl: row.welcomeVideoUrl,
    welcomeVideoPublishAt: row.welcomeVideoPublishAt?.toISOString() ?? null,
    romUrl: row.romUrl,
    survivalMarketsEnabled: row.survivalMarketsEnabled ?? true,
    source: "database",
    badges: row.badges
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((b) => ({
        id: b.id,
        key: b.key,
        label: b.label,
        category: b.category,
        sortOrder: b.sortOrder,
        leaderName: b.leaderName,
      })),
    rules: row.rules
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({
        id: r.id,
        sortOrder: r.sortOrder,
        title: r.title,
        body: r.body,
        isCore: r.isCore,
      })),
    faqs: row.faqs
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        id: f.id,
        sortOrder: f.sortOrder,
        question: f.question,
        answer: f.answer,
      })),
    trainers: row.trainers
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mapDbTrainer),
    activities: coalesceActivityItems(
      row.activities?.map((a) => mapActivity(a, viewerUserId)) ?? [],
    ),
  };
}

function mapActivity(
  a: NonNullable<DbChallenge["activities"]>[number],
  viewerUserId?: string | null,
) {
  const counts = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of a.reactions ?? []) {
    const cur = counts.get(r.emoji) ?? { count: 0, reactedByMe: false };
    cur.count += 1;
    if (viewerUserId && r.userId === viewerUserId) cur.reactedByMe = true;
    counts.set(r.emoji, cur);
  }
  return {
    id: a.id,
    type: a.type,
    message: a.message,
    createdAt: a.createdAt.toISOString(),
    trainerId: a.trainer?.id ?? null,
    trainerHandle: a.trainer?.handle ?? null,
    avatarSrc: resolveActivityAvatarSrc({
      trainerAvatarSpriteKey: a.trainer?.avatarSpriteKey,
      actorImage: a.actor?.image,
    }),
    reactions: [...counts.entries()].map(([emoji, v]) => ({
      emoji,
      count: v.count,
      reactedByMe: v.reactedByMe,
    })),
  };
}

export function mapDbTrainer(
  trainer: DbChallenge["trainers"][number],
): TrainerProfile {
  const stamps = [
    trainer.updatedAt.getTime(),
    ...trainer.pokemon.map((p) => p.updatedAt.getTime()),
  ];
  const latest = Math.max(...stamps);

  return {
    id: trainer.id,
    handle: trainer.handle,
    realName: trainer.realName,
    avatarSpriteKey: trainer.avatarSpriteKey ?? "brendan",
    avatarBackgroundKey: parseAvatarBackgroundKey(trainer.avatarBackgroundKey),
    cardBackgroundKey: parseCardBackgroundKey(trainer.cardBackgroundKey),
    statusText: trainer.statusText,
    statusEmoji: trainer.statusEmoji,
    reviveUsed: trainer.reviveUsed,
    safariZoneAreas: trainer.safariZoneAreas,
    safariZoneAreasReliable: trainer.safariZoneAreasReliable,
    nuzlockeEncounterBits: trainer.nuzlockeEncounterBits,
    nuzlockeEncounterBitsReliable: trainer.nuzlockeEncounterBitsReliable,
    wipeCount: trainer.wipeCount ?? 0,
    activeRunNumber: (trainer.wipeCount ?? 0) + 1,
    completionCount: trainer.completionCount ?? 0,
    runEnded: trainer.runEndedAt != null,
    money: trainer.money ?? null,
    playTimeSeconds: trainer.playTimeSeconds ?? null,
    mainSquadLocked: trainer.mainSquadLocked,
    introCompleted: trainer.introCompletedAt != null,
    sortOrder: trainer.sortOrder,
    userId: trainer.userId,
    discordUsername: trainer.user?.discordUsername ?? null,
    discordDisplayName:
      trainer.user?.displayName ?? trainer.user?.name ?? null,
    earnedBadgeKeys: trainer.badges
      .filter((b) => b.earned)
      .map((b) => b.badge.key),
    updatedAt: Number.isFinite(latest)
      ? new Date(latest).toISOString()
      : null,
    pokemon: trainer.pokemon.map((p) => ({
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
      nature: p.nature ?? null,
      level: p.level,
      ability: p.ability ?? null,
      catchRoute: p.catchRoute,
      heldItem: p.heldItem ?? null,
      moves: p.moves ?? [],
      ivs: (() => {
        if (p.ivs == null) return null;
        const parsed = IvsSchema.safeParse(p.ivs);
        return clampIvs(
          parsed.success ? parsed.data : (parseStatSpread(p.ivs) ?? undefined),
        );
      })(),
      evs: p.evs != null ? clampEvs(parseStatSpread(p.evs) ?? undefined) : null,
      friendship:
        typeof p.friendship === "number" &&
        Number.isInteger(p.friendship) &&
        p.friendship >= 0 &&
        p.friendship <= 255
          ? p.friendship
          : null,
      causeOfDeath: p.causeOfDeath,
      diedOnRun: p.diedOnRun ?? null,
      runId: p.runId ?? null,
    })),
  };
}
