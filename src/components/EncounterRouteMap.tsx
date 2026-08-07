"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Frame } from "@/components/Frame";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { HOENN_MAP_VIEWBOX, type HoennMapZone } from "@/data/hoenn-map-zones";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";
import {
  buildEncounterMapStatuses,
  mapStatusLabel,
  unmappedOpenCatchRoutes,
  type MapRouteClaimStatus,
  type MapRouteRow,
  type MapZoneStatus,
} from "@/lib/encounter-route-map";
import type { PersonalRouteStatus } from "@/lib/personal-routes";

type EncounterRouteMapProps = {
  groups: EncounterRouteGroup[];
  myTrainerId?: string | null;
  routeStatuses: PersonalRouteStatus[];
  slug: string;
  /** Switch Encounters ModeTabs to the ledger list. */
  onJumpToClaims?: () => void;
};

const STATUS_FILL: Record<MapRouteClaimStatus, string> = {
  open: "color-mix(in srgb, var(--surface) 70%, var(--surface-2))",
  mine: "color-mix(in srgb, var(--accent) 42%, var(--surface))",
  theirs: "color-mix(in srgb, var(--interactive) 38%, var(--surface))",
  mixed: "color-mix(in srgb, var(--accent-2) 36%, var(--surface))",
  static: "color-mix(in srgb, var(--frame) 18%, var(--surface))",
};

const STATUS_STROKE: Record<MapRouteClaimStatus, string> = {
  open: "color-mix(in srgb, var(--frame) 55%, transparent)",
  mine: "var(--accent-deep)",
  theirs: "var(--interactive)",
  mixed: "var(--accent-2)",
  static: "color-mix(in srgb, var(--frame) 40%, transparent)",
};

export function EncounterRouteMap({
  groups,
  myTrainerId = null,
  routeStatuses,
  slug,
  onJumpToClaims,
}: EncounterRouteMapProps) {
  const [trainerId, setTrainerId] = useState(
    () => myTrainerId ?? routeStatuses[0]?.trainerId ?? "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const focusStatus =
    routeStatuses.find((entry) => entry.trainerId === trainerId) ?? null;

  const zoneStatuses = useMemo(
    () => buildEncounterMapStatuses(groups, focusStatus),
    [groups, focusStatus],
  );

  const selected =
    zoneStatuses.find((entry) => entry.zone.id === selectedId) ?? null;
  const unmapped = useMemo(() => unmappedOpenCatchRoutes(), []);

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
            Schematic zones keyed to catch-route labels. Colors follow the
            selected trainer&apos;s open slots plus pack claims. Click a region
            for the same claim detail as the ledger.
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

      <MapLegend />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,1fr)]">
        <div className="overflow-x-auto rounded-md border border-frame/40 bg-[color-mix(in_srgb,var(--interactive)_8%,var(--surface))]">
          <svg
            aria-label="Hoenn region claim map"
            className="h-auto min-w-[36rem] w-full"
            role="img"
            viewBox={HOENN_MAP_VIEWBOX}
          >
            <title>Hoenn claim map</title>
            <rect
              fill="color-mix(in srgb, var(--interactive) 14%, var(--surface-2))"
              height="400"
              rx="6"
              width="640"
              x="0"
              y="0"
            />
            <text
              className="fill-[var(--muted)]"
              fontSize="11"
              fontWeight="600"
              x="16"
              y="22"
            >
              West ← → East · schematic (not to scale)
            </text>
            {zoneStatuses.map((entry) => (
              <ZoneShape
                key={entry.zone.id}
                entry={entry}
                selected={entry.zone.id === selectedId}
                onSelect={() =>
                  setSelectedId((prev) =>
                    prev === entry.zone.id ? null : entry.zone.id,
                  )
                }
              />
            ))}
          </svg>
        </div>

        <ZoneDetail
          focusHandle={focusStatus?.trainerHandle ?? null}
          onJumpToClaims={onJumpToClaims}
          selected={selected}
          slug={slug}
        />
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
  const items: { status: MapRouteClaimStatus; hint: string }[] = [
    { status: "open", hint: "Open for focus trainer" },
    { status: "mine", hint: "Claimed by focus trainer" },
    { status: "theirs", hint: "Claimed by someone else / pack" },
    { status: "mixed", hint: "Mix of open + claimed" },
    { status: "static", hint: "No wild open slot" },
  ];
  return (
    <ul className="flex flex-wrap gap-2 text-[10px] font-semibold text-muted">
      {items.map((item) => (
        <li
          className="inline-flex items-center gap-1.5 rounded-full border border-frame/35 bg-surface/70 px-2 py-1"
          key={item.status}
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm border"
            style={{
              background: STATUS_FILL[item.status],
              borderColor: STATUS_STROKE[item.status],
            }}
          />
          {item.hint}
        </li>
      ))}
    </ul>
  );
}

