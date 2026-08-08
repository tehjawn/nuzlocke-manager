import {
  CATCH_ROUTE_TABLE,
  findCatchRoute,
  isHatchSafeOutdoor,
  normalizeCatchRoute,
  type CatchRouteEncounter,
  type CatchRouteKind,
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
 * Hatch-safe labels never drive this status — see `hatchRows`.
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

/**
 * Planning chips: wild methods + outdoor no-wild-table filter.
 * `"no-wilds"` covers egg-only and empty-static met locations (gifts/fossils/hatches).
 */
export type MapMethodFilter = CatchRouteEncounter | "no-wilds";

export const MAP_METHOD_FILTERS: readonly MapMethodFilter[] = [
  ...MAP_ENCOUNTER_METHODS,
  "no-wilds",
];

/** How a no-wild-table label can be logged (catalog kind). */
export type MapOffRouteKind = Extract<CatchRouteKind, "egg-only" | "static">;

export type MapRouteRow = {
  label: string;
  /**
   * Wild open slot: focus spent the slot.
   * No-wilds row: focus has a met-location log here (not a ROM slot spend).
   */
  focusClaimed: boolean;
  /** ROM wild-table methods for this catch-route label (empty for no-wilds). */
  methods: readonly CatchRouteEncounter[];
  /** Outdoor no-wild-table met location (egg-only or empty-static). */
  hatchSafe: boolean;
  /** Catalog kind when `hatchSafe` — distinguishes pure hatch maps from gift/fossil towns. */
  offRouteKind: MapOffRouteKind | null;
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
  /** Open-slot labels only (wild / flag slots). */
  rows: MapRouteRow[];
  /** Hatch-safe outdoor labels on this region (never counted as open slots). */
  hatchRows: MapRouteRow[];
};

/** Flattened planning checklist row (wild open slot or no-wilds spot). */
export type MapOpenSlot = {
  zoneId: string;
  zoneName: string;
  label: string;
  methods: readonly CatchRouteEncounter[];
  hatchSafe: boolean;
  offRouteKind: MapOffRouteKind | null;
};

export type MapZoneFilter = {
  /** When true, fully claimed wild zones are dimmed / omitted from the open list. */
  unclaimedOnly: boolean;
  /** Empty = all methods. Otherwise OR-match. `"no-wilds"` matches hatch-safe zones. */
  methods: readonly MapMethodFilter[];
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

function offRouteKindFor(
  catalog: NonNullable<ReturnType<typeof findCatchRoute>>,
  hatchSafe: boolean,
): MapOffRouteKind | null {
  if (!hatchSafe) return null;
  if (catalog.kind === "egg-only" || catalog.kind === "static") {
    return catalog.kind;
  }
  return null;
}

function buildRouteRow(
  label: string,
  catalog: NonNullable<ReturnType<typeof findCatchRoute>>,
  claimed: Set<string>,
  byRoute: Map<string, EncounterRouteGroup>,
  focusId: string | null,
  hatchSafe: boolean,
): MapRouteRow {
  const key = normalizeCatchRoute(label);
  const group = byRoute.get(key);
  const allClaims = group?.claims ?? [];
  const allFlags = group?.flagClaims ?? [];
  return {
    label,
    focusClaimed: claimed.has(key),
    methods: catalog.encounters,
    hatchSafe,
    offRouteKind: offRouteKindFor(catalog, hatchSafe),
    focusClaims: focusId
      ? allClaims.filter((claim) => claim.trainerId === focusId)
      : [],
    focusFlagClaims: focusId
      ? allFlags.filter((claim) => claim.trainerId === focusId)
      : [],
  };
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
    const hatchRows: MapRouteRow[] = [];

    for (const label of zone.labels) {
      const catalog = findCatchRoute(label);
      if (!catalog) continue;

      if (catalog.countsTowardOpen) {
        rows.push(
          buildRouteRow(label, catalog, claimed, byRoute, focusId, false),
        );
        continue;
      }

      if (isHatchSafeOutdoor(catalog)) {
        hatchRows.push(
          buildRouteRow(label, catalog, claimed, byRoute, focusId, true),
        );
      }
    }

    const claimedOpenSlots = rows.filter((row) => row.focusClaimed).length;
    const openSlots = rows.length - claimedOpenSlots;

    return {
      zone,
      status: aggregateZoneStatus(claimedOpenSlots, rows.length),
      claimedOpenSlots,
      openSlots,
      rows,
      hatchRows,
    };
  });
}

export function zoneHasHatchSafe(zone: MapZoneStatus): boolean {
  return zone.hatchRows.length > 0;
}

/** Zone has something to paint (wild open slot and/or hatch-safe label). */
export function zoneIsPaintable(zone: MapZoneStatus): boolean {
  return zone.status !== "empty" || zone.hatchRows.length > 0;
}

