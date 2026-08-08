"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  mapStatusFilterLabel,
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
 * Still open = outline only · partial/done = soft wash + strong border.
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
  /** Default Still open — land as a next-catch planner. */
  const [statusFilter, setStatusFilter] = useState<MapStatusFilter | null>(
    "unclaimed",
  );
  /** On by default — season runs are League-capped; show post-game when needed. */
  const [hidePostGame, setHidePostGame] = useState(true);
  const [magnify, setMagnify] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const focusStatus =
    routeStatuses.find((entry) => entry.trainerId === trainerId) ?? null;
  const focusHandle = focusStatus?.trainerHandle ?? null;

  const zoneStatuses = useMemo(
    () =>
      filterMapZonesForStory(
        buildEncounterMapStatuses(groups, focusStatus),
        hidePostGame,
      ),
    [groups, focusStatus, hidePostGame],
  );

  const filter = useMemo(() => ({ status: statusFilter }), [statusFilter]);
  /** Checklist stays useful when the map filter is cleared — still show opens. */
  const listFilter = useMemo(
    () => ({ status: statusFilter ?? ("unclaimed" as const) }),
    [statusFilter],
  );

  const statusCounts = useMemo(() => {
    const counts = {} as Record<MapStatusFilter, number>;
    for (const status of MAP_STATUS_FILTERS) {
      counts[status] = countZonesForStatusFilter(zoneStatuses, status);
    }
    return counts;
  }, [zoneStatuses]);

  const openSlots = useMemo(
    () => listOpenSlotsForMap(zoneStatuses, listFilter),
    [zoneStatuses, listFilter],
  );

  /** Paint large regions first; small towns stay on top for clicks. */
  const paintOrder = useMemo(() => {
    return [...zoneStatuses].sort(
      (a, b) => regionArea(b.zone) - regionArea(a.zone),
    );
  }, [zoneStatuses]);

  const selected =
    zoneStatuses.find((entry) => entry.zone.id === selectedId) ?? null;
  const hovered =
    zoneStatuses.find((entry) => entry.zone.id === hoveredId) ?? null;
  const hoverTooltip = hovered
    ? {
        title: hovered.zone.name,
        subtitle: regionTooltipSubtitle(hovered),
      }
    : null;
  const unmapped = useMemo(() => {
    const labels = unmappedOpenCatchRoutes();
    if (!hidePostGame) return labels;
    return labels.filter((label) => !isPostGameCatchRouteLabel(label));
  }, [hidePostGame]);
  const planningActive = statusFilter != null;
  const panelFilter = listFilter.status;

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

  const blurbTrainer = focusHandle
    ? focusStatus?.trainerId === myTrainerId
      ? "your"
      : `${focusHandle}'s`
    : "this trainer's";

  const mapSvg = (
    <svg
      aria-label="Hoenn Catch Map"
      className="block h-auto w-full max-w-full"
      role="group"
      viewBox={HOENN_MAP_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
    >
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
        const isSelected = entry.zone.id === selectedId;
        return (
          <RegionShape
            key={entry.zone.id}
            dimmed={planningActive && !emphasized && !isSelected}
            entry={entry}
            hovered={hoveredId === entry.zone.id}
            matchHighlight={planningActive && emphasized && !isSelected}
            pulse={isSelected}
            selected={isSelected}
            onHoverChange={(active) =>
              setHoveredId(active ? entry.zone.id : null)
            }
            onSelect={() =>
              setSelectedId((prev) =>
                prev === entry.zone.id ? null : entry.zone.id,
              )
            }
          />
        );
      })}
    </svg>
  );

  const mapBlock = (
    <MapViewport
      hoverTooltip={hoverTooltip}
      magnify={magnify}
      onMagnifyChange={setMagnify}
      mapSvg={mapSvg}
    />
  );

  const panelBlock = selected ? (
    <ZoneDetail
      focusHandle={focusHandle}
      selected={selected}
      slug={slug}
      onClear={() => setSelectedId(null)}
      backLabel={mapStatusFilterLabel(panelFilter)}
    />
  ) : (
    <OpenSlotsPanel
      filter={panelFilter}
      focusHandle={focusHandle}
      mapFilterCleared={statusFilter == null}
      slots={openSlots}
      slug={slug}
      onSelectZone={(zoneId) => setSelectedId(zoneId)}
    />
  );

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
            Plan {blurbTrainer} next catch. Colors show catch progress — tap a
            status to filter the map.
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

      {/* Panel first in DOM for keyboard/mobile; map left on desktop. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(15rem,0.85fr)]">
        <div className="min-w-0 lg:col-start-2">{panelBlock}</div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">{mapBlock}</div>
      </div>

      {unmapped.length > 0 && (
        <p className="text-[11px] text-muted">
          Not on map yet: {unmapped.join(", ")}.
        </p>
      )}
    </section>
  );
}

/** In-place map zoom — scale the map; cursor sets the magnification center. */
const MAP_MAGNIFY_SCALE = 2.4;

type MapHoverTooltip = {
  title: string;
  subtitle: string | null;
};

function regionTooltipSubtitle(entry: MapZoneStatus): string | null {
  const hatchOnly =
    entry.status === "empty" && zoneHasHatchSafe(entry);
  if (hatchOnly) return mapStatusFilterLabel("no-wilds");
  const slotTotal = entry.claimedOpenSlots + entry.openSlots;
  if (slotTotal <= 0) return mapStatusLabel(entry.status);
  return `${mapStatusLabel(entry.status)} · ${entry.claimedOpenSlots}/${slotTotal}`;
}

function MapViewport({
  magnify,
  onMagnifyChange,
  mapSvg,
  hoverTooltip,
}: {
  magnify: boolean;
  onMagnifyChange: (next: boolean) => void;
  mapSvg: ReactNode;
  hoverTooltip: MapHoverTooltip | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const [pointer, setPointer] = useState<{
    x: number;
    y: number;
    stageW: number;
    stageH: number;
  } | null>(null);

  function clearPointerTracking() {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    rectRef.current = null;
    setPointer(null);
  }

  function updatePointer(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = rectRef.current ?? stage.getBoundingClientRect();
    rectRef.current = rect;
    if (rect.width <= 0 || rect.height <= 0) return;
    const next = {
      x: Math.min(Math.max(clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(clientY - rect.top, 0), rect.height),
      stageW: rect.width,
      stageH: rect.height,
    };
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPointer(next);
    });
  }

  useEffect(
    () => () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    },
    [],
  );

  const tooltipPos =
    hoverTooltip && pointer
      ? clampTooltipPosition(pointer.x + 14, pointer.y + 14, pointer.stageW, pointer.stageH)
      : null;

  return (
    <div className="relative min-w-0 overflow-hidden rounded-md border border-frame/40 bg-[color-mix(in_srgb,var(--interactive)_10%,var(--surface))] p-1">
      <button
        type="button"
        aria-pressed={magnify}
        aria-label={
          magnify ? "Turn off map magnifier" : "Turn on map magnifier"
        }
        data-testid="encounter-map-magnify"
        title={magnify ? "Magnifier on" : "Magnifier"}
        onClick={() => {
          onMagnifyChange(!magnify);
          clearPointerTracking();
        }}
        className={`absolute right-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-md border shadow-sm transition-colors ${
          magnify
            ? "border-interactive/50 bg-interactive-soft text-interactive"
            : "border-frame/50 bg-surface/90 text-muted hover:bg-ink/8 hover:text-ink"
        }`}
      >
        <MagnifierIcon className="size-4" />
      </button>

      <div
        ref={stageRef}
        className={`relative overflow-hidden ${magnify ? "cursor-crosshair" : ""}`}
        data-testid="encounter-map-stage"
        onPointerLeave={clearPointerTracking}
        onPointerMove={(event) => {
          updatePointer(event.clientX, event.clientY);
        }}
      >
        <div
          className={magnify ? "will-change-transform" : undefined}
          style={
            magnify
              ? {
                  transform: `scale(${MAP_MAGNIFY_SCALE})`,
                  transformOrigin: pointer
                    ? `${pointer.x}px ${pointer.y}px`
                    : "50% 50%",
                }
              : undefined
          }
        >
          {mapSvg}
        </div>

        {hoverTooltip && tooltipPos && (
          <div
            role="tooltip"
            data-testid="encounter-map-tooltip"
            className="pointer-events-none absolute z-30 max-w-[14rem] rounded-md border border-frame/60 bg-surface/95 px-2.5 py-1.5 shadow-md backdrop-blur-sm"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <p className="text-xs font-semibold leading-snug text-ink">
              {hoverTooltip.title}
            </p>
            {hoverTooltip.subtitle && (
              <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted">
                {hoverTooltip.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function clampTooltipPosition(
  x: number,
  y: number,
  stageW: number,
  stageH: number,
): { x: number; y: number } {
  const pad = 8;
  const estW = 160;
  const estH = 44;
  return {
    x: Math.min(Math.max(x, pad), Math.max(pad, stageW - estW - pad)),
    y: Math.min(Math.max(y, pad), Math.max(pad, stageH - estH - pad)),
  };
}

function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15.5 15.5L20 20" strokeLinecap="round" />
    </svg>
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
    fill: string;
    stroke: string;
    dashed?: boolean;
  }[] = [
    {
      status: "unclaimed",
      fill: STATUS_FILL.unclaimed,
      stroke: STATUS_STROKE.unclaimed,
      dashed: true,
    },
    {
      status: "partial",
      fill: STATUS_FILL.partial,
      stroke: STATUS_STROKE.partial,
    },
    {
      status: "claimed",
      fill: STATUS_FILL.claimed,
      stroke: STATUS_STROKE.claimed,
    },
    {
      status: "no-wilds",
      fill: HATCH_FILL,
      stroke: HATCH_STROKE,
      dashed: true,
    },
  ];
  return (
    <ul
      className="flex flex-wrap gap-2 text-[10px] font-semibold"
      aria-label="Filter map by catch status"
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
              {mapStatusFilterLabel(item.status)}
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
  matchHighlight,
  dimmed,
  hovered = false,
  onHoverChange,
  onSelect,
}: {
  entry: MapZoneStatus;
  selected: boolean;
  pulse: boolean;
  /** Static emphasis for filter matches — no animation (avoids map strobe). */
  matchHighlight: boolean;
  dimmed: boolean;
  hovered?: boolean;
  onHoverChange?: (active: boolean) => void;
  onSelect: () => void;
}) {
  const { zone, status } = entry;
  if (!zoneIsPaintable(entry)) return null;

  const hatchOnly = status === "empty" && zoneHasHatchSafe(entry);
  const slotTotal = entry.claimedOpenSlots + entry.openSlots;
  // Selection: solid scarlet wash that blinks. Filter matches: marching dashes.
  // Hover: stronger wash so the hit target is obvious when magnified.
  const stroke = selected
    ? "var(--danger)"
    : hovered
      ? hatchOnly
        ? "var(--interactive)"
        : status === "claimed"
          ? "var(--accent-deep)"
          : status === "partial"
            ? "var(--accent-2)"
            : "var(--ink)"
      : hatchOnly
        ? HATCH_STROKE
        : STATUS_STROKE[status];
  const fill = selected
    ? "var(--danger)"
    : hovered
      ? hatchOnly
        ? "color-mix(in srgb, var(--interactive) 42%, transparent)"
        : status === "claimed"
          ? "color-mix(in srgb, var(--accent) 55%, transparent)"
          : status === "partial"
            ? "color-mix(in srgb, var(--accent-2) 48%, transparent)"
            : "color-mix(in srgb, var(--ink) 22%, transparent)"
      : hatchOnly
        ? HATCH_FILL
        : STATUS_FILL[status];
  const strokeWidth = selected
    ? 2.5
    : hovered
      ? 3
      : matchHighlight
        ? 2.5
        : status === "unclaimed" || hatchOnly
          ? 1.5
          : 2;
  // Match dashes live in `.claim-map-region--match` CSS (keeps march offset in sync).
  const dash =
    !selected &&
    !matchHighlight &&
    !hovered &&
    (status === "unclaimed" || hatchOnly)
      ? "3.5 2.5"
      : undefined;

  const statusText = hatchOnly
    ? mapStatusFilterLabel("no-wilds")
    : mapStatusLabel(status);

  const shared = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray: dash,
    strokeLinejoin: "round" as const,
    opacity: dimmed && !hovered ? 0.18 : dimmed && hovered ? 0.55 : 1,
    className: [
      "cursor-pointer focus:outline-none focus-visible:stroke-[var(--ink)] focus-visible:opacity-100",
      pulse ? "claim-map-region--pulse" : "",
      matchHighlight && !hovered ? "claim-map-region--match" : "",
      !pulse
        ? "transition-[fill,stroke,stroke-width,opacity] duration-100"
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    tabIndex: 0 as const,
    role: "button" as const,
    "aria-label": `${zone.name}: ${statusText}${
      slotTotal > 0
        ? `, ${entry.claimedOpenSlots} of ${slotTotal} caught`
        : ""
    }${
      zoneHasHatchSafe(entry) && !hatchOnly ? ", egg or gift spot" : ""
    }${dimmed ? ", filtered out" : ""}`,
    "aria-pressed": selected,
    onClick: onSelect,
    onMouseEnter: () => onHoverChange?.(true),
    onMouseLeave: () => onHoverChange?.(false),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
    "data-region": zone.id,
    "data-dimmed": dimmed ? "true" : undefined,
    "data-hatch-only": hatchOnly ? "true" : undefined,
    "data-match": matchHighlight ? "true" : undefined,
    "data-hovered": hovered ? "true" : undefined,
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

function OpenSlotsPanel({
  slots,
  filter,
  focusHandle,
  mapFilterCleared,
  slug,
  onSelectZone,
}: {
  slots: MapOpenSlot[];
  filter: MapStatusFilter;
  focusHandle: string | null;
  mapFilterCleared: boolean;
  slug: string;
  onSelectZone: (zoneId: string) => void;
}) {
  const title = mapStatusFilterLabel(filter);
  const openLeft =
    filter === "partial"
      ? slots.filter((slot) => !slot.focusClaimed).length
      : null;

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
          {mapFilterCleared
            ? "Map shows all statuses"
            : filter === "no-wilds"
              ? "Egg / gift spots — no wild slot spent"
              : filter === "partial" && openLeft != null
                ? `${openLeft} still open across partial zones`
                : filter === "claimed"
                  ? "Caught or catch-failed wild slots"
                  : "Still open — tap to jump"}
          {focusHandle ? ` · ${focusHandle}` : ""}.
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
                      <RowStatusBadge
                        claimed={slot.focusClaimed}
                        hatchSafe={slot.hatchSafe}
                        catchFailed={
                          slot.focusClaimed && slot.focusClaims.length === 0
                        }
                      />
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
                      slot.focusFlagClaims.length > 0 ||
                      (!slot.hatchSafe && slot.focusClaims.length === 0)) && (
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
          <p className="text-sm text-muted">
            {filter === "unclaimed"
              ? "No open catches left on the map."
              : "No spots match this filter."}
          </p>
        )}
      </div>
    </Frame>
  );
}

function ZoneDetail({
  selected,
  slug,
  focusHandle,
  onClear,
  backLabel,
}: {
  selected: MapZoneStatus | null;
  slug: string;
  focusHandle: string | null;
  onClear: () => void;
  backLabel: string;
}) {
  if (!selected) return null;

  const { zone, status, rows, hatchRows } = selected;
  const slotTotal = selected.claimedOpenSlots + selected.openSlots;
  const hatchOnly = status === "empty" && hatchRows.length > 0;
  const displayRows = sortRowsUnclaimedFirst(rows);
  const allRows = [...displayRows, ...hatchRows];
  const openLeft = selected.openSlots;

  return (
    <Frame
      dense
      title={zone.name}
      actions={
        <span className="text-[11px] font-semibold tabular-nums text-white/80">
          {hatchOnly
            ? mapStatusFilterLabel("no-wilds")
            : slotTotal > 0
              ? `${selected.claimedOpenSlots}/${slotTotal}`
              : mapStatusLabel(status)}
        </span>
      }
    >
      <div className="space-y-2">
        <button
          type="button"
          onClick={onClear}
          aria-label={`Back to ${backLabel}`}
          className="text-[11px] font-semibold text-interactive hover:underline"
          data-testid="encounter-map-clear-zone"
        >
          <span aria-hidden="true">← </span>
          {backLabel}
        </button>

        <p className="text-[11px] leading-snug text-muted">
          {hatchOnly
            ? "Egg / gift only — no wild catch here"
            : slotTotal > 0
              ? `${selected.claimedOpenSlots} of ${slotTotal} caught${
                  openLeft > 0 ? ` · ${openLeft} open` : ""
                }`
              : "No wild catch here"}
          {focusHandle ? ` · ${focusHandle}` : ""}.
        </p>

        {allRows.length > 0 ? (
          <ul className="divide-y divide-frame/30">
            {allRows.map((row) => (
              <RouteRowDetail key={row.label} row={row} slug={slug} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing to log here.</p>
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

function RowStatusBadge({
  claimed,
  hatchSafe,
  catchFailed = false,
}: {
  claimed: boolean;
  hatchSafe: boolean;
  /**
   * Slot is used but this label has no Pokémon claim — fled/failed burn, or a
   * shared-slot sibling of a catch elsewhere.
   */
  catchFailed?: boolean;
}) {
  const label = hatchSafe
    ? claimed
      ? "Logged"
      : "Open"
    : claimed
      ? catchFailed
        ? "Catch failed!"
        : "Caught"
      : "Open";
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
        catchFailed
          ? "text-danger"
          : claimed
            ? "text-accent-deep/80"
            : "text-muted"
      }`}
      title={
        catchFailed
          ? "First encounter failed — do not catch here again"
          : undefined
      }
    >
      {label}
    </span>
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
    (row.focusClaims.length > 0 ||
      row.focusFlagClaims.length > 0 ||
      (!hatchSafe && row.focusClaims.length === 0));

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
          <RowStatusBadge
            claimed={claimed}
            hatchSafe={hatchSafe}
            catchFailed={claimed && row.focusClaims.length === 0}
          />
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
  claimed,
  focusClaims,
  focusFlagClaims,
  hatchSafe,
  slug,
}: {
  claimed: boolean;
  compact?: boolean;
  focusClaims: MapRouteRow["focusClaims"];
  focusFlagClaims: MapRouteRow["focusFlagClaims"];
  hatchSafe: boolean;
  slug: string;
}) {
  const showUnknown =
    focusClaims.length === 0 &&
    (focusFlagClaims.length > 0 || (claimed && !hatchSafe));
  if (focusClaims.length === 0 && !showUnknown) return null;

  return (
    <div className="flex shrink-0 flex-col items-end justify-center gap-1">
      {showUnknown && (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-dashed border-accent/40 bg-surface text-sm font-semibold text-muted"
          title="Catch failed — no species logged (fled, failed, or released)"
          aria-label="Catch failed — no species logged"
        >
          ?
        </span>
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
