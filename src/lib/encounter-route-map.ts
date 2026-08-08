import {
  CATCH_ROUTE_TABLE,
  findCatchRoute,
  isHatchSafeOutdoor,
  normalizeCatchRoute,
  type CatchRouteEncounter,
  type CatchRouteKind,
} from "@/data/catch-routes";
import { catchVisitOrderIndex } from "@/data/hoenn-catch-visit-order";
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
 * Catch-route labels that are post-Champion (National Dex / Sealed Chamber /
 * ticket / BP gated) for a League-capped nuzlocke. Folded onto story parent
 * zones on the map — filtered out when “Hide post-game areas” is on.
 *
 * Not included: mid-story spots that also host later ME legendary chains
 * (Meteor Falls, Magma Hideout, New Mauville, Shoal Cave, Victory Road, …).
 */
export const POST_GAME_CATCH_ROUTE_LABELS: ReadonlySet<string> = new Set([
  // Regi unlock + classic / ME chambers (National Dex + Sealed Chamber)
  "Sealed Chamber",
  "Desert Ruins",
  "Island Cave",
  "Ancient Tomb",
  "Route 110 East", // ME Regieleki chamber (aliases Route 101 bit)
  "Route 132 North", // ME Regidrago chamber (aliases Route 101 bit)

  // Optional / ticket / Frontier
  "Battle Frontier",
  "Southern Island",
  "Birth Island",
  "Faraway Island",
  "Navel Rock",
  "Marine Cave",
  "Terra Cave",
  "Mirage Island",
  "Trainer Hill",
  "Altering Cave",
  "Artisan Cave",
  "Desert Underpass",
  "Scorched Slab", // ME post-game Zapdos chain; also aliases Route 101 bit
]);

export function isPostGameMapZone(zoneId: string): boolean {
  return POST_GAME_MAP_ZONE_IDS.has(zoneId);
}

/** Label → drawn zone id (nested labels like Petalburg Woods → route-104). */
const ZONE_ID_BY_LABEL = new Map<string, string>();
for (const zone of HOENN_MAP_REGIONS) {
  for (const label of zone.labels) {
    const key = normalizeCatchRoute(label);
    if (!ZONE_ID_BY_LABEL.has(key)) ZONE_ID_BY_LABEL.set(key, zone.id);
  }
}

/**
 * Resolve a stored `catchRoute` string to a Catch Map zone id for deep links.
 *
 * Uses the catalog canonical label (and the original string for nested labels
 * that are themselves catalog rows). Unmapped open slots, aliasesRoute101-only
 * cells, and free-typed junk return null — no silent remap to Route 101.
 */
export function mapZoneIdForCatchRoute(
  catchRoute: string | null | undefined,
): string | null {
  if (!catchRoute?.trim()) return null;
  const catalog = findCatchRoute(catchRoute);
  const candidates = [catalog?.label, catchRoute.trim()].filter(
    (value): value is string => Boolean(value),
  );
  for (const candidate of candidates) {
    const zoneId = ZONE_ID_BY_LABEL.get(normalizeCatchRoute(candidate));
    if (zoneId) return zoneId;
  }
  return null;
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
  const claimed = new Set<string>();
  for (const group of status.claimedRoutes) {
    claimed.add(normalizeCatchRoute(group.route));
    // Shared slotKey siblings (aliasesRoute101, …) burn together in-game.
    for (const shared of group.sharedWith ?? []) {
      claimed.add(normalizeCatchRoute(shared));
    }
  }
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
  // Untouched / Done are fully open / fully spent zones.
  // Leftovers on mixed zones live under Partial only.
  if (status === "unclaimed") return zone.status === "unclaimed";
  if (status === "claimed") return zone.status === "claimed";
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

  for (const zone of zones) {
    if (!zoneMatchesMapFilter(zone, filter)) continue;

    // No legend chip: every wild + hatch/gift row on the map.
    if (!status) {
      for (const row of zone.rows) pushSlot(slots, zone, row);
      for (const row of zone.hatchRows) pushSlot(slots, zone, row);
      continue;
    }

    if (status === "no-wilds") {
      for (const row of zone.hatchRows) pushSlot(slots, zone, row);
      continue;
    }

    for (const row of zone.rows) {
      if (status === "claimed") {
        if (row.focusClaimed) pushSlot(slots, zone, row);
        continue;
      }
      // Untouched / partial: leftover wild rows in matching zones
      if (!row.focusClaimed) pushSlot(slots, zone, row);
    }
  }

  // Story visit order; cleared filter keeps still-open catches on top.
  slots.sort((a, b) => {
    if (!status) {
      const rankA = a.focusClaimed ? 1 : 0;
      const rankB = b.focusClaimed ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
    }
    const visit =
      catchVisitOrderIndex(a.label) - catchVisitOrderIndex(b.label);
    if (visit !== 0) return visit;
    return a.label.localeCompare(b.label);
  });
  return slots;
}

/**
 * Legend chip counts — catch filters use wild open-slot rows (not zones) so
 * the chip matches the sidebar header. Egg/gift uses hatch-safe rows.
 */
export function countZonesForStatusFilter(
  zones: MapZoneStatus[],
  status: MapStatusFilter,
): number {
  if (status === "no-wilds") {
    return zones.reduce((sum, zone) => sum + zone.hatchRows.length, 0);
  }
  if (status === "unclaimed") {
    return zones
      .filter((zone) => zone.status === "unclaimed")
      .reduce((sum, zone) => sum + zone.openSlots, 0);
  }
  if (status === "claimed") {
    return zones
      .filter((zone) => zone.status === "claimed")
      .reduce((sum, zone) => sum + zone.claimedOpenSlots, 0);
  }
  if (status === "partial") {
    return zones
      .filter((zone) => zone.status === "partial")
      .reduce((sum, zone) => sum + zone.openSlots, 0);
  }
  return 0;
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
      return "Untouched";
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
      return "Untouched";
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
