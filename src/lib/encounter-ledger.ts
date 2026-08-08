import { CATCH_ROUTE_TABLE, CATCH_ROUTES } from "@/data/catch-routes";
import { MODERN_SAFARI_ZONE_AREAS } from "@/data/safari-zone";
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
  flagClaims: EncounterFlagClaim[];
  kind: "catch-records" | "route";
  route: string;
  claims: EncounterClaim[];
};

export type EncounterFlagClaim = {
  trainerHandle: string;
  trainerId: string;
};

const ROUTE_ORDER = new Map(
  CATCH_ROUTES.map((route, index) => [route.toLowerCase(), index]),
);

/** Build a light ledger from catch-route fields already on trainer boards. */
export function buildEncounterLedger(
  trainers: TrainerProfile[],
): EncounterRouteGroup[] {
  const map = new Map<string, EncounterRouteGroup>();

  function groupFor(route: string, kind: EncounterRouteGroup["kind"]) {
    const key = route.toLowerCase();
    const group = map.get(key) ?? { route, kind, claims: [], flagClaims: [] };
    map.set(key, group);
    return group;
  }

  for (const trainer of trainers) {
    for (const mon of trainer.pokemon) {
      const route = mon.catchRoute?.trim();
      if (!route) continue;
      const group = groupFor(
        route.toLowerCase() === "safari zone"
          ? "Safari Zone — unresolved catch records"
          : route,
        route.toLowerCase() === "safari zone" ? "catch-records" : "route",
      );
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
    }

    if (trainer.nuzlockeEncounterBitsReliable) {
      const usedBits = new Set(trainer.nuzlockeEncounterBits ?? []);
      for (const route of CATCH_ROUTE_TABLE) {
        if (route.nuzlockeBit == null || !usedBits.has(route.nuzlockeBit)) {
          continue;
        }
        // Only labels that own the ROM bit — aliasesRoute101 siblings share a
        // slotKey but must not each get a flag claim (same as seed UI).
        groupFor(route.label, "route").flagClaims.push({
          trainerId: trainer.id,
          trainerHandle: trainer.handle,
        });
      }
      continue;
    }

    // Legacy Safari-only imports before full bitset persistence.
    if (!trainer.safariZoneAreasReliable) continue;
    for (const route of trainer.safariZoneAreas ?? []) {
      if (!MODERN_SAFARI_ZONE_AREAS.some((area) => area.route === route)) {
        continue;
      }
      groupFor(route, "route").flagClaims.push({
        trainerId: trainer.id,
        trainerHandle: trainer.handle,
      });
    }
  }

  return [...map.values()]
    .map((g) => ({
      route: g.route,
      kind: g.kind,
      claims: g.claims.sort((a, b) =>
        a.trainerHandle.localeCompare(b.trainerHandle),
      ),
      flagClaims: g.flagClaims.sort((a, b) =>
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
