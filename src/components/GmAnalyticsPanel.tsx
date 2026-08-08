"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchGmAnalyticsAction } from "@/app/actions/gm-analytics";
import { TypeBadge } from "@/components/TypeBadge";
import {
  GM_ANALYTICS_SECTIONS,
  type GmAnalyticsSection,
  type GmAppReport,
  type GmGameReport,
  type GmPokemonReport,
  type GmRankRow,
  type GmSpeciesRankRow,
  type GmStatCallout,
  type GmTrainersReport,
  type GmTypeRankRow,
} from "@/lib/gm-analytics";
import type { PokemonType } from "@/lib/pokemon-types";

const LIST_LIMIT = 8;

type RankDirection = "strongest" | "weakest";

type CachedReports = {
  app?: GmAppReport;
  trainers?: GmTrainersReport;
  pokemon?: GmPokemonReport;
  game?: GmGameReport;
};

const SECTION_META: Record<
  GmAnalyticsSection,
  { label: string; blurb: string }
> = {
  app: {
    label: "App",
    blurb: "Season pulse — joins, intros, and recent board activity.",
  },
  trainers: {
    label: "Trainers",
    blurb: "Badge pace, playtime, money, and wipes across claimed boards.",
  },
  pokemon: {
    label: "Pokémon",
    blurb: "Species, typing meta, held items, and Main grades.",
  },
  game: {
    label: "Game",
    blurb: "Missed claims, deadliest routes, and most-caught routes.",
  },
};

function asChipType(type: string): PokemonType {
  return type as PokemonType;
}

function MetricCard({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <section className="gm-analytics__metric">
      <header className="gm-analytics__metric-head">
        <h3 className="gm-analytics__metric-title">{title}</h3>
        {blurb ? <p className="gm-analytics__metric-desc">{blurb}</p> : null}
      </header>
      {children}
    </section>
  );
}

function SortToggle({
  value,
  onChange,
}: {
  value: RankDirection;
  onChange: (next: RankDirection) => void;
}) {
  return (
    <div className="gm-analytics__sort" role="group" aria-label="Rank order">
      <span className="gm-analytics__sort-label">Sort</span>
      <button
        type="button"
        className={`gm-analytics__sort-btn${
          value === "strongest" ? " gm-analytics__sort-btn--active" : ""
        }`}
        aria-pressed={value === "strongest"}
        onClick={() => onChange("strongest")}
      >
        Strongest ↑
      </button>
      <button
        type="button"
        className={`gm-analytics__sort-btn${
          value === "weakest" ? " gm-analytics__sort-btn--active" : ""
        }`}
        aria-pressed={value === "weakest"}
        onClick={() => onChange("weakest")}
      >
        Weakest ↓
      </button>
    </div>
  );
}