function wildMethodFilters(
  methods: readonly MapMethodFilter[],
): CatchRouteEncounter[] {
  return methods.filter(
    (method): method is CatchRouteEncounter => method !== "no-wilds",
  );
}

function noWildsFilterActive(methods: readonly MapMethodFilter[]): boolean {
  return methods.includes("no-wilds");
}

/** Whether a zone should stay emphasized under the planning filters. */
export function zoneMatchesMapFilter(
  zone: MapZoneStatus,
  filter: MapZoneFilter,
): boolean {
  if (!zoneIsPaintable(zone)) return false;

  const wildFilters = wildMethodFilters(filter.methods);
  const noWildsOn = noWildsFilterActive(filter.methods);
  const noMethodFilter = filter.methods.length === 0;

  const matchesWild = (() => {
    if (zone.status === "empty") return false;
    if (filter.unclaimedOnly && zone.status === "claimed") return false;
    if (noMethodFilter) return true;
    if (wildFilters.length === 0) return false;
    const methodSet = new Set(wildFilters);
    return zone.rows.some(
      (row) =>
        !row.focusClaimed &&
        row.methods.some((method) => methodSet.has(method)),
    );
  })();

  const matchesNoWilds = (() => {
    if (!zoneHasHatchSafe(zone)) return false;
    // No-wilds spots are never wild open slots — only emphasize with that
    // filter, or when no method filter is set and Unclaimed only is off.
    if (noWildsOn) return true;
    if (noMethodFilter && !filter.unclaimedOnly) return true;
    return false;
  })();

  if (noMethodFilter) {
    // Unclaimed only: wild progress only (no-wilds towns dim).
    if (filter.unclaimedOnly) return matchesWild;
    return matchesWild || matchesNoWilds;
  }

  return matchesWild || matchesNoWilds;
}

/** Matching checklist rows for the open-slots / no-wilds planning panel. */
export function listOpenSlotsForMap(
  zones: MapZoneStatus[],
  filter: MapZoneFilter,
): MapOpenSlot[] {
  const slots: MapOpenSlot[] = [];
  const wildFilters = wildMethodFilters(filter.methods);
  const noWildsOn = noWildsFilterActive(filter.methods);
  const noMethodFilter = filter.methods.length === 0;
  const includeWild = noMethodFilter || wildFilters.length > 0;
  const includeNoWilds = noWildsOn;

  for (const zone of zones) {
    if (!zoneMatchesMapFilter(zone, filter)) continue;

    if (includeWild) {
      for (const row of zone.rows) {
        if (row.focusClaimed) continue;
        if (
          wildFilters.length > 0 &&
          !row.methods.some((method) => wildFilters.includes(method))
        ) {
          continue;
        }
        slots.push({
          zoneId: zone.zone.id,
          zoneName: zone.zone.name,
          label: row.label,
          methods: row.methods,
          hatchSafe: false,
          offRouteKind: null,
        });
      }
    }

    if (includeNoWilds) {
      for (const row of zone.hatchRows) {
        slots.push({
          zoneId: zone.zone.id,
          zoneName: zone.zone.name,
          label: row.label,
          methods: row.methods,
          hatchSafe: true,
          offRouteKind: row.offRouteKind,
        });
      }
    }
  }
  return slots;
}

export function countOpenSlots(zones: MapZoneStatus[]): number {
  return zones.reduce((sum, zone) => sum + zone.openSlots, 0);
}

export function countHatchSpots(zones: MapZoneStatus[]): number {
  return zones.reduce((sum, zone) => sum + zone.hatchRows.length, 0);
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

export function mapMethodLabel(method: MapMethodFilter): string {
  switch (method) {
    case "land":
      return "Grass";
    case "water":
      return "Surf";
    case "fishing":
      return "Fishing";
    case "rock-smash":
      return "Rock Smash";
    case "no-wilds":
      return "No wilds";
    default:
      return method;
  }
}

/** Chip label for a no-wild-table catalog row. */
export function mapOffRouteKindLabel(kind: MapOffRouteKind | null): string {
  switch (kind) {
    case "egg-only":
      return "Egg";
    case "static":
      return "Gift / fossil";
    default:
      return "No wilds";
  }
}

export function mapOffRouteKindNote(kind: MapOffRouteKind | null): string {
  switch (kind) {
    case "egg-only":
      return "No wild table or script static — outdoor hatching is safe and does not spend a wild route slot.";
    case "static":
      return "No outdoor wild table — gifts, fossils, or hatching can log here without spending a wild route slot.";
    default:
      return "No outdoor wild table — logging here does not spend a wild route slot.";
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
