"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  DexStatIcon,
  PokeballStatIcon,
  RouteTopCallout,
  seasonCalloutCardClass,
  seasonCalloutLinkClass,
  SpeciesStatIcon,
  SpeciesTopCallout,
  StatBlock,
} from "@/components/SeasonStatCards";
import type { TrainerProfile } from "@/lib/challenge-types";
import {
  encounterSeasonHighlights,
  exclusiveOwnedSpecies,
} from "@/lib/encounter-stats";
import { formatPokedollars } from "@/lib/gen3-save/money";
import {
  type MemorialSpeciesHighlight,
  type MemorialTrainerStanding,
} from "@/lib/memorial-stats";
import {
  badgeStandings,
  moneyStandings,
  type SeasonStandingRow,
  type SeasonStatsData,
} from "@/lib/season-stats";
import {
  parseStatsSection,
  statsSectionId,
  toolsHref,
  type StatsSection,
} from "@/lib/tools-routes";
import { displayName } from "@/lib/trainer-display";

type SeasonStatsViewProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  /** Server-computed extras (cross-run graves + unredacted IV aggregates). */
  seasonStats?: SeasonStatsData | null;
  /** Grave browser under Graves & wipes. */
  memorialBrowser: ReactNode;
};

const sectionLinkClass =
  "text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive";

