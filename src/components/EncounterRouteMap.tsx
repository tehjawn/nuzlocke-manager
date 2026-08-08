"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Frame } from "@/components/Frame";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { CatchRouteEncounter } from "@/data/catch-routes";
import {
  HOENN_MAP_IMAGE,
  HOENN_MAP_VIEWBOX,
  regionArea,
} from "@/data/hoenn-map-zones";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";
import {
  buildEncounterMapStatuses,
  countZonesForStatusFilter,
  filterMapZonesForStory,
  isPostGameCatchRouteLabel,
  isPostGameMapZone,
  listOpenSlotsForMap,
  MAP_STATUS_FILTERS,
  mapMethodLabel,
  mapOffRouteKindLabel,
  mapOffRouteKindNote,
  mapStatusLabel,
  sortMapMethods,
  unmappedOpenCatchRoutes,
  zoneHasHatchSafe,
  zoneIsPaintable,
  zoneMatchesMapFilter,
  type MapOffRouteKind,
  type MapOpenSlot,
  type MapRouteClaimStatus,
  type MapRouteRow,
  type MapStatusFilter,
  type MapZoneStatus,
} from "@/lib/encounter-route-map";
import type { PersonalRouteStatus } from "@/lib/personal-routes";

type EncounterRouteMapProps = {
  groups: EncounterRouteGroup[];
  myTrainerId?: string | null;
  routeStatuses: PersonalRouteStatus[];
  slug: string;
};

/**
 * Status reads primarily from stroke; fills stay light so route art shows through.
 * Unclaimed = outline only · partial/claimed = soft wash + strong border.
 */
const STATUS_FILL: Record<MapRouteClaimStatus, string> = {
  unclaimed: "color-mix(in srgb, var(--ink) 6%, transparent)",
  partial: "color-mix(in srgb, var(--accent-2) 28%, transparent)",
  claimed: "color-mix(in srgb, var(--accent) 32%, transparent)",
  empty: "transparent",
};

const STATUS_STROKE: Record<MapRouteClaimStatus, string> = {
  unclaimed: "color-mix(in srgb, var(--ink) 55%, transparent)",
  partial: "var(--accent-2)",
  claimed: "var(--accent-deep)",
  empty: "transparent",
};

const HATCH_FILL = "color-mix(in srgb, var(--interactive) 14%, transparent)";
const HATCH_STROKE = "color-mix(in srgb, var(--interactive) 55%, var(--ink))";