function ZoneShape({
  entry,
  selected,
  onSelect,
}: {
  entry: MapZoneStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  const { zone, status } = entry;
  const center = shapeCenter(zone);
  const common = {
    fill: STATUS_FILL[status],
    stroke: selected ? "var(--ink)" : STATUS_STROKE[status],
    strokeWidth: selected ? 2.25 : 1.25,
    className:
      "cursor-pointer transition-[filter] hover:brightness-105 focus:outline-none focus-visible:stroke-[var(--ink)]",
    tabIndex: 0 as const,
    role: "button" as const,
    "aria-label": `${zone.name}: ${mapStatusLabel(status)}, ${entry.claimedOpenSlots} claimed of ${entry.claimedOpenSlots + entry.openSlots} open slots`,
    "aria-pressed": selected,
    onClick: onSelect,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
  };

  return (
    <g data-zone={zone.id}>
      {zone.shape.type === "rect" ? (
        <rect
          {...common}
          height={zone.shape.height}
          rx={5}
          width={zone.shape.width}
          x={zone.shape.x}
          y={zone.shape.y}
        />
      ) : (
        <polygon {...common} points={zone.shape.points} />
      )}
      <text
        className="pointer-events-none select-none fill-[var(--ink)]"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        x={zone.labelAt?.x ?? center.x}
        y={(zone.labelAt?.y ?? center.y) - 4}
      >
        {zone.name}
      </text>
      <text
        className="pointer-events-none select-none fill-[var(--muted)]"
        fontSize="9"
        fontWeight="600"
        textAnchor="middle"
        x={zone.labelAt?.x ?? center.x}
        y={(zone.labelAt?.y ?? center.y) + 10}
      >
        {entry.claimedOpenSlots + entry.openSlots > 0
          ? `${entry.claimedOpenSlots}/${entry.claimedOpenSlots + entry.openSlots}`
          : "—"}
      </text>
    </g>
  );
}

function shapeCenter(zone: HoennMapZone): { x: number; y: number } {
  if (zone.shape.type === "rect") {
    return {
      x: zone.shape.x + zone.shape.width / 2,
      y: zone.shape.y + zone.shape.height / 2,
    };
  }
  const pairs = zone.shape.points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number));
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function ZoneDetail({
  selected,
  slug,
  focusHandle,
  onJumpToClaims,
}: {
  selected: MapZoneStatus | null;
  slug: string;
  focusHandle: string | null;
  onJumpToClaims?: () => void;
}) {
  if (!selected) {
    return (
      <Frame dense title="Zone detail">
        <p className="text-sm text-muted">
          Select a region on the map to see open slots and who claimed them
          {focusHandle ? ` (focus: ${focusHandle})` : ""}.
        </p>
      </Frame>
    );
  }

  const { zone, status, rows, packClaimCount } = selected;
  const slotTotal = selected.claimedOpenSlots + selected.openSlots;
  const hasFocus = focusHandle != null;
  const displayRows = hasFocus ? sortRowsOpenFirst(rows) : rows;

  return (
    <Frame
      dense
      title={zone.name}
      actions={
        <span className="text-[11px] font-semibold tabular-nums text-white/80">
          {mapStatusLabel(status)}
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted">
          {slotTotal > 0
            ? `${selected.claimedOpenSlots} of ${slotTotal} open slots claimed`
            : "No wild open slots in this zone"}
          {selected.openSlots > 0 ? ` · ${selected.openSlots} still open` : ""}
          {packClaimCount > 0 ? ` · ${packClaimCount} pack logs` : ""}
          {hasFocus ? ` (focus: ${focusHandle})` : ""}.
        </p>

        <ul className="space-y-2">
          {displayRows.map((row) => (
            <RouteRowDetail key={row.label} row={row} slug={slug} />
          ))}
        </ul>

        {onJumpToClaims && (
          <button
            type="button"
            className="text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
            onClick={onJumpToClaims}
          >
            Open Route claims list
          </button>
        )}
      </div>
    </Frame>
  );
}

/** Display order when a focus trainer is selected: open → yours → other. */
function sortRowsOpenFirst(rows: MapRouteRow[]): MapRouteRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const rankDiff = rowScanRank(a.row) - rowScanRank(b.row);
      return rankDiff !== 0 ? rankDiff : a.index - b.index;
    })
    .map(({ row }) => row);
}

