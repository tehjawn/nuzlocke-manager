import {
  CATCH_ROUTE_TABLE,
  findCatchRoute,
  normalizeCatchRoute,
} from "@/data/catch-routes";
import {
  HOENN_MAP_LABELS,
  HOENN_MAP_ZONES,
  type HoennMapZone,
} from "@/data/hoenn-map-zones";
import type {
  EncounterClaim,
  EncounterFlagClaim,
  EncounterRouteGroup,
} from "@/lib/encounter-ledger";
import type { PersonalRouteStatus } from "@/lib/personal-routes";

export type MapRouteClaimStatus = "open" | "mine" | "theirs" | "mixed" | "static";

export type MapRouteRow = {
  label: string;
  /** True when this label counts toward open-route slots. */
  countsTowardOpen: boolean;
  /** Pack-wide Pokémon claims for this label (ledger). */
  claims: EncounterClaim[];
  /** Pack-wide Safari / encounter-flag claims. */
  flagClaims: EncounterFlagClaim[];
  /** Focus trainer spent this slot (personal routes), if known. */
  focusClaimed: boolean;
  /** Focus trainer still has this open slot available. */
  focusOpen: boolean;
};

export type MapZoneStatus = {
  zone: HoennMapZone;
  /** Aggregate fill for the zone shape. */
  status: MapRouteClaimStatus;
  claimedOpenSlots: number;
  openSlots: number;
  packClaimCount: number;
  rows: MapRouteRow[];
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

function focusSets(status: PersonalRouteStatus | null): {
  claimed: Set<string>;
  open: Set<string>;
} {
  if (!status) return { claimed: new Set(), open: new Set() };
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
  const open = new Set(status.openRoutes.map(normalizeCatchRoute));
  return { claimed, open };
}

function rowStatus(
  row: MapRouteRow,
  hasFocus: boolean,
): MapRouteClaimStatus {
  if (!row.countsTowardOpen) {
    if (row.claims.length + row.flagClaims.length > 0) {
      return hasFocus && row.focusClaimed ? "mine" : "theirs";
    }
    return "static";
  }
  const packClaimed = row.claims.length + row.flagClaims.length > 0;
  if (hasFocus) {
    if (row.focusClaimed) return "mine";
    if (packClaimed) return "theirs";
    if (row.focusOpen) return "open";
    return "open";
  }
  return packClaimed ? "theirs" : "open";
}

function aggregateZoneStatus(
  rows: MapRouteRow[],
  hasFocus: boolean,
): MapRouteClaimStatus {
  const slotRows = rows.filter((r) => r.countsTowardOpen);
  if (slotRows.length === 0) {
    const anyClaim = rows.some((r) => r.claims.length + r.flagClaims.length > 0);
    if (!anyClaim) return "static";
    return hasFocus && rows.some((r) => r.focusClaimed) ? "mine" : "theirs";
  }

  let mine = 0;
  let theirs = 0;
  let open = 0;
  for (const row of slotRows) {
    const s = rowStatus(row, hasFocus);
    if (s === "mine") mine += 1;
    else if (s === "theirs") theirs += 1;
    else open += 1;
  }

  if (mine > 0 && (theirs > 0 || open > 0)) return "mixed";
  if (mine > 0) return "mine";
  if (theirs > 0 && open > 0) return "mixed";
  if (theirs > 0) return "theirs";
  return "open";
}

/** Build per-zone claim status from live ledger + personal route data. */
export function buildEncounterMapStatuses(
  groups: EncounterRouteGroup[],
  focusStatus: PersonalRouteStatus | null,
): MapZoneStatus[] {
  const byRoute = ledgerByRoute(groups);
  const focus = focusSets(focusStatus);
  const hasFocus = focusStatus != null;

  return HOENN_MAP_ZONES.map((zone) => {
    const rows: MapRouteRow[] = zone.labels.map((label) => {
      const catalog = findCatchRoute(label);
      const key = normalizeCatchRoute(label);
      const group = byRoute.get(key);
      const focusClaimed = focus.claimed.has(key);
      const focusOpen = focus.open.has(key);
      return {
        label,
        countsTowardOpen: catalog?.countsTowardOpen ?? false,
        claims: group?.claims ?? [],
        flagClaims: group?.flagClaims ?? [],
        focusClaimed,
        focusOpen,
      };
    });

    const slotRows = rows.filter((r) => r.countsTowardOpen);
    const claimedOpenSlots = slotRows.filter((r) => {
      if (hasFocus) return r.focusClaimed;
      return r.claims.length + r.flagClaims.length > 0;
    }).length;
    const openSlots = slotRows.length - claimedOpenSlots;
    const packClaimCount = rows.reduce(
      (sum, r) => sum + r.claims.length + r.flagClaims.length,
      0,
    );

    return {
      zone,
      status: aggregateZoneStatus(rows, hasFocus),
      claimedOpenSlots,
      openSlots,
      packClaimCount,
      rows,
    };
  });
}

/** Catalog open-slot labels that are not drawn on any zone (graceful omit). */
export function unmappedOpenCatchRoutes(): string[] {
  return CATCH_ROUTE_TABLE.filter(
    (route) =>
      route.countsTowardOpen && !HOENN_MAP_LABELS.has(route.label),
  ).map((route) => route.label);
}

export function mapStatusLabel(status: MapRouteClaimStatus): string {
  switch (status) {
    case "mine":
      return "Your claim";
    case "theirs":
      return "Claimed";
    case "mixed":
      return "Mixed";
    case "open":
      return "Open";
    case "static":
      return "No wild slot";
    default:
      return status;
  }
}