export function EncounterRouteMap({
  groups,
  myTrainerId = null,
  routeStatuses,
  slug,
}: EncounterRouteMapProps) {
  const [trainerId, setTrainerId] = useState(
    () => myTrainerId ?? routeStatuses[0]?.trainerId ?? "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MapStatusFilter | null>(
    null,
  );
  /** On by default — season runs are League-capped; show post-game when needed. */
  const [hidePostGame, setHidePostGame] = useState(true);

  const focusStatus =
    routeStatuses.find((entry) => entry.trainerId === trainerId) ?? null;

  const zoneStatuses = useMemo(
    () =>
      filterMapZonesForStory(
        buildEncounterMapStatuses(groups, focusStatus),
        hidePostGame,
      ),
    [groups, focusStatus, hidePostGame],
  );

  const filter = useMemo(() => ({ status: statusFilter }), [statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = {} as Record<MapStatusFilter, number>;
    for (const status of MAP_STATUS_FILTERS) {
      counts[status] = countZonesForStatusFilter(zoneStatuses, status);
    }
    return counts;
  }, [zoneStatuses]);

  const openSlots = useMemo(
    () => listOpenSlotsForMap(zoneStatuses, filter),
    [zoneStatuses, filter],
  );

  /** Paint large regions first; small towns stay on top for clicks. */
  const paintOrder = useMemo(() => {
    return [...zoneStatuses].sort(
      (a, b) => regionArea(b.zone) - regionArea(a.zone),
    );
  }, [zoneStatuses]);

  const selected =
    zoneStatuses.find((entry) => entry.zone.id === selectedId) ?? null;
  const unmapped = useMemo(() => {
    const labels = unmappedOpenCatchRoutes();
    if (!hidePostGame) return labels;
    return labels.filter((label) => !isPostGameCatchRouteLabel(label));
  }, [hidePostGame]);
  const planningActive = statusFilter != null;

  function toggleStatus(status: MapStatusFilter) {
    setSelectedId(null);
    setStatusFilter((prev) => (prev === status ? null : status));
  }

  function onHidePostGameChange(checked: boolean) {
    setHidePostGame(checked);
    if (checked) {
      setSelectedId((prev) =>
        prev && isPostGameMapZone(prev) ? null : prev,
      );
    }
  }

  return (
    <section
      aria-labelledby="encounter-map-heading"
      className="space-y-3"
      data-testid="encounter-route-map"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2
            className="font-display text-2xl font-bold tracking-tight"
            id="encounter-map-heading"
          >
            Catch Map
          </h2>
          <p className="max-w-xl text-sm text-muted">
            Hoenn region map with pret-accurate route hit targets. Colors follow
            the focused trainer&apos;s open-slot progress — plus no-wilds spots
            (egg / gift) that never spend a wild slot. Season stats and Missing
            dex live under Season Stats / Pokémon Ownership.
          </p>
        </div>
        {routeStatuses.length > 0 && (
          <label className="min-w-[11rem] space-y-1 text-xs font-semibold text-muted">
            Focus trainer
            <select
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
              data-testid="encounter-map-trainer"
              onChange={(event) => setTrainerId(event.target.value)}
              value={focusStatus?.trainerId ?? trainerId}
            >
              {routeStatuses.map((entry) => (
                <option key={entry.trainerId} value={entry.trainerId}>
                  {entry.trainerHandle}
                  {entry.trainerId === myTrainerId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <MapLegend
          activeStatus={statusFilter}
          counts={statusCounts}
          onToggle={toggleStatus}
        />
        <label className="flex items-center gap-2 text-[11px] font-semibold text-ink">
          <input
            type="checkbox"
            className="size-3.5 rounded border-frame"
            checked={hidePostGame}
            data-testid="encounter-map-hide-post-game"
            onChange={(event) => onHidePostGameChange(event.target.checked)}
          />
          Hide post-game areas
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.9fr)]">
        <div className="min-w-0 overflow-hidden rounded-md border border-frame/40 bg-[color-mix(in_srgb,var(--interactive)_10%,var(--surface))] p-1">
          <svg
            aria-label="Hoenn region claim map"
            className="block h-auto w-full max-w-full"
            role="img"
            viewBox={HOENN_MAP_VIEWBOX}
            preserveAspectRatio="xMidYMid meet"
          >
            <title>Hoenn claim map</title>
            <image
              href={HOENN_MAP_IMAGE}
              height="360"
              opacity={0.78}
              width="640"
              x="0"
              y="0"
            />
            {paintOrder.map((entry) => {
              const emphasized = zoneMatchesMapFilter(entry, filter);
              const selected = entry.zone.id === selectedId;
              const pulse = selected || (planningActive && emphasized);
              return (
                <RegionShape
                  key={entry.zone.id}
                  dimmed={planningActive && !emphasized && !selected}
                  entry={entry}
                  pulse={pulse}
                  selected={selected}
                  onSelect={() =>
                    setSelectedId((prev) =>
                      prev === entry.zone.id ? null : entry.zone.id,
                    )
                  }
                />
              );
            })}
          </svg>
        </div>

        {selected ? (
          <ZoneDetail
            focusHandle={focusStatus?.trainerHandle ?? null}
            selected={selected}
            slug={slug}
          />
        ) : planningActive ? (
          <OpenSlotsPanel
            focusHandle={focusStatus?.trainerHandle ?? null}
            slots={openSlots}
            slug={slug}
            onSelectZone={(zoneId) => setSelectedId(zoneId)}
          />
        ) : (
          <Frame dense title="Route detail">
            <p className="text-sm text-muted">
              Select a route or town on the map to see open-slot progress
              {focusHandleLine(focusStatus?.trainerHandle)}. Click a legend chip
              to filter.
            </p>
          </Frame>
        )}
      </div>

      {unmapped.length > 0 && (
        <p className="text-[11px] text-muted">
          Unmapped open slots (list views only): {unmapped.join(", ")}.
        </p>
      )}
    </section>
  );
}

function MapLegend({
  activeStatus,
  counts,
  onToggle,
}: {
  activeStatus: MapStatusFilter | null;
  counts: Record<MapStatusFilter, number>;
  onToggle: (status: MapStatusFilter) => void;
}) {
  const items: {
    status: MapStatusFilter;
    hint: string;
    fill: string;
    stroke: string;
    dashed?: boolean;
  }[] = [
    {
      status: "unclaimed",
      hint: "Unclaimed",
      fill: STATUS_FILL.unclaimed,
      stroke: STATUS_STROKE.unclaimed,
      dashed: true,
    },
    {
      status: "partial",
      hint: "Partially claimed",
      fill: STATUS_FILL.partial,
      stroke: STATUS_STROKE.partial,
    },
    {
      status: "claimed",
      hint: "Fully claimed",
      fill: STATUS_FILL.claimed,
      stroke: STATUS_STROKE.claimed,
    },
    {
      status: "no-wilds",
      hint: "No wilds",
      fill: HATCH_FILL,
      stroke: HATCH_STROKE,
      dashed: true,
    },
  ];
  return (
    <ul
      className="flex flex-wrap gap-2 text-[10px] font-semibold"
      aria-label="Filter map by claim status"
    >
      {items.map((item) => {
        const active = activeStatus === item.status;
        return (
          <li key={item.status}>
            <button
              type="button"
              aria-pressed={active}
              data-testid={`encounter-map-status-${item.status}`}
              onClick={() => onToggle(item.status)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors ${
                active
                  ? "border-interactive/50 bg-interactive-soft text-ink"
                  : "border-frame/35 bg-surface/70 text-muted hover:bg-ink/8 hover:text-ink"
              }`}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm border-2"
                style={{
                  background: item.fill,
                  borderColor: item.stroke,
                  borderStyle: item.dashed ? "dashed" : "solid",
                }}
              />
              {item.hint}
              <span className="tabular-nums opacity-70">
                ({counts[item.status]})
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RegionShape({
  entry,
  selected,
  pulse,
  dimmed,
  onSelect,
}: {
  entry: MapZoneStatus;
  selected: boolean;
  pulse: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const { zone, status } = entry;
  if (!zoneIsPaintable(entry)) return null;

  const hatchOnly = status === "empty" && zoneHasHatchSafe(entry);
  const slotTotal = entry.claimedOpenSlots + entry.openSlots;
  const stroke = selected
    ? "var(--ink)"
    : hatchOnly
      ? HATCH_STROKE
      : STATUS_STROKE[status];
  const fill = hatchOnly ? HATCH_FILL : STATUS_FILL[status];
  const strokeWidth = selected || pulse ? 3 : status === "unclaimed" || hatchOnly ? 1.5 : 2;
  const dash =
    !selected &&
    !pulse &&
    (status === "unclaimed" || hatchOnly)
      ? "3.5 2.5"
      : undefined;

  const statusText = hatchOnly ? "No wilds" : mapStatusLabel(status);

  const shared = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray: dash,
    strokeLinejoin: "round" as const,
    opacity: dimmed ? 0.18 : 1,
    className: [
      "cursor-pointer focus:outline-none focus-visible:stroke-[var(--ink)]",
      pulse
        ? "claim-map-region--pulse"
        : "transition-[filter,opacity] hover:brightness-105",
    ].join(" "),
    tabIndex: 0 as const,
    role: "button" as const,
    "aria-label": `${zone.name}: ${statusText}${
      slotTotal > 0
        ? `, ${entry.claimedOpenSlots} claimed of ${slotTotal}`
        : ""
    }${
      zoneHasHatchSafe(entry) && !hatchOnly ? ", no-wilds spot" : ""
    }${dimmed ? ", filtered out" : ""}`,
    "aria-pressed": selected,
    "data-region": zone.id,
    "data-dimmed": dimmed ? "true" : undefined,
    "data-hatch-only": hatchOnly ? "true" : undefined,
    onClick: onSelect,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
  };

  // One contiguous shape: solid pret fills → rect; L / doughnut → path.
  if (zone.shape.type === "path") {
    return <path d={zone.shape.d} fillRule="evenodd" {...shared} />;
  }

  const inset = 0.6;
  const { x, y, width, height } = zone.shape;
  return (
    <rect
      x={x + inset}
      y={y + inset}
      width={Math.max(width - inset * 2, 2)}
      height={Math.max(height - inset * 2, 2)}
      rx={Math.min(2.5, Math.min(width, height) / 5)}
      {...shared}
    />
  );
}

function focusHandleLine(focusHandle: string | null | undefined): string {
  return focusHandle ? ` (focus: ${focusHandle})` : "";
}

function OpenSlotsPanel({
  slots,
  focusHandle,
  slug,
  onSelectZone,
}: {
  slots: MapOpenSlot[];
  focusHandle: string | null;
  slug: string;
  onSelectZone: (zoneId: string) => void;
}) {
  const wildCount = slots.filter((slot) => !slot.hatchSafe).length;
  const noWildsCount = slots.filter((slot) => slot.hatchSafe).length;
  const title =
    noWildsCount > 0 && wildCount === 0
      ? "No-wilds spots"
      : noWildsCount > 0
        ? "Matching spots"
        : "Open slots";

  return (
    <Frame
      dense
      title={title}
      actions={
        <span className="text-[11px] font-semibold tabular-nums text-white/80">
          {slots.length}
        </span>
      }
    >
      <div className="space-y-2">
        <p className="text-[11px] leading-snug text-muted">
          {noWildsCount > 0 && wildCount === 0
            ? "No wild table — egg / gift / fossil logs"
            : "Matching filters"}
          {focusHandleLine(focusHandle)}. Click to jump.
        </p>

        {slots.length > 0 ? (
          <ul
            className="max-h-[28rem] divide-y divide-frame/30 overflow-y-auto pr-0.5"
            data-testid="encounter-map-open-slots"
          >
            {slots.map((slot) => (
              <li key={`${slot.zoneId}:${slot.label}`}>
                <div
                  className={`flex gap-2 rounded-sm px-1.5 py-2 transition-colors hover:bg-ink/8 ${
                    slot.focusClaimed ? "bg-accent/5 hover:bg-accent/12" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectZone(slot.zoneId)}
                    className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left shadow-none outline-none focus-visible:ring-2 focus-visible:ring-interactive/40"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold tracking-tight ${
                          slot.focusClaimed ? "text-accent-deep" : "text-ink"
                        }`}
                      >
                        {slot.label}
                      </span>
                      {slot.focusClaimed ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-accent-deep/80">
                          {slot.hatchSafe ? "Logged" : "Claimed"}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Open
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted">
                      {slot.label !== slot.zoneName && (
                        <span className="font-semibold">{slot.zoneName}</span>
                      )}
                      {slot.hatchSafe ? (
                        <OffRouteChip kind={slot.offRouteKind} quiet />
                      ) : (
                        <MethodChips methods={slot.methods} quiet />
                      )}
                    </span>
                  </button>
                  {slot.focusClaimed &&
                    (slot.focusClaims.length > 0 ||
                      slot.focusFlagClaims.length > 0) && (
                      <FocusEncounterStrip
                        claimed={slot.focusClaimed}
                        compact
                        focusClaims={slot.focusClaims}
                        focusFlagClaims={slot.focusFlagClaims}
                        hatchSafe={slot.hatchSafe}
                        slug={slug}
                      />
                    )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No spots match these filters.</p>
        )}
      </div>
    </Frame>
  );
}

function ZoneDetail({
  selected,
  slug,
  focusHandle,
}: {
  selected: MapZoneStatus | null;
  slug: string;
  focusHandle: string | null;
}) {
  if (!selected) return null;

  const { zone, status, rows, hatchRows } = selected;
  const slotTotal = selected.claimedOpenSlots + selected.openSlots;
  const hatchOnly = status === "empty" && hatchRows.length > 0;
  const displayRows = sortRowsUnclaimedFirst(rows);
  const allRows = [...displayRows, ...hatchRows];

  return (
    <Frame
      dense
      title={zone.name}
      actions={
        <span className="text-[11px] font-semibold tabular-nums text-white/80">
          {hatchOnly ? "No wilds" : mapStatusLabel(status)}
        </span>
      }
    >
      <div className="space-y-2">
        <p className="text-[11px] leading-snug text-muted">
          {hatchOnly
            ? "No wild open slot — egg / gift / fossil logs only"
            : slotTotal > 0
              ? `${selected.claimedOpenSlots} of ${slotTotal} claimed`
              : "No wild open slots here"}
          {!hatchOnly && selected.openSlots > 0
            ? ` · ${selected.openSlots} open`
            : ""}
          {focusHandleLine(focusHandle)}.
        </p>

        {allRows.length > 0 ? (
          <ul className="divide-y divide-frame/30">
            {allRows.map((row) => (
              <RouteRowDetail key={row.label} row={row} slug={slug} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No open-slot routes here.</p>
        )}

        {hatchOnly && (
          <p className="text-[11px] text-muted">
            {mapOffRouteKindNote(hatchRows[0]?.offRouteKind ?? null)}
          </p>
        )}
      </div>
    </Frame>
  );
}

/** Display order: unclaimed first, then claimed (stable within each bucket). */
function sortRowsUnclaimedFirst(rows: MapRouteRow[]): MapRouteRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const rankA = a.row.focusClaimed ? 1 : 0;
      const rankB = b.row.focusClaimed ? 1 : 0;
      return rankA !== rankB ? rankA - rankB : a.index - b.index;
    })
    .map(({ row }) => row);
}

function RouteRowDetail({
  row,
  slug,
}: {
  row: MapRouteRow;
  slug: string;
}) {
  const claimed = row.focusClaimed;
  const hatchSafe = row.hatchSafe;
  const hasEncounters =
    claimed &&
    (row.focusClaims.length > 0 || row.focusFlagClaims.length > 0);

  return (
    <li
      className={`flex gap-2 px-1.5 py-2 ${
        claimed ? "bg-accent/5" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm font-semibold tracking-tight ${
              claimed ? "text-accent-deep" : "text-ink"
            }`}
          >
            {row.label}
          </span>
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
              claimed ? "text-accent-deep/80" : "text-muted"
            }`}
          >
            {hatchSafe
              ? claimed
                ? "Logged"
                : "Available"
              : claimed
                ? "Claimed"
                : "Open"}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted">
          {hatchSafe ? (
            <OffRouteChip kind={row.offRouteKind} quiet />
          ) : (
            <MethodChips methods={row.methods} quiet />
          )}
        </div>
      </div>
      {hasEncounters && (
        <FocusEncounterStrip
          claimed={claimed}
          compact
          focusClaims={row.focusClaims}
          focusFlagClaims={row.focusFlagClaims}
          hatchSafe={hatchSafe}
          slug={slug}
        />
      )}
    </li>
  );
}

function FocusEncounterStrip({
  focusClaims,
  focusFlagClaims,
  slug,
}: {
  claimed: boolean;
  compact?: boolean;
  focusClaims: MapRouteRow["focusClaims"];
  focusFlagClaims: MapRouteRow["focusFlagClaims"];
  hatchSafe: boolean;
  slug: string;
}) {
  if (focusClaims.length === 0 && focusFlagClaims.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col items-end justify-center gap-1">
      {focusFlagClaims.length > 0 && (
        <span className="text-[10px] font-semibold text-muted">Flag</span>
      )}
      {focusClaims.length > 0 && (
        <ul className="flex flex-wrap justify-end gap-0.5">
          {focusClaims.map((claim) => {
            const label = claim.nickname?.trim() || claim.species;
            return (
              <li key={claim.pokemonId}>
                <Link
                  href={`/challenges/${slug}/trainers/${claim.trainerId}`}
                  title={`${label} · ${claim.trainerHandle}`}
                  aria-label={`${label} · ${claim.trainerHandle}${
                    claim.isAlive ? "" : " · fallen"
                  }`}
                  className="block rounded-sm hover:bg-ink/10"
                >
                  <PokemonSpriteImage
                    alt=""
                    className={`pixelated h-8 w-8 object-contain ${
                      claim.isAlive ? "" : "opacity-50 grayscale"
                    }`}
                    height={32}
                    pokedexId={claim.pokedexId}
                    shiny={claim.isShiny}
                    species={claim.species}
                    width={32}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OffRouteChip({
  kind,
}: {
  kind: MapOffRouteKind | null;
  quiet?: boolean;
}) {
  return (
    <span className="font-semibold text-muted">
      {mapOffRouteKindLabel(kind)}
    </span>
  );
}

function MethodChips({
  methods,
}: {
  methods: readonly CatchRouteEncounter[];
  quiet?: boolean;
}) {
  if (methods.length === 0) return null;
  const sorted = sortMapMethods(methods);
  return (
    <span className="font-semibold text-muted">
      {sorted.map((method) => mapMethodLabel(method)).join(" · ")}
    </span>
  );
}
