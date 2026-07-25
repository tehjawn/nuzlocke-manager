"use client";

import { useEffect } from "react";
import { useJump } from "@/features/jump/JumpProvider";
import type { JumpSeasonContext } from "@/features/jump/jump-types";
import type { Challenge } from "@/lib/challenge-types";

type SeasonJumpRegistrarProps = {
  challenge: Challenge;
  showGm?: boolean;
  myTrainerId?: string | null;
};

/**
 * Registers the loaded season graph with Jump while this tree is mounted.
 * Clears on unmount so leaving a season drops trainer/Pokémon results.
 */
export function SeasonJumpRegistrar({
  challenge,
  showGm = false,
  myTrainerId = null,
}: SeasonJumpRegistrarProps) {
  const { registerSeason } = useJump();

  useEffect(() => {
    const ctx: JumpSeasonContext = {
      slug: challenge.slug,
      name: challenge.name,
      year: challenge.year,
      status: challenge.status,
      showGm,
      myTrainerId,
      trainers: challenge.trainers.map((t) => ({
        id: t.id,
        handle: t.handle,
        realName: t.realName,
        discordUsername: t.discordUsername,
        avatarSpriteKey: t.avatarSpriteKey,
        earnedBadgeKeys: t.earnedBadgeKeys,
        statusText: t.statusText,
        pokemon: t.pokemon.map((p) => ({
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
      badges: challenge.badges.map((b) => ({
        key: b.key,
        label: b.label,
        category: b.category,
        leaderName: b.leaderName,
      })),
      rules: challenge.rules.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
      })),
      faqs: challenge.faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
      })),
    };

    registerSeason(ctx);
    return () => registerSeason(null);
  }, [challenge, showGm, myTrainerId, registerSeason]);

  return null;
}
