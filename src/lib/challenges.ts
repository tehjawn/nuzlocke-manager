import { CHALLENGES } from "@/data/trash-pack-2026";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";

export function listChallenges(): Challenge[] {
  return CHALLENGES;
}

export function getChallenge(slug: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.slug === slug);
}

export function getTrainer(
  slug: string,
  trainerId: string,
): { challenge: Challenge; trainer: TrainerProfile } | undefined {
  const challenge = getChallenge(slug);
  if (!challenge) return undefined;
  const trainer = challenge.trainers.find((t) => t.id === trainerId);
  if (!trainer) return undefined;
  return { challenge, trainer };
}

export function pokemonInSlot(
  trainer: TrainerProfile,
  slot: PokemonEntry["slot"],
): PokemonEntry[] {
  return trainer.pokemon
    .filter((p) => p.slot === slot)
    .sort((a, b) => a.partyIndex - b.partyIndex);
}

export function mainSquad(trainer: TrainerProfile): PokemonEntry[] {
  const mains = pokemonInSlot(trainer, "MAIN");
  const slots: (PokemonEntry | null)[] = Array.from({ length: 6 }, (_, i) => {
    return mains.find((p) => p.partyIndex === i) ?? null;
  });
  // If partyIndex gaps, still show existing mons packed left for display helpers
  return slots.filter(Boolean) as PokemonEntry[];
}

export function displayName(trainer: TrainerProfile): string {
  return trainer.realName
    ? `${trainer.handle} (${trainer.realName})`
    : trainer.handle;
}
