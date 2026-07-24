import type {
  Challenge,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import type { PokemonType } from "@/lib/pokemon-types";
import { POKEMON_TYPES } from "@/lib/pokemon-types";

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
    statusText: string | null;
    reviveUsed: boolean;
    mainSquadLocked: boolean;
    sortOrder: number;
    userId: string | null;
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
      nature: string | null;
      level: number | null;
      ability: string | null;
      catchRoute: string | null;
      heldItem: string | null;
      moves: string[];
      causeOfDeath: string | null;
    }>;
  }>;
  activities?: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: Date;
    trainer: { handle: string } | null;
  }>;
};

function asTypes(types: string[]): PokemonType[] {
  return types.filter((t): t is PokemonType =>
    (POKEMON_TYPES as readonly string[]).includes(t),
  );
}

export function mapDbChallenge(row: DbChallenge): Challenge {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    year: row.year,
    game: row.game ?? "Unknown",
    description: row.description ?? "",
    status: row.status,
    visibility: row.visibility,
    playerInviteCode: row.playerInviteCode,
    gmInviteCode: row.gmInviteCode,
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
    activities: row.activities?.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      trainerHandle: a.trainer?.handle ?? null,
    })),
  };
}

export function mapDbTrainer(
  trainer: DbChallenge["trainers"][number],
): TrainerProfile {
  return {
    id: trainer.id,
    handle: trainer.handle,
    realName: trainer.realName,
    avatarSpriteKey: trainer.avatarSpriteKey ?? "brendan",
    statusText: trainer.statusText,
    reviveUsed: trainer.reviveUsed,
    mainSquadLocked: trainer.mainSquadLocked,
    sortOrder: trainer.sortOrder,
    userId: trainer.userId,
    earnedBadgeKeys: trainer.badges
      .filter((b) => b.earned)
      .map((b) => b.badge.key),
    pokemon: trainer.pokemon.map((p) => ({
      id: p.id,
      slot: p.slot,
      partyIndex: p.partyIndex,
      nickname: p.nickname,
      species: p.species,
      pokedexId: p.pokedexId,
      isShiny: p.isShiny,
      types: asTypes(p.types),
      nature: p.nature,
      level: p.level,
      ability: p.ability,
      catchRoute: p.catchRoute,
      heldItem: p.heldItem,
      moves: p.moves,
      causeOfDeath: p.causeOfDeath,
    })),
  };
}
