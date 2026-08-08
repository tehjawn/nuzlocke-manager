import {
  CATCH_ROUTE_TABLE,
  findCatchRoute,
  normalizeCatchRoute,
  type CatchRouteEncounter,
} from "@/data/catch-routes";
import {
  HOENN_MAP_LABELS,
  HOENN_MAP_REGIONS,
  type HoennMapRegion,
} from "@/data/hoenn-map-zones";
import type {
  EncounterClaim,
  EncounterFlagClaim,
  EncounterRouteGroup,
} from "@/lib/encounter-ledger";
import type { PersonalRouteStatus } from "@/lib/personal-routes";

/**
 * Focus-trainer checklist fill for a zone (or empty when no wild slots).
 * - unclaimed: 0 of N open slots claimed
 * - partial: some but not all open slots claimed
 * - claimed: all open slots claimed (fully claimed)
 */
export type MapRouteClaimStatus =
  | "unclaimed"
  | "partial"
  | "claimed"
  | "empty";

/** Stable display order for wild-table methods. */
export const MAP_ENCOUNTER_METHODS: readonly CatchRouteEncounter[] = [
  "land",
  "water",
  "fishing",
  "rock-smash",
];

export type MapRouteRow = {
  label: string;
  /** Focus trainer spent this open slot. */
  focusClaimed: boolean;
  /** ROM wild-table methods for this catch-route label. */
  methods: readonly CatchRouteEncounter[];
  /** Focus trainer's Pokémon claims on this route (encounters toggle). */
  focusClaims: EncounterClaim[];
  /** Focus trainer's Safari / encounter-flag claims on this route. */
  focusFlagClaims: EncounterFlagClaim[];
};

export type MapZoneStatus = {
  zone: HoennMapRegion;
  /** Aggregate fill from focus open-slot progress in this region. */
  status: MapRouteClaimStatus;
  claimedOpenSlots: number;
  openSlots: number;
  /** Open-slot labels only (static / gift routes omitted). */
  rows: MapRouteRow[];
};

/** Flattened open slot for the map planning checklist. */
export type MapOpenSlot = {
  zoneId: string;
  zoneName: string;
  label: string;
  methods: readonly CatchRouteEncounter[];
};

export type MapZoneFilter = {
  /** When true, fully claimed zones are dimmed / omitted from the open list. */
  unclaimedOnly: boolean;
  /** Empty = all methods. Otherwise OR-match unclaimed (or any) slots. */
  methods: readonly CatchRouteEncounter[];
};

function ledgerByRoute(
  groups: EncounterRouteGroup[],
): Map<string, EncounterRouteGroup> {
  const map = new Map<string, EncounterRouteGroup>();
  for (const group of groups) {
    map.set(normalizeCatchRoute(group.route), group);
  }
  return map;
}

function focusClaimedKeys(status: PersonalRouteStatus | null): Set<string> {
  if (!status) return new Set();
  const claimed = new Set(
    status.claimedRoutes.map((g) => normalizeCatchRoute(g.route)),
  );
  for (const group of status.legacyClaims) {
    claimed.add(normalizeCatchRoute(group.route));
  }
  for (const group of status.offRouteClaims) {
    claimed.add(normalizeCatchRoute(group.route));
  }
  for (const group of status.otherRoutes) {
    claimed.add(normalizeCatchRoute(group.route));
  }
  return claimed;
}

function aggregateZoneStatus(
  claimedCount: number,
  slotTotal: number,
): MapRouteClaimStatus {
  if (slotTotal === 0) return "empty";
  if (claimedCount <= 0) return "unclaimed";
  if (claimedCount >= slotTotal) return "claimed";
  return "partial";
}

