import {
  CATCH_ROUTE_TABLE,
  findCatchRoute,
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

/** Owned board slots — Encountered stubs are seen-not-owned. */
function isOwnedSlot(slot: PokemonEntry["slot"]): boolean {
  return slot === "MAIN" || slot === "RESERVE" || slot === "GRAVEYARD";
}

/**
 * Catch-route strings for mons the trainer owns (party / box / memorial).
 * Merges live `pokemon` with SSR `ownedCatchRoutes` when the board is MAIN-only.
 */
export function ownedCatchRouteLabels(
  trainer: TrainerProfile,
): string[] {
  const labels: string[] = [];
  for (const pokemon of trainer.pokemon) {
    if (!isOwnedSlot(pokemon.slot)) continue;
    const route = pokemon.catchRoute?.trim();
    if (route) labels.push(route);
  }
  for (const route of trainer.ownedCatchRoutes ?? []) {
    const trimmed = route.trim();
    if (trimmed) labels.push(trimmed);
  }
  return labels;
}

/**
 * Encounter `slotKey`s already claimed by an owned Pokémon's catch route.
 * Safari Zone umbrella catches are tracked separately — area bits never stamp
 * on the mon, so they cannot be matched by slotKey alone.
 */
function ownedEncounterSlotKeys(catchRoutes: readonly string[]): {
  slotKeys: Set<number>;
  hasUmbrellaSafari: boolean;
} {
  const slotKeys = new Set<number>();
  let hasUmbrellaSafari = false;
  for (const logged of catchRoutes) {
    const catalog = findCatchRoute(logged);
    if (!catalog) continue;
    if (catalog.label === "Safari Zone") hasUmbrellaSafari = true;
    if (catalog.slotKey != null) slotKeys.add(catalog.slotKey);
  }
  return { slotKeys, hasUmbrellaSafari };
}

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

  // MAIN-only SSR: owned box / memorial routes still close those slots for
  // claim status even when the Pokémon rows are not on the Flight payload.
  for (const loggedRoute of trainer.ownedCatchRoutes ?? []) {
    const catalogRoute = catalogByKey.get(normalizeCatchRoute(loggedRoute));
    if (!catalogRoute) continue;
    if (claimsByLabel.has(catalogRoute.label)) continue;
    claimsByLabel.set(catalogRoute.label, []);
  }

  const safariAreaKeys = new Set(
    MODERN_SAFARI_ZONE_AREAS.map(({ route }) => normalizeCatchRoute(route)),
  );
  const flagClaimedLabels = new Set<string>();

  // Full NuzlockeEncounterFlags bitset (includes fled / failed / released burns).
  if (trainer.nuzlockeEncounterBitsReliable) {
    const usedBits = new Set(trainer.nuzlockeEncounterBits ?? []);
    for (const route of catalog) {
      if (route.nuzlockeBit != null && usedBits.has(route.nuzlockeBit)) {
        flagClaimedLabels.add(route.label);
      }
    }
  } else if (trainer.safariZoneAreasReliable) {
    // Legacy Safari-only imports before full bitset persistence.
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
  const hasUmbrellaSafariClaim =
    claimsByLabel.has("Safari Zone") ||
    (trainer.ownedCatchRoutes ?? []).some(
      (route) => normalizeCatchRoute(route) === "safari zone",
    );
  const safariFlagsKnown =
    trainer.nuzlockeEncounterBitsReliable || trainer.safariZoneAreasReliable;
  const unresolvedRoutes =
    !safariFlagsKnown && hasUmbrellaSafariClaim
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
        // Empty claims from ownedCatchRoutes still count as a pokemon source —
        // the mon exists, it just is not on the MAIN-only Flight payload.
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

const SAFARI_AREA_BITS = new Set<number>(
  MODERN_SAFARI_ZONE_AREAS.map(({ encounterFlag }) => encounterFlag),
);

/**
 * Open-slot burns with no owned Pokémon catch on that slot (fled / failed /
 * released). Ignores Encountered stubs. Safari area bits are skipped when the
 * trainer has an umbrella "Safari Zone" catch (ROM never stamps the area).
 *
 * Returns null when save flags have not been imported yet.
 */
export function countSpentWithoutCatch(
  trainer: TrainerProfile,
  catalog: readonly CatchRoute[] = CATCH_ROUTE_TABLE,
): number | null {
  if (
    !trainer.nuzlockeEncounterBitsReliable &&
    !trainer.safariZoneAreasReliable
  ) {
    return null;
  }

  const ownedRoutes = ownedCatchRouteLabels(trainer);

  if (trainer.nuzlockeEncounterBitsReliable) {
    return countCatchFailedFromBits(
      trainer.nuzlockeEncounterBits ?? [],
      ownedRoutes,
      catalog,
    );
  }

  const { hasUmbrellaSafari } = ownedEncounterSlotKeys(ownedRoutes);
  // Legacy Safari-only imports: count flagged areas that are not covered by an
  // umbrella Safari catch (we cannot tell which area succeeded).
  if (hasUmbrellaSafari) return 0;
  return (trainer.safariZoneAreas ?? []).filter((route) =>
    MODERN_SAFARI_ZONE_AREAS.some((area) => area.route === route),
  ).length;
}

/**
 * Import / preview: spent NuzlockeEncounterFlags vs catch-failed (flag set,
 * no owned mon on that slot). `exhausted` is unique catalog slots with a set
 * bit; `failed` matches {@link countSpentWithoutCatch}'s full-bitset path.
 */
export function summarizeEncounterFlagBits(
  usedBits: readonly number[],
  ownedCatchRoutes: readonly string[],
  catalog: readonly CatchRoute[] = CATCH_ROUTE_TABLE,
): { exhausted: number; failed: number } {
  const usedSet = new Set(usedBits);
  const exhaustedSlots = new Set<number>();
  for (const route of catalog) {
    if (route.nuzlockeBit == null || !usedSet.has(route.nuzlockeBit)) {
      continue;
    }
    if (route.slotKey == null) continue;
    exhaustedSlots.add(route.slotKey);
  }
  return {
    exhausted: exhaustedSlots.size,
    failed: countCatchFailedFromBits(usedBits, ownedCatchRoutes, catalog),
  };
}

function countCatchFailedFromBits(
  usedBits: readonly number[],
  ownedCatchRoutes: readonly string[],
  catalog: readonly CatchRoute[] = CATCH_ROUTE_TABLE,
): number {
  const usedSet = new Set(usedBits);
  const { slotKeys: ownedSlots, hasUmbrellaSafari } =
    ownedEncounterSlotKeys(ownedCatchRoutes);
  let count = 0;
  for (const route of catalog) {
    if (route.nuzlockeBit == null || !usedSet.has(route.nuzlockeBit)) {
      continue;
    }
    if (route.slotKey == null) continue;
    if (ownedSlots.has(route.slotKey)) continue;
    if (hasUmbrellaSafari && SAFARI_AREA_BITS.has(route.nuzlockeBit)) {
      continue;
    }
    count += 1;
  }
  return count;
}