function CalloutStrip({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="gm-analytics__callouts">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function StatGrid({ stats }: { stats: GmStatCallout[] }) {
  return (
    <dl className="gm-analytics__stat-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="gm-analytics__stat">
          <dt>{stat.label}</dt>
          <dd>
            {stat.value}
            {stat.hint ? (
              <span className="gm-analytics__stat-hint">{stat.hint}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PlainRankList({
  rows,
  direction = "strongest",
  empty,
  format,
}: {
  rows: readonly GmRankRow[];
  direction?: RankDirection;
  empty: string;
  format?: (row: GmRankRow) => string;
}) {
  const sorted =
    direction === "strongest" ? [...rows] : [...rows].reverse();
  const filtered =
    direction === "strongest" ? sorted.filter((r) => r.score > 0) : sorted;
  const shown = filtered.slice(0, LIST_LIMIT);
  if (shown.length === 0) {
    return <p className="gm-console__hint">{empty}</p>;
  }
  return (
    <ol className="gm-analytics__rank">
      {shown.map((row, index) => (
        <li key={`${row.label}-${index}`} className="gm-analytics__rank-row">
          <span className="gm-analytics__rank-index" aria-hidden>
            {index + 1}
          </span>
          <span className="gm-analytics__rank-copy">
            {format
              ? format(row)
              : `${row.label} · ${row.detail ?? row.score}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SpeciesRankList({
  rows,
  empty,
}: {
  rows: readonly GmSpeciesRankRow[];
  empty: string;
}) {
  const shown = rows.filter((r) => r.count > 0).slice(0, LIST_LIMIT);
  if (shown.length === 0) {
    return <p className="gm-console__hint">{empty}</p>;
  }
  return (
    <ol className="gm-analytics__rank">
      {shown.map((row, index) => (
        <li key={row.species} className="gm-analytics__rank-row">
          <span className="gm-analytics__rank-index" aria-hidden>
            {index + 1}
          </span>
          <span className="gm-analytics__rank-copy">
            {row.species} · ×{row.count}
          </span>
        </li>
      ))}
    </ol>
  );
}

function TypeRankList({
  rows,
  direction,
  empty,
  formatLine,
}: {
  rows: readonly GmTypeRankRow[];
  direction: RankDirection;
  empty: string;
  formatLine: (row: GmTypeRankRow) => string;
}) {
  const sorted =
    direction === "strongest" ? [...rows] : [...rows].reverse();
  const filtered =
    direction === "strongest" ? sorted.filter((r) => r.score > 0) : sorted;
  const shown = filtered.slice(0, LIST_LIMIT);
  if (shown.length === 0) {
    return <p className="gm-console__hint">{empty}</p>;
  }
  return (
    <ol className="gm-analytics__rank">
      {shown.map((row, index) => (
        <li key={row.type} className="gm-analytics__rank-row">
          <span className="gm-analytics__rank-index" aria-hidden>
            {index + 1}
          </span>
          <TypeBadge type={asChipType(row.type)} size="sm" />
          <span className="gm-analytics__rank-copy">{formatLine(row)}</span>
        </li>
      ))}
    </ol>
  );
}

function AppSection({ report }: { report: GmAppReport }) {
  return (
    <div className="gm-analytics__stack">
      <div className="gm-analytics__summary">
        <CalloutStrip lines={report.callouts} />
      </div>

      <div className="gm-analytics__notice">
        <p className="gm-analytics__notice-title">Product analytics</p>
        <p>
          Daily active users and session length are not tracked in-app yet
          (Vercel Web Analytics is dashboard-only). This tab is a season pulse
          from board activity.
        </p>
      </div>

      <StatGrid
        stats={[
          {
            label: "Claimed",
            value: String(report.claimedTrainers),
          },
          {
            label: "Open slots",
            value: String(report.openTrainers),
          },
          {
            label: "Intro done",
            value: String(report.introDone),
            hint:
              report.introPending > 0
                ? `${report.introPending} pending`
                : undefined,
          },
          {
            label: "Active (7d)",
            value: String(report.activeTrainers7d),
            hint: `${report.activityLast7d} events`,
          },
        ]}
      />

      <MetricCard
        title="Recent activity"
        blurb="Board events in the last 7 days."
      >
        <PlainRankList
          rows={report.activityByType}
          empty="No activity in the last 7 days."
          format={(row) => `${row.label} · ${row.score}`}
        />
      </MetricCard>
    </div>
  );
}

function TrainersSection({ report }: { report: GmTrainersReport }) {
  return (
    <div className="gm-analytics__stack">
      <StatGrid stats={report.callouts} />
      <div className="gm-analytics__grid">
        <MetricCard title="Badge leaders" blurb="Most gym / E4 progress.">
          <PlainRankList
            rows={report.badgeLeaders}
            empty="No claimed trainers yet."
          />
        </MetricCard>
        <MetricCard title="Playtime leaders" blurb="Imported Gen 3 playtime.">
          <PlainRankList
            rows={report.playtimeLeaders}
            empty="No playtime imported yet."
          />
        </MetricCard>
        <MetricCard title="Money leaders" blurb="Imported Pokédollars.">
          <PlainRankList
            rows={report.moneyLeaders}
            empty="No wallets imported yet."
          />
        </MetricCard>
        <MetricCard title="Wipe leaders" blurb="Closed runs this season.">
          <PlainRankList
            rows={report.wipeLeaders.filter((r) => r.score > 0)}
            empty="No wipes yet — soft season so far."
          />
        </MetricCard>
      </div>
    </div>
  );
}

function PokemonSection({
  report,
  direction,
}: {
  report: GmPokemonReport;
  direction: RankDirection;
}) {
  const strongest = direction === "strongest";
  return (
    <div className="gm-analytics__stack">
      <div className="gm-analytics__summary">
        <p className="gm-analytics__counts">
          {report.mainsWithPokemon} Main
          {report.mainsWithPokemon === 1 ? "" : "s"} · {report.mainPokemonCount}{" "}
          Pokémon
          {report.medianCatchScore != null
            ? ` · median catch score ${report.medianCatchScore}`
            : ""}
        </p>
        <CalloutStrip lines={report.callouts} />
      </div>

      <div className="gm-analytics__grid">
        <MetricCard title="Most on Main" blurb="Saved Main Squad species.">
          <SpeciesRankList
            rows={report.mainSpecies}
            empty="No Main Squad Pokémon yet."
          />
        </MetricCard>
        <MetricCard title="Most caught" blurb="Party, box, and graves.">
          <SpeciesRankList
            rows={report.caughtSpecies}
            empty="No catches logged yet."
          />
        </MetricCard>
        <MetricCard title="Most seen" blurb="Any board slot, including seen-only.">
          <SpeciesRankList
            rows={report.seenSpecies}
            empty="Nothing logged yet."
          />
        </MetricCard>
      </div>

      <div className="gm-analytics__grid">
        <MetricCard
          title={strongest ? "Most common typing" : "Least common typing"}
          blurb="What Main Squads are made of."
        >
          <TypeRankList
            rows={report.popularTyping}
            direction={direction}
            empty="No Main typing yet."
            formatLine={(row) =>
              `${row.type} · on ${row.score} slot${row.score === 1 ? "" : "s"}`
            }
          />
        </MetricCard>
        <MetricCard
          title={strongest ? "Best answers" : "Softest answers"}
          blurb={
            strongest
              ? "Types most Mains can hit hard."
              : "Types fewest Mains have an answer for."
          }
        >
          <TypeRankList
            rows={report.bestAnswers}
            direction={direction}
            empty="No answers scored yet."
            formatLine={(row) =>
              `${row.type} · ${row.score}/${row.mainCount} Mains`
            }
          />
        </MetricCard>
        <MetricCard
          title={strongest ? "Biggest threats" : "Safest from"}
          blurb={
            strongest
              ? "Attack types that hurt the most Mains."
              : "Attack types that pressure the fewest Mains."
          }
        >
          <TypeRankList
            rows={report.biggestThreats}
            direction={direction}
            empty="Nothing is pressuring Mains yet."
            formatLine={(row) =>
              `${row.type} · hurts ${row.score}/${row.mainCount} Mains`
            }
          />
        </MetricCard>
      </div>

      <div className="gm-analytics__grid">
        <MetricCard title="Held items on Main" blurb="Non-empty held items only.">
          <PlainRankList
            rows={report.heldItems}
            empty="No held items on Mains yet."
            format={(row) => `${row.label} · ×${row.score}`}
          />
        </MetricCard>
        <MetricCard
          title="Training / bond on Main"
          blurb={
            report.catchScoreSample > 0
              ? `Catch scores graded on ${report.catchScoreSample} Main${report.catchScoreSample === 1 ? "" : "s"}.`
              : "Needs imported IVs / EVs / friendship."
          }
        >
          <PlainRankList
            rows={report.trainingTierCounts}
            empty="No training grades on Mains yet."
            format={(row) =>
              `${row.label} · ${row.detail ?? `×${row.score}`}`
            }
          />
        </MetricCard>
      </div>
    </div>
  );
}

function GameSection({ report }: { report: GmGameReport }) {
  return (
    <div className="gm-analytics__stack">
      <div className="gm-analytics__summary">
        <p className="gm-analytics__counts">
          {report.trainersWithFlags} trainer
          {report.trainersWithFlags === 1 ? "" : "s"} with imported encounter
          flags
        </p>
        <CalloutStrip lines={report.callouts} />
      </div>
      <div className="gm-analytics__grid">
        <MetricCard
          title="Most missed claims"
          blurb="Spent the route flag, no owned catch."
        >
          <PlainRankList
            rows={report.missedClaimRoutes}
            empty="No missed claims detected."
          />
        </MetricCard>
        <MetricCard
          title="Deadliest routes"
          blurb="Graves by catch route on live boards."
        >
          <PlainRankList
            rows={report.deadliestRoutes}
            empty="No graves with a catch route yet."
          />
        </MetricCard>
        <MetricCard
          title="Most claimed routes"
          blurb="Owned catches (party, box, graves)."
        >
          <PlainRankList
            rows={report.mostClaimedRoutes}
            empty="No route claims yet."
          />
        </MetricCard>
      </div>
    </div>
  );
}

export function GmAnalyticsPanel({ slug }: { slug: string }) {
  const [section, setSection] = useState<GmAnalyticsSection>("pokemon");
  const [cache, setCache] = useState<CachedReports>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingSection, setLoadingSection] = useState<GmAnalyticsSection | null>(
    "pokemon",
  );
  const [direction, setDirection] = useState<RankDirection>("strongest");

  useEffect(() => {
    if (cache[section]) return;

    let cancelled = false;

    void (async () => {
      const result = await fetchGmAnalyticsAction({ slug, section });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoadingSection(null);
        return;
      }
      setCache((prev) => ({ ...prev, [result.section]: result.report }));
      setError(null);
      setLoadingSection(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, section, cache]);

  const meta = SECTION_META[section];
  const report = cache[section];
  const loading = loadingSection === section;

  function selectSection(id: GmAnalyticsSection) {
    setSection(id);
    setError(null);
    if (cache[id]) setLoadingSection(null);
    else setLoadingSection(id);
  }

  return (
    <div className="gm-analytics">
      <div className="gm-analytics__sections" role="tablist" aria-label="Analytics">
        {GM_ANALYTICS_SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={`gm-analytics__section-btn${
              section === id ? " gm-analytics__section-btn--active" : ""
            }`}
            onClick={() => selectSection(id)}
          >
            {SECTION_META[id].label}
          </button>
        ))}
      </div>

      <div className="gm-analytics__toolbar">
        <p className="gm-analytics__section-blurb">{meta.blurb}</p>
        {section === "pokemon" ? (
          <SortToggle value={direction} onChange={setDirection} />
        ) : null}
      </div>

      {loading ? (
        <p className="gm-console__hint">Loading {meta.label.toLowerCase()}…</p>
      ) : null}
      {error ? (
        <p className="gm-console__hint text-danger">{error}</p>
      ) : null}

      {!loading && !error && report ? (
        <>
          {section === "app" ? <AppSection report={report as GmAppReport} /> : null}
          {section === "trainers" ? (
            <TrainersSection report={report as GmTrainersReport} />
          ) : null}
          {section === "pokemon" ? (
            <PokemonSection
              report={report as GmPokemonReport}
              direction={direction}
            />
          ) : null}
          {section === "game" ? (
            <GameSection report={report as GmGameReport} />
          ) : null}
        </>
      ) : null}

      {section === "pokemon" ? (
        <details className="gm-analytics__disclosure">
          <summary>How typing answers are scored</summary>
          <p>
            Same bar as Team Planner: a Main has an answer when any of its
            Pokémon hits that type hard (≥2× via typing or a known damaging
            move). A threat counts when any Main Pokémon is weak to that attack
            (≥2×). Saved Main Squads only for typing meta — not planner drafts.
          </p>
        </details>
      ) : null}
    </div>
  );
}
