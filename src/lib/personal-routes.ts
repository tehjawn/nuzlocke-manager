import { CATCH_ROUTES } from "@/data/catch-routes";
import { MODERN_SAFARI_ZONE_AREAS } from "@/data/safari-zone";
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
  source?: "encounter-flag" | "pokemon";
};

export type PersonalRouteStatus = {
  catalogSize: number;
  claimedRoutes: PersonalRouteGroup[];
  openRoutes: string[];
  otherRoutes: PersonalRouteGroup[];
  unresolvedRoutes: string[];
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
      source: "pokemon" as const,
    };
    group.claims.push({
      nickname: pokemon.nickname,
      pokemonId: pokemon.id,
      slot: pokemon.slot,
      species: pokemon.species,
    });
    groups.set(key, group);
  }

  const safariAreaKeys = new Set(
    MODERN_SAFARI_ZONE_AREAS.map(({ route }) => normalizeRoute(route)),
  );
  if (trainer.safariZoneAreasReliable) {
    for (const loggedRoute of trainer.safariZoneAreas ?? []) {
      const key = normalizeRoute(loggedRoute);
      const catalogRoute = catalogByKey.get(key);
      if (!catalogRoute || !safariAreaKeys.has(key)) continue;
      if (!claimedByKey.has(key)) {
        claimedByKey.set(key, {
          claims: [],
          route: catalogRoute,
          source: "encounter-flag",
        });
      }
    }
  }

  const hasLegacySafariClaim = trainer.pokemon.some(
    (pokemon) => normalizeRoute(pokemon.catchRoute ?? "") === "safari zone",
  );
  const unresolvedRoutes =
    !trainer.safariZoneAreasReliable && hasLegacySafariClaim
      ? catalog.filter((route) => {
          const key = normalizeRoute(route);
          return safariAreaKeys.has(key) && !claimedByKey.has(key);
        })
      : [];

  const claimedRoutes = catalog.flatMap((route) => {
    const group = claimedByKey.get(normalizeRoute(route));
    return group ? [group] : [];
  });

  return {
    catalogSize: catalog.length,
    claimedRoutes,
    openRoutes: catalog.filter(
      (route) =>
        !claimedByKey.has(normalizeRoute(route)) &&
        !unresolvedRoutes.includes(route),
    ),
    otherRoutes: [...otherByKey.values()].sort((a, b) =>
      a.route.localeCompare(b.route),
    ),
    unresolvedRoutes,
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
