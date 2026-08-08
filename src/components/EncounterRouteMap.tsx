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
  countHatchSpots,
  countOpenSlots,
  listOpenSlotsForMap,
  MAP_METHOD_FILTERS,
  mapMethodLabel,
  mapOffRouteKindLabel,
  mapOffRouteKindNote,
  mapStatusLabel,
  sortMapMethods,
  unmappedOpenCatchRoutes,
  zoneHasHatchSafe,
  zoneIsPaintable,
  zoneMatchesMapFilter,
  type MapMethodFilter,
  type MapOffRouteKind,
  type MapOpenSlot,
  type MapRouteClaimStatus,
  type MapRouteRow,
  type MapZoneStatus,
} from "@/lib/encounter-route-map";
import { encountersHref } from "@/lib/encounters-view";
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
  const [showEncounters, setShowEncounters] = useState(false);
  const [unclaimedOnly, setUnclaimedOnly] = useState(false);
  const [methodFilters, setMethodFilters] = useState<MapMethodFilter[]>([]);

  const focusStatus =
    routeStatuses.find((entry) => entry.trainerId === trainerId) ?? null;

  const zoneStatuses = useMemo(
    () => buildEncounterMapStatuses(groups, focusStatus),
    [groups, focusStatus],
  );

  const filter = useMemo(
    () => ({ unclaimedOnly, methods: methodFilters }),
    [unclaimedOnly, methodFilters],
  );

  const openSlotTotal = useMemo(
    () => countOpenSlots(zoneStatuses),
    [zoneStatuses],
  );
  const hatchSpotTotal = useMemo(
    () => countHatchSpots(zoneStatuses),
    [zoneStatuses],
  );

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
  const unmapped = useMemo(() => unmappedOpenCatchRoutes(), []);
  const planningActive = unclaimedOnly || methodFilters.length > 0;

  function toggleMethod(method: MapMethodFilter) {
    setMethodFilters((prev) => {
      const next = prev.includes(method)
        ? prev.filter((entry) => entry !== method)
        : [...prev, method];
      if (next.length > 0) setSelectedId(null);
      return next;
    });
  }

  return (
    <section
      aria-labelledby="encounter-map-heading"
      className="space-y-3"
      data-testid="encounter-route-map"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h3
            className="font-display text-lg font-bold"
            id="encounter-map-heading"
          >
            Hoenn claim map
          </h3>
          <p className="max-w-xl text-xs text-muted">
            Game region map with pret-accurate route hit targets. Colors follow
            the focused trainer&apos;s open-slot progress — plus no-wilds spots
            (egg / gift / fossil) that never spend a wild slot. Use filters to
            plan.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-frame/40 bg-surface/70 px-2.5 py-2 text-xs font-semibold text-ink">
            <input
              checked={showEncounters}
              className="accent-[var(--accent)]"
              data-testid="encounter-map-show-encounters"
              onChange={(event) => setShowEncounters(event.target.checked)}
              type="checkbox"
            />
            Show encounters
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={unclaimedOnly}
          data-testid="encounter-map-unclaimed-only"
          onClick={() => {
            setUnclaimedOnly((prev) => {
              const next = !prev;
              if (next) setSelectedId(null);
              return next;
            });
          }}
          className={`pressable inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            unclaimedOnly
              ? "border-interactive/45 bg-interactive-soft text-ink"
              : "border-frame/40 bg-surface/70 text-ink hover:border-interactive/35"
          }`}
        >
          Unclaimed only
          <span className="tabular-nums text-muted">({openSlotTotal})</span>
        </button>
        <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted sm:inline">
          Methods
        </span>
        {MAP_METHOD_FILTERS.map((method) => {
          const active = methodFilters.includes(method);
          const countHint =
            method === "no-wilds" ? (
              <span className="tabular-nums text-muted">
                ({hatchSpotTotal})
              </span>
            ) : null;
          return (
            <button
              key={method}
              type="button"
              aria-pressed={active}
              data-testid={`encounter-map-method-${method}`}
              onClick={() => toggleMethod(method)}
              className={`pressable inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                active
                  ? "border-interactive/45 bg-interactive-soft text-ink"
                  : "border-frame/35 bg-surface/60 text-muted hover:border-frame/55 hover:text-ink"
              }`}
            >
              {mapMethodLabel(method)}
              {countHint}
            </button>
          );
        })}
        {planningActive && (
          <button
            type="button"
            data-testid="encounter-map-clear-filters"
            onClick={() => {
              setUnclaimedOnly(false);
              setMethodFilters([]);
            }}
            className="pressable text-[11px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
          >
            Clear filters
          </button>
        )}
      </div>

      <MapLegend />

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
            showEncounters={showEncounters}
            slug={slug}
          />
        ) : planningActive ? (
          <OpenSlotsPanel
            focusHandle={focusStatus?.trainerHandle ?? null}
            slots={openSlots}
            onSelectZone={(zoneId) => setSelectedId(zoneId)}
          />
        ) : (
          <Frame dense title="Route detail">
            <p className="text-sm text-muted">
              Select a route or town on the map to see open-slot progress
              {focusHandleLine(focusStatus?.trainerHandle)}. Turn on{" "}
              <span className="font-semibold text-ink">Unclaimed only</span> or{" "}
              <span className="font-semibold text-ink">No wilds</span> to plan.
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

function MapLegend() {
  const items: {
    key: string;
    hint: string;
    fill: string;
    stroke: string;
    dashed?: boolean;
  }[] = [
    {
      key: "unclaimed",
      hint: "Unclaimed (outline)",
      fill: STATUS_FILL.unclaimed,
      stroke: STATUS_STROKE.unclaimed,
      dashed: true,
    },
    {
      key: "partial",
      hint: "Partially claimed",
      fill: STATUS_FILL.partial,
      stroke: STATUS_STROKE.partial,
    },
    {
      key: "claimed",
      hint: "Fully claimed",
      fill: STATUS_FILL.claimed,
      stroke: STATUS_STROKE.claimed,
    },
    {
      key: "hatch",
      hint: "No wilds (egg / gift / fossil)",
      fill: HATCH_FILL,
      stroke: HATCH_STROKE,
      dashed: true,
    },
  ];
  return (
    <ul className="flex flex-wrap gap-2 text-[10px] font-semibold text-muted">
      {items.map((item) => (
        <li
          className="inline-flex items-center gap-1.5 rounded-full border border-frame/35 bg-surface/70 px-2 py-1"
          key={item.key}
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
        </li>
      ))}
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
  onSelectZone,
}: {
  slots: MapOpenSlot[];
  focusHandle: string | null;
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
      <div className="space-y-3">
        <p className="text-xs text-muted">
          {noWildsCount > 0 && wildCount === 0
            ? "Outdoor maps with no wild table — eggs, gifts, or fossils can log here without spending a wild route slot"
            : "Spots matching the current filters"}
          {focusHandleLine(focusHandle)}. Click a row to jump to that region.
        </p>

        {slots.length > 0 ? (
          <ul
            className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-0.5"
            data-testid="encounter-map-open-slots"
          >
            {slots.map((slot) => (
              <li key={`${slot.zoneId}:${slot.label}`}>
                <button
                  type="button"
                  onClick={() => onSelectZone(slot.zoneId)}
                  className="pressable flex w-full flex-col gap-1 rounded-md border border-frame bg-surface-2 px-2.5 py-2 text-left hover:border-interactive/40 hover:bg-interactive-soft/25"
                >
                  <span className="text-sm font-semibold leading-tight tracking-tight text-ink">
                    {slot.label}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {slot.label !== slot.zoneName && (
                      <span className="text-[10px] font-semibold text-muted">
                        {slot.zoneName}
                      </span>
                    )}
                    {slot.hatchSafe ? (
                      <OffRouteChip kind={slot.offRouteKind} />
                    ) : (
                      <MethodChips methods={slot.methods} />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No spots match these filters.
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
  showEncounters,
}: {
  selected: MapZoneStatus | null;
  slug: string;
  focusHandle: string | null;
  showEncounters: boolean;
}) {
  if (!selected) return null;

  const { zone, status, rows, hatchRows } = selected;
  const slotTotal = selected.claimedOpenSlots + selected.openSlots;
  const hatchOnly = status === "empty" && hatchRows.length > 0;
  const displayRows = sortRowsUnclaimedFirst(rows);

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
      <div className="space-y-3">
        <p className="text-xs text-muted">
          {hatchOnly
            ? "No wild open slot — gifts, fossils, or outdoor hatching can log here without spending a ROM route bit"
            : slotTotal > 0
              ? `${selected.claimedOpenSlots} of ${slotTotal} claimed`
              : "No wild open slots here"}
          {!hatchOnly && selected.openSlots > 0
            ? ` · ${selected.openSlots} still unclaimed`
            : ""}
          {focusHandleLine(focusHandle)}.
        </p>

        {displayRows.length > 0 && (
          <ul className="space-y-2">
            {displayRows.map((row) => (
              <RouteRowDetail
                key={row.label}
                row={row}
                showEncounters={showEncounters}
                slug={slug}
              />
            ))}
          </ul>
        )}

        {hatchRows.length > 0 && (
          <div className="space-y-2">
            {!hatchOnly && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                No wilds
              </p>
            )}
            <ul className="space-y-2">
              {hatchRows.map((row) => (
                <RouteRowDetail
                  key={row.label}
                  row={row}
                  showEncounters={showEncounters}
                  slug={slug}
                />
              ))}
            </ul>
          </div>
        )}

        {displayRows.length === 0 && hatchRows.length === 0 && (
          <p className="text-sm text-muted">No open-slot routes here.</p>
        )}

        <Link
          href={encountersHref(slug, "claims")}
          className="inline-block text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
        >
          Open Route claims list
        </Link>
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
  showEncounters,
}: {
  row: MapRouteRow;
  slug: string;
  showEncounters: boolean;
}) {
  const claimed = row.focusClaimed;
  const hatchSafe = row.hatchSafe;
  const rowChrome = claimed
    ? "border-accent/50 bg-accent/10"
    : hatchSafe
      ? "border-interactive/35 bg-interactive-soft/25"
      : "border-frame bg-surface-2";

  const hasFocusEncounters =
    row.focusClaims.length > 0 || row.focusFlagClaims.length > 0;

  return (
    <li className={`rounded-md border px-2.5 py-2 ${rowChrome}`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`min-w-0 text-sm font-semibold leading-tight tracking-tight ${
            claimed ? "text-accent-deep" : "text-ink"
          }`}
        >
          {row.label}
        </span>
        <RouteStatusChip claimed={claimed} hatchSafe={hatchSafe} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {hatchSafe ? (
          <OffRouteChip kind={row.offRouteKind} />
        ) : (
          <MethodChips methods={row.methods} />
        )}
      </div>

      {hatchSafe && (
        <p className="mt-1.5 text-[11px] text-muted">
          {mapOffRouteKindNote(row.offRouteKind)}
        </p>
      )}

      {showEncounters && (
        <div className="mt-1.5">
          {row.focusFlagClaims.length > 0 && (
            <ul className="mb-1.5 flex flex-wrap gap-1">
              {row.focusFlagClaims.map((claim) => (
                <li
                  className="rounded-full border border-frame/40 bg-interactive-soft/40 px-2 py-0.5 text-[10px] font-semibold text-ink"
                  key={claim.trainerId}
                >
                  {claim.trainerHandle} · flag
                </li>
              ))}
            </ul>
          )}
          {row.focusClaims.length > 0 ? (
            <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {row.focusClaims.map((claim) => {
                const label = claim.nickname?.trim() || claim.species;
                return (
                  <li key={claim.pokemonId}>
                    <Link
                      href={`/challenges/${slug}/trainers/${claim.trainerId}`}
                      title={`${label} · ${claim.trainerHandle}`}
                      aria-label={`${label} · ${claim.trainerHandle}${
                        claim.isAlive ? "" : " · fallen"
                      }`}
                      className="pressable flex flex-col items-center gap-0.5 rounded-md border border-frame/25 bg-surface/40 px-1 py-1 text-center hover:border-interactive/40"
                    >
                      <PokemonSpriteImage
                        alt=""
                        className={`pixelated h-10 w-10 object-contain ${
                          claim.isAlive ? "" : "opacity-50 grayscale"
                        }`}
                        height={40}
                        pokedexId={claim.pokedexId}
                        shiny={claim.isShiny}
                        species={claim.species}
                        width={40}
                      />
                      <span className="w-full truncate text-[10px] font-semibold leading-tight">
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : !hasFocusEncounters ? (
            <p className="text-[11px] text-muted">
              {hatchSafe
                ? claimed
                  ? "Logged here — no sprites on the board."
                  : "Nothing logged here yet."
                : claimed
                  ? "Slot claimed — no catch logged on the board."
                  : "No encounters logged yet."}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}

function OffRouteChip({ kind }: { kind: MapOffRouteKind | null }) {
  return (
    <span className="rounded-full border border-interactive/40 bg-interactive-soft/50 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
      {mapOffRouteKindLabel(kind)}
    </span>
  );
}

function MethodChips({
  methods,
}: {
  methods: readonly CatchRouteEncounter[];
}) {
  if (methods.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {sortMapMethods(methods).map((method) => (
        <li
          key={method}
          className="rounded-full border border-frame/40 bg-surface/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted"
        >
          {mapMethodLabel(method)}
        </li>
      ))}
    </ul>
  );
}

function RouteStatusChip({
  claimed,
  hatchSafe,
}: {
  claimed: boolean;
  hatchSafe: boolean;
}) {
  if (hatchSafe) {
    if (claimed) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">
          Logged
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-interactive/40 bg-interactive-soft/40 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
        Available
      </span>
    );
  }

  if (claimed) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[var(--on-accent)]"
          aria-hidden
        >
          <CheckIcon className="h-2.5 w-2.5" />
        </span>
        Claimed
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-frame/45 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink">
      <UnclaimedIcon className="h-3 w-3 text-muted" />
      Unclaimed
    </span>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M3.5 8.2 6.2 11l6.3-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnclaimedIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <rect
        x="3"
        y="3"
        width="10"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}
