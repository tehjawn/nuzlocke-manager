import {
  classifyBattleStat,
  classifyEv,
  classifyIv,
  qualityToneClass,
  type StatQualityBand,
} from "@/lib/iv-quality";
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
  /**
   * Per-stat rank chip for the Pokédex species briefing. Tile branch only —
   * the meter rows are a positional grid, so a fifth child would wrap.
   */
  ranks?: Partial<Record<StatKey, StatRankChip>> | null;
};

export type StatRankChip = {
  letter: string;
  /** Border / background / text classes from `statRankToneClass`. */
  toneClass: string;
  /** Tooltip spelling out the peer set behind the letter. */
  hint: string;
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

function qualityFor(
  tone: StatGridProps["tone"],
  value: number,
  max: number,
  hasMaxSpread: boolean,
): StatQualityBand {
  if (tone === "iv") return classifyIv(value);
  if (tone === "ev") return classifyEv(value);
  if (hasMaxSpread) return classifyBattleStat(value, max);
  return "average";
}

function labelClass(
  band: StatQualityBand,
  compact: boolean,
): string {
  const size = compact ? "text-[9px]" : "text-[11px]";
  const tone = qualityToneClass(band);
  return tone ? `${size} ${tone}` : `${size} text-muted`;
}

function valueClass(
  band: StatQualityBand,
  compact: boolean,
): string {
  const size = compact ? "text-[11px]" : "text-sm";
  const tone = qualityToneClass(band);
  return tone ? `${size} ${tone}` : size;
}

/** Weaker fills sit a bit washed; near-max reads fuller (length still primary). */
function fillOpacity(pct: number, perfect: boolean): number {
  const base = 0.55 + (Math.min(100, Math.max(0, pct)) / 100) * 0.4;
  return perfect ? Math.min(1, base + 0.12) : base;
}

export function StatGrid({
  spread,
  maxSpread,
  tone = "neutral",
  compact = false,
  showMax = false,
  ranks = null,
}: StatGridProps) {
  const usesMeters =
    maxSpread != null || tone === "iv" || tone === "ev";
  const hasMaxSpread = maxSpread != null;

  if (!usesMeters) {
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
        {STAT_KEYS.map((key) => {
          const rank = ranks?.[key] ?? null;
          return (
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
                className={`font-mono font-bold tabular-nums ${
                  compact ? "text-[11px]" : "text-sm"
                }`}
              >
                {spread[key]}
              </p>
              {rank ? (
                <span
                  className={`mt-0.5 inline-flex items-center justify-center rounded border px-1 text-[10px] font-bold leading-tight ${rank.toneClass}`}
                  title={rank.hint}
                >
                  {rank.letter}
                </span>
              ) : null}
            </div>
          );
        })}
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
        const band = qualityFor(tone, value, max, hasMaxSpread);
        const highlight =
          tone === "iv" || tone === "ev" || hasMaxSpread;
        const perfect = highlight && band === "perfect";

        return (
          <div
            key={key}
            role="listitem"
            className={`grid items-center gap-x-1.5 ${gridCols}`}
            title={`${label} ${value} / ${max}`}
          >
            <span
              className={`font-semibold tracking-tight ${
                highlight
                  ? labelClass(band, compact)
                  : `text-muted ${compact ? "text-[9px]" : "text-[11px]"}`
              }`}
            >
              {label}
            </span>
            <span
              className={`text-right font-mono font-bold tabular-nums ${
                highlight
                  ? valueClass(band, compact)
                  : compact
                    ? "text-[11px]"
                    : "text-sm"
              }`}
              title={
                highlight && band !== "average"
                  ? `${label} ${value} — ${band}`
                  : undefined
              }
            >
              {value}
            </span>
            <div
              className={`stat-meter-track ${compact ? "h-1.5" : "h-2"}${
                perfect ? " stat-meter-track--perfect" : ""
              }`}
              role="meter"
              aria-label={`${label} ${value} of ${max}${
                perfect ? ", perfect" : ""
              }`}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={value}
            >
              <div
                className={`stat-meter-fill ${STAT_FILL[key]}${
                  perfect ? " stat-meter-fill--perfect" : ""
                }`}
                style={{
                  width: `${pct}%`,
                  opacity: fillOpacity(pct, perfect),
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