/** Build per-region focus-trainer claim status from personal routes + ledger. */
export function buildEncounterMapStatuses(
  groups: EncounterRouteGroup[],
  focusStatus: PersonalRouteStatus | null,
): MapZoneStatus[] {
  const byRoute = ledgerByRoute(groups);
  const claimed = focusClaimedKeys(focusStatus);
  const focusId = focusStatus?.trainerId ?? null;

  return HOENN_MAP_REGIONS.map((zone) => {
    const rows: MapRouteRow[] = [];
    for (const label of zone.labels) {
      const catalog = findCatchRoute(label);
      if (!(catalog?.countsTowardOpen ?? false)) continue;

      const key = normalizeCatchRoute(label);
      const group = byRoute.get(key);
      const allClaims = group?.claims ?? [];
      const allFlags = group?.flagClaims ?? [];
      rows.push({
        label,
        focusClaimed: claimed.has(key),
        methods: catalog?.encounters ?? [],
        focusClaims: focusId
          ? allClaims.filter((claim) => claim.trainerId === focusId)
          : [],
        focusFlagClaims: focusId
          ? allFlags.filter((claim) => claim.trainerId === focusId)
          : [],
      });
    }

    const claimedOpenSlots = rows.filter((row) => row.focusClaimed).length;
    const openSlots = rows.length - claimedOpenSlots;

    return {
      zone,
      status: aggregateZoneStatus(claimedOpenSlots, rows.length),
      claimedOpenSlots,
      openSlots,
      rows,
    };
  });
}

/** Whether a zone should stay emphasized under the planning filters. */
export function zoneMatchesMapFilter(
  zone: MapZoneStatus,
  filter: MapZoneFilter,
): boolean {
  if (zone.status === "empty") return false;
  if (filter.unclaimedOnly && zone.status === "claimed") return false;

  if (filter.methods.length === 0) return true;

  // Method chips always mean “still claimable via this method.”
  const methodSet = new Set(filter.methods);
  return zone.rows.some(
    (row) =>
      !row.focusClaimed &&
      row.methods.some((method) => methodSet.has(method)),
  );
}

/** Unclaimed open-slot rows across matching zones (map order, unclaimed first). */
export function listOpenSlotsForMap(
  zones: MapZoneStatus[],
  filter: MapZoneFilter,
): MapOpenSlot[] {
  const slots: MapOpenSlot[] = [];
  for (const zone of zones) {
    if (!zoneMatchesMapFilter(zone, filter)) continue;
    for (const row of zone.rows) {
      if (row.focusClaimed) continue;
      if (
        filter.methods.length > 0 &&
        !row.methods.some((method) => filter.methods.includes(method))
      ) {
        continue;
      }
      slots.push({
        zoneId: zone.zone.id,
        zoneName: zone.zone.name,
        label: row.label,
        methods: row.methods,
      });
    }
  }
  return slots;
}

export function countOpenSlots(zones: MapZoneStatus[]): number {
  return zones.reduce((sum, zone) => sum + zone.openSlots, 0);
}

/** Catalog open-slot labels that are not drawn on any region (graceful omit). */
export function unmappedOpenCatchRoutes(): string[] {
  return CATCH_ROUTE_TABLE.filter(
    (route) =>
      route.countsTowardOpen && !HOENN_MAP_LABELS.has(route.label),
  ).map((route) => route.label);
}

export function mapStatusLabel(status: MapRouteClaimStatus): string {
  switch (status) {
    case "claimed":
      return "Fully claimed";
    case "partial":
      return "Partially claimed";
    case "unclaimed":
      return "Unclaimed";
    case "empty":
      return "No wild slot";
    default:
      return status;
  }
}

export function mapMethodLabel(method: CatchRouteEncounter): string {
  switch (method) {
    case "land":
      return "Grass";
    case "water":
      return "Surf";
    case "fishing":
      return "Fishing";
    case "rock-smash":
      return "Rock Smash";
    default:
      return method;
  }
}

/** Sort methods into the canonical Grass → Surf → Fishing → Rock Smash order. */
export function sortMapMethods(
  methods: readonly CatchRouteEncounter[],
): CatchRouteEncounter[] {
  const order = new Map(
    MAP_ENCOUNTER_METHODS.map((method, index) => [method, index]),
  );
  return [...methods].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99),
  );
}
