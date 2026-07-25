import { CATCH_ROUTES } from "@/data/catch-routes";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";

export type EncounterClaim = {
  trainerId: string;
  trainerHandle: string;
  pokemonId: string;
  species: string;
  nickname: string | null;
  pokedexId: number | null;
  isShiny: boolean;
  slot: PokemonEntry["slot"];
  isAlive: boolean;
};

export type EncounterRouteGroup = {
  route: string;
  claims: EncounterClaim[];
};

const ROUTE_ORDER = new Map(
  CATCH_ROUTES.map((route, index) => [route.toLowerCase(), index]),
);

/** Build a light ledger from catch-route fields already on trainer boards. */
export function buildEncounterLedger(
  trainers: TrainerProfile[],
): EncounterRouteGroup[] {
  const map = new Map<string, { route: string; claims: EncounterClaim[] }>();

  for (const trainer of trainers) {
    for (const mon of trainer.pokemon) {
      const route = mon.catchRoute?.trim();
      if (!route) continue;
      const key = route.toLowerCase();
      const group = map.get(key) ?? { route, claims: [] };
      group.claims.push({
        trainerId: trainer.id,
        trainerHandle: trainer.handle,
        pokemonId: mon.id,
        species: mon.species,
        nickname: mon.nickname,
        pokedexId: mon.pokedexId,
        isShiny: mon.isShiny,
        slot: mon.slot,
        isAlive: mon.slot !== "GRAVEYARD",
      });
      map.set(key, group);
    }
  }

  return [...map.values()]
    .map((g) => ({
      route: g.route,
      claims: g.claims.sort((a, b) =>
        a.trainerHandle.localeCompare(b.trainerHandle),
      ),
    }))
    .sort((a, b) => {
      const ai = ROUTE_ORDER.get(a.route.toLowerCase()) ?? 10_000;
      const bi = ROUTE_ORDER.get(b.route.toLowerCase()) ?? 10_000;
      if (ai !== bi) return ai - bi;
      return a.route.localeCompare(b.route);
    });
}
