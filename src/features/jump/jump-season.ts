import type { JumpSeasonContext } from "@/features/jump/jump-types";
import type { Challenge } from "@/lib/challenge-types";

/**
 * Slim, JSON-safe season payload for the Jump client index.
 * Built on the server so we don't ship full Pokémon forms / activities
 * into the client component Flight props (large prod graphs).
 */
export function challengeToJumpSeasonContext(
  challenge: Challenge,
  options?: { showGm?: boolean; myTrainerId?: string | null },
): JumpSeasonContext {
  return {
    slug: challenge.slug,
    name: challenge.name,
    year: challenge.year,
    status: challenge.status,
    showGm: Boolean(options?.showGm),
    myTrainerId: options?.myTrainerId ?? null,
    trainers: (challenge.trainers ?? []).map((t) => ({
      id: t.id,
      handle: t.handle,
      realName: t.realName,
      discordUsername: t.discordUsername,
      discordDisplayName: t.discordDisplayName,
      avatarSpriteKey: t.avatarSpriteKey,
      earnedBadgeKeys: t.earnedBadgeKeys ?? [],
      statusText: t.statusText,
      pokemon: (t.pokemon ?? []).map((p) => ({
        id: p.id,
        slot: p.slot,
        nickname: p.nickname,
        species: p.species,
        pokedexId: p.pokedexId,
        isShiny: p.isShiny,
        catchRoute: p.catchRoute,
        level: p.level,
      })),
    })),
    badges: (challenge.badges ?? []).map((b) => ({
      key: b.key,
      label: b.label,
      category: b.category,
      leaderName: b.leaderName,
    })),
    rules: (challenge.rules ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
    })),
    faqs: (challenge.faqs ?? []).map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
    })),
  };
}

/** Root-layout default: identity only until a season page registers the index. */
export function briefToJumpSeasonContext(brief: {
  slug: string;
  name: string;
  year: number;
  status: Challenge["status"];
}): JumpSeasonContext {
  return {
    slug: brief.slug,
    name: brief.name,
    year: brief.year,
    status: brief.status,
    showGm: false,
    myTrainerId: null,
    trainers: [],
    badges: [],
    rules: [],
    faqs: [],
  };
}
