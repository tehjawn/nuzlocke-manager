"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  PersonalRouteClaim,
  PersonalRouteGroup,
  PersonalRouteStatus,
} from "@/lib/personal-routes";

type PersonalRoutesViewProps = {
  myTrainerId?: string | null;
  routeStatuses: PersonalRouteStatus[];
  slug: string;
};

export function PersonalRoutesView({
  myTrainerId = null,
  routeStatuses,
  slug,
}: PersonalRoutesViewProps) {
  const [query, setQuery] = useState("");
  const [trainerId, setTrainerId] = useState(
    () => myTrainerId ?? routeStatuses[0]?.trainerId ?? "",
  );
  const status =
    routeStatuses.find((entry) => entry.trainerId === trainerId) ??
    routeStatuses[0] ??
    null;

  if (!status) {
    return (
      <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
        No trainer boards are available yet.
      </p>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const openRoutes = filterRoutes(status.openRoutes, normalizedQuery);
  const claimedRoutes = filterGroups(status.claimedRoutes, normalizedQuery);
  const otherRoutes = filterGroups(status.otherRoutes, normalizedQuery);
  const unresolvedRoutes = filterRoutes(status.unresolvedRoutes, normalizedQuery);

  return (
    <section aria-labelledby="personal-routes-heading" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 space-y-1 text-xs font-semibold text-muted">
          Search routes
          <input
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            data-testid="open-routes-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Route name…"
            type="search"
            value={query}
          />
        </label>
        <label className="min-w-[11rem] space-y-1 text-xs font-semibold text-muted">
          Trainer
          <select
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            data-testid="open-routes-trainer"
            onChange={(event) => setTrainerId(event.target.value)}
            value={status.trainerId}
          >
            {routeStatuses.map((entry) => (
              <option key={entry.trainerId} value={entry.trainerId}>
                {entry.trainerHandle}
                {entry.trainerId === myTrainerId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <h3 className="font-display text-lg font-bold" id="personal-routes-heading">
          {status.trainerHandle}&apos;s catch routes
        </h3>
        <p className="text-xs text-muted">
          <span className="font-semibold text-accent-deep">
            {status.openRoutes.length} open
          </span>
          {" · "}
          {status.claimedRoutes.length} claimed of {status.catalogSize} catalog
          locations
          {status.unresolvedRoutes.length > 0 && (
            <>
              {" · "}
              {status.unresolvedRoutes.length} need save re-import
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <RouteChecklist
          empty={
            normalizedQuery
              ? `No open routes match “${query.trim()}”.`
              : "No open routes — every catalog location is claimed."
          }
          routes={openRoutes}
          title={`Open · ${openRoutes.length}`}
        />

        <ClaimedRoutes
          empty={
            normalizedQuery
              ? `No claimed routes match “${query.trim()}”.`
              : "No catalog routes claimed yet — every catalog route is open."
          }
          groups={claimedRoutes}
          slug={slug}
          title={`Claimed · ${claimedRoutes.length}`}
          trainerId={status.trainerId}
        />
      </div>

      {status.unresolvedRoutes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Modern Emerald stores Safari-area claims separately from each
            Pokémon&apos;s generic Safari met location. Import a current save to
            synchronize these areas.
          </p>
          <RouteChecklist
            empty={`No Safari routes need resync matching “${query.trim()}”.`}
            routes={unresolvedRoutes}
            title={`Needs save re-import · ${unresolvedRoutes.length}`}
          />
        </div>
      )}

      {status.otherRoutes.length > 0 && (
        <ClaimedRoutes
          empty={`No other logged locations match “${query.trim()}”.`}
          groups={otherRoutes}
          slug={slug}
          title={`Other logged locations · ${otherRoutes.length}`}
          trainerId={status.trainerId}
        />
      )}
    </section>
  );
}

function RouteChecklist({
  empty,
  routes,
  title,
}: {
  empty: string;
  routes: string[];
  title: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold tracking-wide text-muted uppercase">
        {title}
      </h4>
      {routes.length > 0 ? (
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {routes.map((route) => (
            <li
              className="flex items-center gap-2 rounded-md border border-frame/35 bg-surface/55 px-2.5 py-2 text-xs font-semibold text-ink"
              key={route}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-interactive/70 bg-interactive-soft"
              />
              <span className="min-w-0 truncate">{route}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyRoutes message={empty} />
      )}
    </div>
  );
}

function ClaimedRoutes({
  empty,
  groups,
  slug,
  title,
  trainerId,
}: {
  empty: string;
  groups: PersonalRouteGroup[];
  slug: string;
  title: string;
  trainerId: string;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold tracking-wide text-muted uppercase">
        {title}
      </h4>
      {groups.length > 0 ? (
        <ul className="space-y-1.5">
          {groups.map((group) => (
            <li
              className="rounded-md border border-frame/35 bg-surface/55 px-2.5 py-2"
              key={group.route}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ink">{group.route}</span>
                <span className="text-[10px] tabular-nums text-muted">
                  {group.source === "encounter-flag"
                    ? "Game encounter flag"
                    : group.claims.length}
                </span>
              </div>
              {group.claims.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {group.claims.map((claim) => (
                    <ClaimChip
                      claim={claim}
                      key={claim.pokemonId}
                      slug={slug}
                      trainerId={trainerId}
                    />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyRoutes message={empty} />
      )}
    </div>
  );
}

function ClaimChip({
  claim,
  slug,
  trainerId,
}: {
  claim: PersonalRouteClaim;
  slug: string;
  trainerId: string;
}) {
  const nickname = claim.nickname?.trim();
  const label = nickname ? `${nickname} (${claim.species})` : claim.species;

  return (
    <li>
      <Link
        className="pressable inline-flex items-center gap-1 rounded-full border border-frame/40 bg-surface px-2 py-1 text-[10px] font-semibold text-ink hover:border-interactive/40 hover:bg-interactive-soft/40"
        href={`/challenges/${slug}/trainers/${trainerId}?pokemon=${encodeURIComponent(claim.pokemonId)}`}
        title={`Open ${label} on the trainer board`}
      >
        <span className="max-w-[12rem] truncate">{label}</span>
        <span className="text-muted">· {slotLabel(claim.slot)}</span>
      </Link>
    </li>
  );
}

function EmptyRoutes({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-frame/35 bg-surface/45 px-3 py-4 text-sm text-muted">
      {message}
    </p>
  );
}

function filterGroups(
  groups: PersonalRouteGroup[],
  query: string,
): PersonalRouteGroup[] {
  if (!query) return groups;
  return groups.filter((group) => group.route.toLowerCase().includes(query));
}

function filterRoutes(routes: string[], query: string): string[] {
  if (!query) return routes;
  return routes.filter((route) => route.toLowerCase().includes(query));
}

function slotLabel(slot: PersonalRouteClaim["slot"]): string {
  switch (slot) {
    case "MAIN":
      return "Main";
    case "RESERVE":
      return "Reserve";
    case "GRAVEYARD":
      return "RIP";
    case "ENCOUNTERED":
      return "Encountered";
    default:
      return slot;
  }
}
