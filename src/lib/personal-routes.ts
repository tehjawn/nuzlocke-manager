import { CATCH_ROUTES } from "@/data/catch-routes";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";

export type PersonalRouteClaim = {
  nickname: string | null;
  pokemonId: string;
  slot: PokemonEntry["slot"];
  species: string;
};

export type PersonalRouteGroup = {
  claims: PersonalRouteClaim[];
  route: string;
};

export type PersonalRouteStatus = {
  catalogSize: number;
  claimedRoutes: PersonalRouteGroup[];
  openRoutes: string[];
  otherRoutes: PersonalRouteGroup[];
  trainerHandle: string;
  trainerId: string;
};

export function buildPersonalRouteStatus(
  trainer: TrainerProfile,
  catalog: readonly string[] = CATCH_ROUTES,
): PersonalRouteStatus {
  const catalogByKey = new Map(
    catalog.map((route) => [normalizeRoute(route), route]),
  );
  const claimedByKey = new Map<string, PersonalRouteGroup>();
  const otherByKey = new Map<string, PersonalRouteGroup>();

  for (const pokemon of trainer.pokemon) {
    const loggedRoute = pokemon.catchRoute?.trim();
    if (!loggedRoute) continue;

    const key = normalizeRoute(loggedRoute);
    const catalogRoute = catalogByKey.get(key);
    const groups = catalogRoute ? claimedByKey : otherByKey;
    const group = groups.get(key) ?? {
      claims: [],
      route: catalogRoute ?? loggedRoute,
    };
    group.claims.push({
      nickname: pokemon.nickname,
      pokemonId: pokemon.id,
      slot: pokemon.slot,
      species: pokemon.species,
    });
    groups.set(key, group);
  }

  const claimedRoutes = catalog.flatMap((route) => {
    const group = claimedByKey.get(normalizeRoute(route));
    return group ? [group] : [];
  });

  return {
    catalogSize: catalog.length,
    claimedRoutes,
    openRoutes: catalog.filter(
      (route) => !claimedByKey.has(normalizeRoute(route)),
    ),
    otherRoutes: [...otherByKey.values()].sort((a, b) =>
      a.route.localeCompare(b.route),
    ),
    trainerHandle: trainer.handle,
    trainerId: trainer.id,
  };
}

export function buildPersonalRouteStatuses(
  trainers: TrainerProfile[],
  catalog: readonly string[] = CATCH_ROUTES,
): PersonalRouteStatus[] {
  return trainers.map((trainer) => buildPersonalRouteStatus(trainer, catalog));
}

function normalizeRoute(route: string): string {
  return route.trim().toLowerCase();
}
