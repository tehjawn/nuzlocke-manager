"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchGmAnalyticsAction } from "@/app/actions/gm-analytics";
import { TypeBadge } from "@/components/TypeBadge";
import type {
  GmAnalyticsReport,
  LeastCoveredRow,
  PackPressureRow,
  TypeFrequencyRow,
} from "@/lib/gm-analytics";
import type { PokemonType } from "@/lib/pokemon-types";

const LIST_LIMIT = 10;

function asChipType(type: string): PokemonType {
  return type as PokemonType;
}

function MetricList({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="gm-analytics__metric">
      <header className="gm-analytics__metric-head">
        <h3 className="gm-analytics__metric-title">{title}</h3>
        <p className="gm-analytics__metric-desc">{description}</p>
      </header>
      {children}
    </section>
  );
}

function LeastCoveredList({
  rows,
  thin,
}: {
  rows: LeastCoveredRow[];
  thin: boolean;
}) {
  const shown = rows.slice(0, LIST_LIMIT);
  return (
    <ol className="gm-analytics__rank">
      {shown.map((row) => {
        const soft = row.mainCount > 0 && row.answeredCount / row.mainCount < 0.35;
        return (
          <li key={row.defendingType} className="gm-analytics__rank-row">
            <TypeBadge type={asChipType(row.defendingType)} size="sm" />
            <span className="gm-analytics__rank-copy">
              {row.defendingType} · {row.answeredCount}/{row.mainCount} Mains
              have an answer
              {soft && !thin ? (
                <span className="gm-analytics__flag"> Soft into</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PackPressureList({
  rows,
  thin,
}: {
  rows: PackPressureRow[];
  thin: boolean;
}) {
  const shown = rows.filter((r) => r.pressuredCount > 0).slice(0, LIST_LIMIT);
  if (shown.length === 0) {
    return (
      <p className="gm-console__hint">
        No shared pack pressure yet — nothing hits multiple Mains hard.
      </p>
    );
  }
  return (
    <ol className="gm-analytics__rank">
      {shown.map((row) => {
        const hot =
          !thin &&
          row.mainCount > 0 &&
          row.pressuredCount / row.mainCount >= 0.5;
        return (
          <li key={row.attackType} className="gm-analytics__rank-row">
            <TypeBadge type={asChipType(row.attackType)} size="sm" />
            <span className="gm-analytics__rank-copy">
              Weak to {row.attackType} — pressures {row.pressuredCount}/
              {row.mainCount} Mains
              {hot ? <span className="gm-analytics__flag"> Pack hole</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TypeFrequencyList({ rows }: { rows: TypeFrequencyRow[] }) {
  const shown = rows.filter((r) => r.count > 0).slice(0, LIST_LIMIT);
  if (shown.length === 0) {
    return <p className="gm-console__hint">No MAIN typing yet.</p>;
  }
  const max = shown[0]?.count ?? 1;
  return (
    <ol className="gm-analytics__rank">
      {shown.map((row) => {
        const pct = Math.round(row.share * 100);
        const bar = Math.max(8, Math.round((row.count / max) * 100));
        return (
          <li key={row.type} className="gm-analytics__rank-row gm-analytics__rank-row--bar">
            <TypeBadge type={asChipType(row.type)} size="sm" />
            <span className="gm-analytics__rank-copy">
              {row.type} · ×{row.count}
              {pct > 0 ? ` · ${pct}% of MAIN typing` : ""}
            </span>
            <span
              className="gm-analytics__bar"
              style={{ width: `${bar}%` }}
              aria-hidden
            />
          </li>
        );
      })}
    </ol>
  );
}

export function GmAnalyticsPanel({ slug }: { slug: string }) {
  const [report, setReport] = useState<GmAnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchGmAnalyticsAction({ slug });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setReport(null);
        setLoading(false);
        return;
      }
      setReport(result.report);
      setError(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <p className="gm-console__hint">Loading Main Squad coverage…</p>;
  }

  if (error) {
    return <p className="gm-console__hint text-danger">{error}</p>;
  }

  if (!report) {
    return <p className="gm-console__hint">No analytics available.</p>;
  }

  const thin = report.mainsWithPokemon < 2;
  const early = report.mainsWithPokemon < 3;

  return (
    <div className="gm-analytics">
      <div className="gm-analytics__summary" aria-live="polite">
        <p className="gm-analytics__counts">
          {report.mainsWithPokemon} Main
          {report.mainsWithPokemon === 1 ? "" : "s"} with Pokémon
          {report.claimedTrainerCount > 0
            ? ` · ${report.claimedTrainerCount} claimed trainer${report.claimedTrainerCount === 1 ? "" : "s"}`
            : ""}
          {report.mainPokemonCount > 0
            ? ` · ${report.mainPokemonCount} MAIN slot${report.mainPokemonCount === 1 ? "" : "s"}`
            : ""}
        </p>
        <ul className="gm-analytics__callouts">
          {report.callouts.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {thin ? (
        <p className="gm-console__hint">
          Ranked lists stay available, but pack patterns are noisy until a few
          more Mains fill in.
        </p>
      ) : null}

      <div className="gm-analytics__grid">
        <MetricList
          title="Least covered types"
          description="Defending types fewest Mains hit hard (strong against ≥2×)."
        >
          {report.mainsWithPokemon === 0 ? (
            <p className="gm-console__hint">No Main Squads to score yet.</p>
          ) : (
            <LeastCoveredList rows={report.leastCovered} thin={thin} />
          )}
        </MetricList>

        <MetricList
          title="Pack pressure"
          description="Attack types that hit the most Mains hard — shared holes across the pack."
        >
          {report.mainsWithPokemon === 0 ? (
            <p className="gm-console__hint">No Main Squads to score yet.</p>
          ) : (
            <PackPressureList rows={report.packPressure} thin={thin} />
          )}
        </MetricList>

        <MetricList
          title="MAIN type frequency"
          description="How often each type appears on saved Main Squad slots."
        >
          <TypeFrequencyList rows={report.typeFrequency} />
        </MetricList>
      </div>

      <details className="gm-analytics__disclosure">
        <summary>How “hits hard” is scored</summary>
        <p>
          Same literacy as Team Planner: a Main has an <strong>answer</strong>{" "}
          for a defending type when any mon on that Main lands a{" "}
          <strong>≥2×</strong> hit (STAB or a known damaging move). Pack
          pressure counts a Main when any of its Pokémon is{" "}
          <strong>weak to</strong> that attack type (≥2×). Early seasons (
          {early ? "like now" : "few Mains"}) read as hints, not gospel.
        </p>
      </details>
    </div>
  );
}
