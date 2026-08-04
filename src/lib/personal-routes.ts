import {
  CATCH_ROUTE_TABLE,
  normalizeCatchRoute,
  type CatchRoute,
} from "@/data/catch-routes";
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
  /** Other catalog labels that share this row's in-game encounter flag. */
  sharedWith?: string[];
  source?: "encounter-flag" | "pokemon";
};

export type PersonalRouteStatus = {
  catalogSize: number;
  claimedRoutes: PersonalRouteGroup[];
  /**
   * Claims on umbrella labels the ROM cannot pin to one area ("Safari Zone",
   * pre-split imports). They did consume an encounter — we just can't say which.
   */
  legacyClaims: PersonalRouteGroup[];
  /** Claims on gifts, fossils, statics and legendaries — not encounter slots. */
  offRouteClaims: PersonalRouteGroup[];
  openRoutes: string[];
  otherRoutes: PersonalRouteGroup[];
  /** Labels that share an already-open slot, keyed by the slot's primary label. */
  sharedSlotLabels: Record<string, string[]>;
  unresolvedRoutes: string[];
  trainerHandle: string;
  trainerId: string;
};

export function buildPersonalRouteStatus(
  trainer: TrainerProfile,
  catalog: readonly CatchRoute[] = CATCH_ROUTE_TABLE,
): PersonalRouteStatus {
  const catalogByKey = new Map<string, CatchRoute>();
  for (const route of catalog) {
    catalogByKey.set(normalizeCatchRoute(route.label), route);
    for (const alias of route.aliases) {
      const key = normalizeCatchRoute(alias);
      if (!catalogByKey.has(key)) catalogByKey.set(key, route);
    }
  }

  const claimsByLabel = new Map<string, PersonalRouteClaim[]>();
  const otherByKey = new Map<string, PersonalRouteGroup>();

  for (const pokemon of trainer.pokemon) {
    const loggedRoute = pokemon.catchRoute?.trim();
    if (!loggedRoute) continue;

    const claim: PersonalRouteClaim = {
      nickname: pokemon.nickname,
      pokemonId: pokemon.id,
      slot: pokemon.slot,
      species: pokemon.species,
    };
    // Claims key off the catalog label so an alias and its canonical label merge.
    const catalogRoute = catalogByKey.get(normalizeCatchRoute(loggedRoute));
    if (!catalogRoute) {
      const key = normalizeCatchRoute(loggedRoute);
      const group = otherByKey.get(key) ?? {
        claims: [],
        route: loggedRoute,
        source: "pokemon" as const,
      };
      group.claims.push(claim);
      otherByKey.set(key, group);
      continue;
    }
    const existing = claimsByLabel.get(catalogRoute.label);
    if (existing) existing.push(claim);
    else claimsByLabel.set(catalogRoute.label, [claim]);
  }

  const safariAreaKeys = new Set(
    MODERN_SAFARI_ZONE_AREAS.map(({ route }) => normalizeCatchRoute(route)),
  );
  const flagClaimedLabels = new Set<string>();
  if (trainer.safariZoneAreasReliable) {
    for (const loggedRoute of trainer.safariZoneAreas ?? []) {
      const key = normalizeCatchRoute(loggedRoute);
      const catalogRoute = catalogByKey.get(key);
      if (!catalogRoute || !safariAreaKeys.has(key)) continue;
      flagClaimedLabels.add(catalogRoute.label);
    }
  }

  /**
   * The six Safari areas are flag-only: Modern Emerald stamps every Safari catch
   * with the umbrella mapsec, so a Pokémon record can never name an area. When a
   * trainer has an umbrella claim but no readable flags those areas are
   * unknowable rather than open — but only then, so a trainer who has never
   * logged a Safari catch is not nagged to re-import.
   */
  const hasUmbrellaSafariClaim = claimsByLabel.has("Safari Zone");
  const unresolvedRoutes =
    !trainer.safariZoneAreasReliable && hasUmbrellaSafariClaim
      ? catalog
          .filter((route) => safariAreaKeys.has(normalizeCatchRoute(route.label)))
          .map((route) => route.label)
      : [];
  const unresolvedSet = new Set(unresolvedRoutes);

  // One entry per in-game encounter slot. Several catalog rows can share a slot:
  // the ROM's LUT zero-fills, so every untracked area burns Route 101's flag.
  const slots = new Map<number, CatchRoute[]>();
  const legacyClaims: PersonalRouteGroup[] = [];
  const offRouteClaims: PersonalRouteGroup[] = [];
  for (const route of catalog) {
    if (route.slotKey != null) {
      const members = slots.get(route.slotKey);
      if (members) members.push(route);
      else slots.set(route.slotKey, [route]);
      continue;
    }
    const claims = claimsByLabel.get(route.label);
    if (!claims) continue;
    const group: PersonalRouteGroup = {
      claims,
      route: route.label,
      source: "pokemon",
    };
    if (route.kind === "legacy") legacyClaims.push(group);
    else offRouteClaims.push(group);
  }

  const claimedRoutes: PersonalRouteGroup[] = [];
  const openRoutes: string[] = [];
  const sharedSlotLabels: Record<string, string[]> = {};
  for (const members of slots.values()) {
    // The row that owns the ROM's flag leads the slot; the rest ride along.
    const primary = members.find((route) => route.nuzlockeBit != null) ?? members[0];
    const shared = members
      .filter((route) => route !== primary)
      .map((route) => route.label);

    const claimed = members.filter((route) => claimsByLabel.has(route.label));
    const flagClaimed = members.filter((route) => flagClaimedLabels.has(route.label));
    if (claimed.length > 0 || flagClaimed.length > 0) {
      const owner = claimed[0] ?? flagClaimed[0];
      claimedRoutes.push({
        claims: members.flatMap((route) => claimsByLabel.get(route.label) ?? []),
        route: owner.label,
        ...(shared.length > 0 ? { sharedWith: shared } : {}),
        source: claimed.length > 0 ? "pokemon" : "encounter-flag",
      });
      continue;
    }
    if (unresolvedSet.has(primary.label)) continue;
    openRoutes.push(primary.label);
    if (shared.length > 0) sharedSlotLabels[primary.label] = shared;
  }

  return {
    catalogSize: slots.size,
    claimedRoutes,
    legacyClaims,
    offRouteClaims,
    openRoutes,
    otherRoutes: [...otherByKey.values()].sort((a, b) =>
      a.route.localeCompare(b.route),
    ),
    sharedSlotLabels,
    unresolvedRoutes,
    trainerHandle: trainer.handle,
    trainerId: trainer.id,
  };
}

export function buildPersonalRouteStatuses(
  trainers: TrainerProfile[],
  catalog: readonly CatchRoute[] = CATCH_ROUTE_TABLE,
): PersonalRouteStatus[] {
  return trainers.map((trainer) => buildPersonalRouteStatus(trainer, catalog));
}