export function SeasonStatsView({
  slug,
  trainers,
  myTrainerId = null,
  seasonStats = null,
  memorialBrowser,
}: SeasonStatsViewProps) {
  const searchParams = useSearchParams();
  const section = parseStatsSection(searchParams.get("section"));

  // Deep links land here via `?section=` (see StatsSection in tools-routes):
  // a hash would be consumed against the loading skeleton before these
  // sections exist. This runs once the real content is mounted.
  useEffect(() => {
    if (!section) return;
    document.getElementById(statsSectionId(section))?.scrollIntoView();
  }, [section]);

  const encounter = encounterSeasonHighlights(trainers);
  const exclusives = exclusiveOwnedSpecies(trainers);
  const badges = badgeStandings(trainers);
  const money = moneyStandings(trainers);
  const totalWipes = trainers.reduce(
    (sum, trainer) => sum + (trainer.wipeCount ?? 0),
    0,
  );
  const trainersById = new Map(
    trainers.map((trainer) => [trainer.id, trainer]),
  );

  const memorial = seasonStats?.memorial ?? null;
  const godCatches = seasonStats?.godCatches ?? null;
  const shinies = seasonStats?.shinies ?? null;
  const badgesTotal = seasonStats?.badgesTotal ?? 0;

  const mePct =
    encounter.meDexTotal > 0
      ? Math.round((encounter.meDexLogged / encounter.meDexTotal) * 100)
      : 0;

  function standingRows<T extends SeasonStandingRow>(
    rows: T[],
    valueLabel: (row: T) => string,
    flairFor?: (row: T) => ReactNode,
  ): StandingsRowDisplay[] {
    return rows.map((row) => {
      const trainer = trainersById.get(row.trainerId) ?? null;
      return {
        key: row.trainerId,
        rank: row.rank,
        trainer,
        label: trainer ? displayName(trainer) : "Unknown trainer",
        flair: flairFor?.(row),
        value: valueLabel(row),
        highlight: row.trainerId === myTrainerId,
      };
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBlock
          icon={<CrownStatIcon />}
          value={godCatches ? String(godCatches.total) : "—"}
          label="God catches"
          hint="3+ IVs at 28 or better"
        />
        <StatBlock
          icon={<SparkleStatIcon />}
          value={shinies ? String(shinies.total) : "—"}
          label="Shinies caught"
          hint="Party, box & graves"
        />
        <StatBlock
          icon={<WipeStatIcon />}
          value={String(totalWipes)}
          label="Party wipes"
          hint="Runs restarted across the pack"
        />
        <StatBlock
          icon={<GraveStatIcon />}
          value={memorial ? String(memorial.totalGraves) : "—"}
          label="Memorialized"
          hint="Losses across every run"
        />
        <StatBlock
          icon={<PokeballStatIcon />}
          value={String(encounter.totalLogged)}
          label="Pokémon on boards"
          hint="Party, box, graves & seen"
        />
        <StatBlock
          icon={<SpeciesStatIcon />}
          value={String(encounter.uniqueSpecies)}
          label="Species seen"
          hint="Distinct across the pack"
        />
        <StatBlock
          icon={<DexStatIcon />}
          value={`${mePct}%`}
          label="Modern Emerald dex"
          hint={`${encounter.meDexLogged} of ${encounter.meDexTotal} logged`}
        />
        <StatBlock
          icon={<BadgeStatIcon />}
          value={
            badgesTotal > 0 && badges.length > 0
              ? `${badges[0]!.value}/${badgesTotal}`
              : "—"
          }
          label="Badge race leader"
          hint="Best badge case in the pack"
        />
      </div>

      <StatsSection section="standings" title="Full standings">
        <div className="grid gap-2 sm:grid-cols-2">
          <StandingsCard
            title="Badge race"
            rows={standingRows(
              badges,
              (row) =>
                badgesTotal > 0
                  ? `${row.value}/${badgesTotal}`
                  : String(row.value),
              (row) =>
                row.champion ? (
                  <span className="text-[11px] font-semibold text-accent-2-ink">
                    ★ Champion
                  </span>
                ) : null,
            )}
            emptyText="No trainers yet."
          />
          <StandingsCard
            title="Richest"
            rows={standingRows(money.rows, (row) =>
              formatPokedollars(row.value),
            )}
            emptyText="No wallets imported yet."
            footer={
              money.unreportedCount > 0 ? (
                <p className="mt-2 text-[10px] leading-snug text-muted/80">
                  {money.unreportedCount} trainer
                  {money.unreportedCount === 1 ? " hasn't" : "s haven't"}{" "}
                  imported a save yet.
                </p>
              ) : null
            }
          />
        </div>
      </StatsSection>

      <StatsSection section="quality" title="Catch quality">
        <div className="grid gap-2 sm:grid-cols-2">
          <StandingsCard
            title="God-tier catches"
            hint="3+ IVs at 28 or better — the wild-catch jackpot."
            rows={standingRows(godCatches?.rows ?? [], (row) =>
              String(row.value),
            )}
            emptyText={
              godCatches
                ? "No god-tier catches yet — 3 IVs at 28+ earns a spot."
                : "Season IV data unavailable."
            }
          />
          <StandingsCard
            title="Shiny case"
            rows={standingRows(shinies?.rows ?? [], (row) => String(row.value))}
            emptyText={
              shinies
                ? "No shinies yet — the odds are the odds."
                : "Season data unavailable."
            }
            footer={
              shinies && shinies.catches.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {shinies.catches.map((entry) => (
                    <span
                      key={entry.key}
                      className="relative inline-block h-10 w-10"
                      title={`${entry.nickname ?? entry.species} · ${entry.trainerLabel}${entry.fallen ? " · RIP" : ""}`}
                    >
                      <PokemonSpriteImage
                        alt={entry.nickname ?? entry.species}
                        className="pixelated h-full w-full object-contain"
                        height={40}
                        pokedexId={entry.pokedexId}
                        shiny
                        species={entry.species}
                        width={40}
                      />
                      {entry.fallen && (
                        <span
                          aria-hidden
                          className="absolute -right-1 -bottom-1 text-[10px]"
                        >
                          🪦
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : null
            }
          />
        </div>
      </StatsSection>

      <StatsSection
        section="species"
        title="Species"
        action={
          <Link
            className={sectionLinkClass}
            href={toolsHref(slug, "bounty", { status: "untouched" })}
          >
            Open Pokémon Ownership →
          </Link>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {encounter.mostLogged.length > 0 ? (
            <SpeciesTopCallout
              label="Most logged"
              entries={encounter.mostLogged}
              showCount
            />
          ) : (
            <EmptyCallout label="Most logged" text="Nothing logged yet." />
          )}
          {encounter.rarestSeen.length > 0 ? (
            <SpeciesTopCallout
              entries={encounter.rarestSeen}
              href={`/challenges/${slug}/encounters/rarest`}
              label="Rarest seen"
            />
          ) : (
            <EmptyCallout label="Rarest seen" text="Nothing logged yet." />
          )}
          <Link
            aria-label="View exclusive species in Pokémon Ownership"
            className={seasonCalloutLinkClass}
            href={toolsHref(slug, "bounty", { mode: "exclusives" })}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Exclusive species
              </p>
              <span className="text-[10px] font-semibold text-interactive">
                View all →
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums leading-none tracking-tight">
              {exclusives.length}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-muted/80">
              Owned by exactly one trainer
            </p>
            {exclusives.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {exclusives.slice(0, 8).map((entry) => (
                  <span
                    key={entry.pokedexId}
                    className="relative inline-block h-8 w-8"
                    title={`${entry.species} · ${entry.trainerHandle}`}
                  >
                    <PokemonSpriteImage
                      alt=""
                      className="pixelated h-full w-full object-contain"
                      height={32}
                      pokedexId={entry.pokedexId}
                      species={entry.species}
                      width={32}
                    />
                  </span>
                ))}
                {exclusives.length > 8 && (
                  <span className="text-[10px] font-semibold text-muted">
                    +{exclusives.length - 8}
                  </span>
                )}
              </div>
            )}
          </Link>
        </div>
      </StatsSection>

      {memorial && (
        <StatsSection section="memorial" title="Graves & wipes">
          {(memorial.heaviestMemorial.length > 0 ||
            memorial.mostPartyWipes.length > 0 ||
            memorial.mostDeathProne.length > 0 ||
            encounter.deadliestRoutes.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {memorial.heaviestMemorial.length > 0 && (
                <TrainerTopCallout
                  label="Heaviest memorial"
                  entries={memorial.heaviestMemorial}
                  valueLabel={(count) => `${count} RIP`}
                  trainersById={trainersById}
                />
              )}
              {memorial.mostPartyWipes.length > 0 && (
                <TrainerTopCallout
                  label="Most party wipes"
                  entries={memorial.mostPartyWipes}
                  valueLabel={(count) =>
                    `${count} wipe${count === 1 ? "" : "s"}`
                  }
                  trainersById={trainersById}
                />
              )}
              {memorial.mostDeathProne.length > 0 && (
                <DeathProneTopCallout entries={memorial.mostDeathProne} />
              )}
              {encounter.deadliestRoutes.length > 0 && (
                <RouteTopCallout
                  label="Deadliest routes"
                  entries={encounter.deadliestRoutes}
                />
              )}
            </div>
          )}
          <div className="pt-2">{memorialBrowser}</div>
        </StatsSection>
      )}
    </div>
  );
}

function StatsSection({
  section,
  title,
  action,
  children,
}: {
  section: StatsSection;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={statsSectionId(section)} className="scroll-mt-24 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

type StandingsRowDisplay = {
  key: string;
  rank: number;
  trainer: TrainerProfile | null;
  label: string;
  flair?: ReactNode;
  value: string;
  highlight?: boolean;
};

function StandingsCard({
  title,
  hint,
  rows,
  emptyText,
  footer,
}: {
  title: string;
  hint?: string;
  rows: StandingsRowDisplay[];
  emptyText: string;
  footer?: ReactNode;
}) {
  return (
    <div className={seasonCalloutCardClass}>
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {title}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] leading-snug text-muted/80">{hint}</p>
      )}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className={`flex items-center gap-2 ${
                row.highlight
                  ? "-mx-1 rounded-md bg-interactive-soft/30 px-1 py-0.5"
                  : ""
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface/80 text-sm font-bold tabular-nums text-muted">
                {row.rank}
              </span>
              {row.trainer && (
                <AvatarPortrait
                  avatarSpriteKey={row.trainer.avatarSpriteKey}
                  backgroundKey={row.trainer.avatarBackgroundKey}
                  sizeClass="h-9 w-9"
                  width={36}
                  height={36}
                  alt=""
                />
              )}
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold leading-none">
                {row.label}
                {row.flair && (
                  <span className="font-sans font-normal"> {row.flair}</span>
                )}
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {row.value}
              </span>
            </li>
          ))}
        </ol>
      )}
      {footer ?? null}
    </div>
  );
}

function TrainerTopCallout({
  label,
  entries,
  valueLabel,
  trainersById,
}: {
  label: string;
  entries: MemorialTrainerStanding[];
  valueLabel: (count: number) => string;
  trainersById: Map<string, TrainerProfile>;
}) {
  return (
    <div className={seasonCalloutCardClass}>
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
      </p>
      <ol className="mt-2 space-y-1">
        {entries.map((entry, index) => {
          const trainer = trainersById.get(entry.trainerId) ?? null;
          return (
            <li key={entry.trainerId} className="flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface/80 text-sm font-bold tabular-nums text-muted">
                {index + 1}
              </span>
              {trainer && (
                <AvatarPortrait
                  avatarSpriteKey={trainer.avatarSpriteKey}
                  backgroundKey={trainer.avatarBackgroundKey}
                  sizeClass="h-10 w-10"
                  width={40}
                  height={40}
                  alt=""
                />
              )}
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold leading-none">
                {entry.label}
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {valueLabel(entry.count)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DeathProneTopCallout({
  entries,
}: {
  entries: MemorialSpeciesHighlight[];
}) {
  return (
    <div className={seasonCalloutCardClass}>
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        Most death-prone Pokémon
      </p>
      <ol className="mt-2 space-y-1">
        {entries.map((entry, index) => (
          <li
            key={`${entry.species}-${entry.pokedexId ?? "x"}`}
            className="flex items-center gap-2"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface/80 text-sm font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="relative inline-block h-10 w-10 shrink-0">
              <PokemonSpriteImage
                alt=""
                className="pixelated h-full w-full object-contain"
                height={40}
                pokedexId={entry.pokedexId}
                species={entry.species}
                width={40}
              />
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-sm font-bold leading-none">
              {entry.species}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {entry.count} RIP
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyCallout({ label, text }: { label: string; text: string }) {
  return (
    <div className={seasonCalloutCardClass}>
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

function CrownStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M4.75 16 4 8.75l4.35 2.9L12 6.25l3.65 5.4L20 8.75 19.25 16z"
        strokeLinejoin="round"
      />
      <path d="M6.5 19h11" strokeLinecap="round" />
    </svg>
  );
}

function SparkleStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M12 4.5l1.6 5.9 5.9 1.6-5.9 1.6-1.6 5.9-1.6-5.9L4.5 12l5.9-1.6z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WipeStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M19.5 12a7.5 7.5 0 11-2.2-5.3M17.5 3.5v3.4h-3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GraveStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M7 19v-8.5a5 5 0 0110 0V19" strokeLinejoin="round" />
      <path d="M5.5 19.5h13" strokeLinecap="round" />
      <path d="M12 9.75v4M10.25 11.25h3.5" strokeLinecap="round" />
    </svg>
  );
}

function BadgeStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="12" cy="10" r="5.25" />
      <path
        d="M9.5 14.5 8 20l4-2 4 2-1.5-5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
