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

/** Legend status chips — single-select toggle (null = show all). */
export type MapStatusFilter =
  | "unclaimed"
  | "partial"
  | "claimed"
  | "no-wilds";

export const MAP_STATUS_FILTERS: readonly MapStatusFilter[] = [
  "unclaimed",
  "partial",
  "claimed",
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
  focusClaimed: boolean;
  focusClaims: EncounterClaim[];
  focusFlagClaims: EncounterFlagClaim[];
};

export type MapZoneFilter = {
  /** Null = any status. Otherwise match that legend chip only. */
  status: MapStatusFilter | null;
};

/**
 * Dedicated region-map zones that only matter after the Champion (ferry /
 * event-ticket content). Nested post-game labels on story routes are listed
 * separately in `POST_GAME_CATCH_ROUTE_LABELS`.
 */
export const POST_GAME_MAP_ZONE_IDS: ReadonlySet<string> = new Set([
  "battle-frontier",
  "southern-island",
]);

/**
 * Catch-route labels that are post-Champion (or ticket/BP gated) for a
 * League-capped nuzlocke. Includes labels folded onto story parent zones.
 */
export const POST_GAME_CATCH_ROUTE_LABELS: ReadonlySet<string> = new Set([
  "Battle Frontier",
  "Southern Island",
  "Trainer Hill",
  "Artisan Cave",
  "Mirage Island",
  "Birth Island",
  "Faraway Island",
  "Navel Rock",
  "Marine Cave",
  "Terra Cave",
]);

export function isPostGameMapZone(zoneId: string): boolean {
  return POST_GAME_MAP_ZONE_IDS.has(zoneId);
}

export function isPostGameCatchRouteLabel(label: string): boolean {
  return POST_GAME_CATCH_ROUTE_LABELS.has(label);
}

/**
 * Drop post-game zones/labels for League-capped planning. Recalculates open-slot
 * aggregates so legend counts stay honest.
 */
export function filterMapZonesForStory(
  zones: MapZoneStatus[],
  hidePostGame: boolean,
): MapZoneStatus[] {
  if (!hidePostGame) return zones;

  return zones
    .filter((zone) => !isPostGameMapZone(zone.zone.id))
    .map((zone) => {
      const rows = zone.rows.filter(
        (row) => !isPostGameCatchRouteLabel(row.label),
      );
      const hatchRows = zone.hatchRows.filter(
        (row) => !isPostGameCatchRouteLabel(row.label),
      );
      const claimedOpenSlots = rows.filter((row) => row.focusClaimed).length;
      return {
        ...zone,
        rows,
        hatchRows,
        claimedOpenSlots,
        openSlots: rows.length - claimedOpenSlots,
        status: aggregateZoneStatus(claimedOpenSlots, rows.length),
      };
    });
}

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

function zoneMatchesStatusFilter(
  zone: MapZoneStatus,
  status: MapStatusFilter,
): boolean {
  if (status === "no-wilds") return zoneHasHatchSafe(zone);
  return zone.status === status;
}

/** Whether a zone should stay emphasized under the planning filters. */
export function zoneMatchesMapFilter(
  zone: MapZoneStatus,
  filter: MapZoneFilter,
): boolean {
  if (!zoneIsPaintable(zone)) return false;
  if (!filter.status) return true;
  return zoneMatchesStatusFilter(zone, filter.status);
}

function pushSlot(
  slots: MapOpenSlot[],
  zone: MapZoneStatus,
  row: MapRouteRow,
): void {
  slots.push({
    zoneId: zone.zone.id,
    zoneName: zone.zone.name,
    label: row.label,
    methods: row.methods,
    hatchSafe: row.hatchSafe,
    offRouteKind: row.offRouteKind,
    focusClaimed: row.focusClaimed,
    focusClaims: row.focusClaims,
    focusFlagClaims: row.focusFlagClaims,
  });
}

/** Matching checklist rows for the planning side panel. */
export function listOpenSlotsForMap(
  zones: MapZoneStatus[],
  filter: MapZoneFilter,
): MapOpenSlot[] {
  const slots: MapOpenSlot[] = [];
  const status = filter.status;
  if (!status) return slots;

  for (const zone of zones) {
    if (!zoneMatchesMapFilter(zone, filter)) continue;

    if (status === "no-wilds") {
      for (const row of zone.hatchRows) pushSlot(slots, zone, row);
      continue;
    }

    for (const row of zone.rows) {
      if (status === "claimed") {
        if (row.focusClaimed) pushSlot(slots, zone, row);
        continue;
      }
      // unclaimed / partial zones: list still-open wild rows
      if (!row.focusClaimed) pushSlot(slots, zone, row);
    }
  }
  return slots;
}

/** Counts for legend status chips. */
export function countZonesForStatusFilter(
  zones: MapZoneStatus[],
  status: MapStatusFilter,
): number {
  if (status === "no-wilds") {
    return zones.filter((zone) => zoneHasHatchSafe(zone)).length;
  }
  return zones.filter((zone) => zone.status === status).length;
}

/**
 * Catalog open-slot labels that are not drawn on any region (graceful omit).
 *
 * Skips `aliasesRoute101` rows (Route 110 East, Route 132 North, …): they share
 * Route 101's ROM bit / `slotKey`, so the mapped Route 101 cell already covers
 * that slot — listing them here looked like missing independent encounters.
 */
export function unmappedOpenCatchRoutes(): string[] {
  return CATCH_ROUTE_TABLE.filter(
    (route) =>
      route.countsTowardOpen &&
      !route.aliasesRoute101 &&
      !HOENN_MAP_LABELS.has(route.label),
  ).map((route) => route.label);
}

export function mapStatusLabel(status: MapRouteClaimStatus): string {
  switch (status) {
    case "claimed":
      return "Done";
    case "partial":
      return "Partial";
    case "unclaimed":
      return "Still open";
    case "empty":
      return "No wild catch";
    default:
      return status;
  }
}

/** Player-facing legend / panel title for a status filter chip. */
export function mapStatusFilterLabel(status: MapStatusFilter): string {
  switch (status) {
    case "unclaimed":
      return "Still open";
    case "partial":
      return "Partial";
    case "claimed":
      return "Done";
    case "no-wilds":
      return "Egg · gift";
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

/** Chip label for a no-wild-table catalog row. */
export function mapOffRouteKindLabel(kind: MapOffRouteKind | null): string {
  switch (kind) {
    case "egg-only":
      return "Egg";
    case "static":
      return "Gift";
    default:
      return "Egg · gift";
  }
}

export function mapOffRouteKindNote(kind: MapOffRouteKind | null): string {
  switch (kind) {
    case "egg-only":
      return "No wild table — outdoor hatching is safe and does not spend a wild catch slot.";
    case "static":
      return "No outdoor wild table — gifts (or fossils in Rustboro) and outdoor hatching can log here without spending a wild catch slot.";
    default:
      return "No outdoor wild table — logging here does not spend a wild catch slot.";
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
