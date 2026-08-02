import { classifyIv } from "@/lib/iv-quality";
import {
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
  type StatSpread,
} from "@/lib/stats";

type StatGridProps = {
  spread: StatSpread;
  /**
   * Ceiling per stat for battle meters (species max at level).
   * When omitted, IV → 31 and EV → 252 from `tone`.
   */
  maxSpread?: StatSpread | null;
  tone?: "neutral" | "iv" | "ev";
  /** Tighter rows for board preview cards. */
  compact?: boolean;
  /** Show ceiling values on the right (details modal). */
  showMax?: boolean;
};

const STAT_FILL: Record<StatKey, string> = {
  hp: "bg-stat-hp",
  atk: "bg-stat-atk",
  def: "bg-stat-def",
  spa: "bg-stat-spa",
  spd: "bg-stat-spd",
  spe: "bg-stat-spe",
};

const IV_CEILING = 31;
const EV_CEILING = 252;

function ceilingFor(
  key: StatKey,
  maxSpread: StatSpread | null | undefined,
  tone: StatGridProps["tone"],
): number | null {
  if (maxSpread) return Math.max(1, maxSpread[key] || 1);
  if (tone === "iv") return IV_CEILING;
  if (tone === "ev") return EV_CEILING;
  return null;
}

/** Call out cracked / dump IVs without changing bar length. */
function ivValueClass(value: number, compact: boolean): string {
  const band = classifyIv(value);
  const size = compact ? "text-[11px]" : "text-sm";
  if (band === "perfect") {
    return `${size} text-accent-2`;
  }
  if (band === "strong") {
    return `${size} text-accent-deep`;
  }
  if (band === "dump") {
    return `${size} text-muted`;
  }
  return size;
}

/** Weaker fills sit a bit washed; near-max reads fuller (length still primary). */
function fillOpacity(pct: number): number {
  return 0.55 + (Math.min(100, Math.max(0, pct)) / 100) * 0.4;
}

export function StatGrid({
  spread,
  maxSpread,
  tone = "neutral",
  compact = false,
  showMax = false,
}: StatGridProps) {
  const usesMeters =
    maxSpread != null || tone === "iv" || tone === "ev";

  if (!usesMeters) {
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
        {STAT_KEYS.map((key) => (
          <div
            key={key}
            className={`rounded-lg border border-frame/40 bg-surface-2 text-center ${
              compact ? "px-1 py-1" : "px-2 py-1.5"
            }`}
          >
            <p
              className={`font-semibold tracking-tight text-muted ${
                compact ? "text-[9px]" : "text-[11px]"
              }`}
            >
              {STAT_LABELS[key]}
            </p>
            <p
              className={`font-mono font-bold ${
                compact ? "text-[11px]" : "text-sm"
              }`}
            >
              {spread[key]}
            </p>
          </div>
        ))}
      </div>
    );
  }

  const gridCols = showMax
    ? compact
      ? "grid-cols-[1.55rem_1.6rem_minmax(0,1fr)_1.6rem]"
      : "grid-cols-[2rem_2.25rem_minmax(0,1fr)_2.25rem]"
    : compact
      ? "grid-cols-[1.55rem_1.6rem_minmax(0,1fr)]"
      : "grid-cols-[2rem_2.25rem_minmax(0,1fr)]";

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"} role="list">
      {STAT_KEYS.map((key) => {
        const value = spread[key];
        const max = ceilingFor(key, maxSpread, tone) ?? 1;
        const pct = Math.min(100, Math.max(0, (value / max) * 100));
        const label = STAT_LABELS[key];

        return (
          <div
            key={key}
            role="listitem"
            className={`grid items-center gap-x-1.5 ${gridCols}`}
            title={`${label} ${value} / ${max}`}
          >
            <span
              className={`font-semibold tracking-tight text-muted ${
                compact ? "text-[9px]" : "text-[11px]"
              }`}
            >
              {label}
            </span>
            <span
              className={`text-right font-mono font-bold tabular-nums ${
                tone === "iv"
                  ? ivValueClass(value, compact)
                  : compact
                    ? "text-[11px]"
                    : "text-sm"
              }`}
              title={
                tone === "iv"
                  ? `${label} ${value} — ${classifyIv(value)}`
                  : undefined
              }
            >
              {value}
            </span>
            <div
              className={`stat-meter-track ${compact ? "h-1.5" : "h-2"}`}
              role="meter"
              aria-label={`${label} ${value} of ${max}`}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={value}
            >
              <div
                className={`stat-meter-fill ${STAT_FILL[key]}`}
                style={{
                  width: `${pct}%`,
                  opacity: fillOpacity(pct),
                }}
              />
            </div>
            {showMax ? (
              <span
                className={`text-right font-mono tabular-nums text-muted ${
                  compact ? "text-[9px]" : "text-[11px]"
                }`}
              >
                {max}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
