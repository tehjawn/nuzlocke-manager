/**
 * Tools board hydrate (#367) — SSR stays on summary; panels that need grades,
 * moves, or competitive spreads fetch them after mount and merge by Pokémon id.
 */

import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import type { ToolsId } from "@/lib/tools-routes";

export type ToolsHydrateKind = "grades" | "moves" | "competitive";

/** Which deferred fetch a tool needs after the shared summary SSR. */
export function toolsHydrateKindFor(
  tool: ToolsId | null,
): ToolsHydrateKind | null {
  if (tool === "bounty") return "grades";
  if (tool === "planner" || tool === "pokedex" || tool === "guide") {
    return "moves";
  }
  return null;
}

export type ToolsHydrateTrainerSlice = {
  id: string;
  pokemon: PokemonEntry[];
};

export type ToolsHydratePayload = {
  trainers: ToolsHydrateTrainerSlice[];
  competitiveTrainerIds: string[];
};

/**
 * Overlay hydrated Pokémon fields onto the summary board. Unknown trainers /
 * ids in the hydrate payload are ignored — the SSR board remains authoritative
 * for identity.
 */
export function mergeToolsPokemonHydrate(
  base: TrainerProfile[],
  hydrate: ToolsHydratePayload,
): { trainers: TrainerProfile[]; competitiveTrainerIds: string[] } {
  const byTrainer = new Map(
    hydrate.trainers.map((t) => [t.id, new Map(t.pokemon.map((p) => [p.id, p]))]),
  );

  const trainers = base.map((trainer) => {
    const hydrated = byTrainer.get(trainer.id);
    if (!hydrated) return trainer;
    return {
      ...trainer,
      pokemon: trainer.pokemon.map((p) => {
        const next = hydrated.get(p.id);
        if (!next) return p;
        return { ...p, ...next, id: p.id, slot: p.slot };
      }),
    };
  });

  return {
    trainers,
    competitiveTrainerIds: hydrate.competitiveTrainerIds,
  };
}

/**
 * Append ENCOUNTERED stubs onto an owned-slot Tools board (#382). Idempotent
 * when the same ids are already present.
 */
export function mergeToolsEncounteredStubs(
  base: TrainerProfile[],
  stubs: ToolsHydrateTrainerSlice[],
): TrainerProfile[] {
  const byTrainer = new Map(stubs.map((t) => [t.id, t.pokemon]));
  return base.map((trainer) => {
    const extra = byTrainer.get(trainer.id);
    if (!extra?.length) return trainer;
    const have = new Set(trainer.pokemon.map((p) => p.id));
    const add = extra.filter((p) => !have.has(p.id));
    if (add.length === 0) return trainer;
    return { ...trainer, pokemon: [...trainer.pokemon, ...add] };
  });
}