function rowScanRank(row: MapRouteRow): number {
  if (row.countsTowardOpen && !row.focusClaimed) {
    const packClaimed = row.claims.length + row.flagClaims.length > 0;
    if (!packClaimed) return 0; // still open for focus
  }
  if (row.focusClaimed) return 1; // yours
  return 2; // pack-claimed / static
}

type RouteRowBadge = "Yours" | "Open" | "Claimed" | "Logged" | "Static";

function routeRowBadge(row: MapRouteRow): RouteRowBadge {
  const claimCount = row.claims.length + row.flagClaims.length;
  if (row.countsTowardOpen) {
    if (row.focusClaimed) return "Yours";
    if (claimCount > 0) return "Claimed";
    return "Open";
  }
  return claimCount > 0 ? "Logged" : "Static";
}

function RouteRowDetail({ row, slug }: { row: MapRouteRow; slug: string }) {
  const claimCount = row.claims.length + row.flagClaims.length;
  const badge = routeRowBadge(row);

  const rowChrome =
    badge === "Open"
      ? "border-interactive/50 bg-interactive-soft/55"
      : badge === "Yours"
        ? "border-accent/40 bg-accent/10"
        : "border-frame/30 bg-surface/50";

  return (
    <li className={`rounded-md border px-2.5 py-2 ${rowChrome}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{row.label}</span>
        <RouteStatusChip badge={badge} />
      </div>
      {row.flagClaims.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1">
          {row.flagClaims.map((claim) => (
            <li
              className="rounded-full border border-frame/40 bg-interactive-soft/40 px-2 py-0.5 text-[10px] font-semibold text-ink"
              key={claim.trainerId}
            >
              {claim.trainerHandle} · flag
            </li>
          ))}
        </ul>
      )}
      {row.claims.length > 0 ? (
        <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {row.claims.map((claim) => {
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
                  <span className="w-full truncate text-[9px] text-muted">
                    {claim.trainerHandle}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : claimCount === 0 ? (
        <p className="text-[11px] text-muted">No pack claims yet.</p>
      ) : null}
    </li>
  );
}

function RouteStatusChip({ badge }: { badge: RouteRowBadge }) {
  if (badge === "Yours") {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">
        <CheckIcon className="h-3 w-3" />
        Yours
      </span>
    );
  }
  if (badge === "Open") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-interactive/55 bg-interactive-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink">
        Open
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-frame/35 bg-surface/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
      {badge}
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
