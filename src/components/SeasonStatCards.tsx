"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type {
  EncounterRouteHighlight,
  EncounterSpeciesHighlight,
} from "@/lib/encounter-stats";

/**
 * Counter-block + callout-card primitives shared by season-wide stat
 * surfaces (Season Stats tool). Extracted from
 * EncounterSeasonView so the pattern stays one implementation.
 */

export const seasonCalloutCardClass =
  "rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5";

export const seasonCalloutLinkClass = `${seasonCalloutCardClass} pressable transition-colors hover:border-interactive/40 hover:bg-interactive-soft/25`;

export function StatBlock({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className={seasonCalloutCardClass}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-bold leading-snug text-muted">
          {label}
        </p>
        <span className="shrink-0 text-accent-deep/80" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-muted/80">{hint}</p>
    </div>
  );
}

export function SpeciesTopCallout({
  entries,
  href,
  hrefLabel = "View all →",
  label,
  showCount = false,
}: {
  entries: EncounterSpeciesHighlight[];
  href?: string;
  hrefLabel?: string;
  label: string;
  showCount?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
          {label}
        </p>
        {href && (
          <span className="text-[10px] font-semibold text-interactive">
            {hrefLabel}
          </span>
        )}
      </div>
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
            <span className="min-w-0 truncate font-display text-sm font-bold leading-none">
              {entry.species}
              {showCount && (
                <span className="font-sans font-normal text-muted">
                  {" · x"}
                  {entry.count}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );

  if (href) {
    // No aria-label: the accessible name comes from the card content, which
    // already carries the label, entries, and the visible hrefLabel text.
    return (
      <Link className={seasonCalloutLinkClass} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={seasonCalloutCardClass}>{content}</div>;
}

export function RouteTopCallout({
  entries,
  href,
  hrefLabel = "View all →",
  label,
}: {
  entries: EncounterRouteHighlight[];
  href?: string;
  hrefLabel?: string;
  label: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
          {label}
        </p>
        {href && (
          <span className="text-[10px] font-semibold text-interactive">
            {hrefLabel}
          </span>
        )}
      </div>
      <ol className="mt-2 space-y-1">
        {entries.map((entry, index) => (
          <li key={entry.route} className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface/80 text-sm font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="min-w-0 truncate font-display text-sm font-bold leading-none">
              {entry.route}
              <span className="font-sans font-normal text-muted">
                {" · "}
                {entry.graveCount} fallen
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );

  if (href) {
    return (
      <Link className={seasonCalloutLinkClass} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={seasonCalloutCardClass}>{content}</div>;
}

export function PokeballStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

export function SpeciesStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="8" cy="9" r="2.5" />
      <circle cx="16" cy="9" r="2.5" />
      <circle cx="12" cy="15.5" r="2.5" />
    </svg>
  );
}

export function DexStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <circle cx="12" cy="11" r="3" />
      <path d="M9.5 17h5" strokeLinecap="round" />
    </svg>
  );
}

export function RouteStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M6 18c2-4 3-6 3-9a3 3 0 016 0c0 3 1 5 3 9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
