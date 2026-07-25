import Link from "next/link";
import type { Metadata } from "next";
import { Frame } from "@/components/Frame";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import type { Challenge } from "@/lib/challenge-types";
import { listChallenges } from "@/lib/challenges";
import { CTA_PRIMARY } from "@/lib/cta";
import {
  isSeasonArchived,
  isSeasonLive,
  seasonStatusChipClass,
  seasonStatusLabel,
} from "@/lib/season-status";

export const metadata: Metadata = {
  title: "Seasons",
};

export default async function ChallengesPage() {
  const challenges = await listChallenges();
  const live = challenges.filter((c) => isSeasonLive(c.status));
  const archived = challenges.filter((c) => isSeasonArchived(c.status));

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main
        className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <h1 className="text-3xl font-bold tracking-tight">Seasons</h1>
        <p className="mt-2 text-muted">
          Annual Nuzlocke challenges. Active seasons first; archives forever.
        </p>

        <SeasonGroup title="This year" seasons={live} empty="No live seasons yet." />
        <SeasonGroup
          title="Archives"
          seasons={archived}
          empty="No archived seasons yet — when a year closes, it lands here."
          className="mt-10"
        />
      </main>
    </div>
  );
}

function SeasonGroup({
  title,
  seasons,
  empty,
  className,
}: {
  title: string;
  seasons: Challenge[];
  empty: string;
  className?: string;
}) {
  return (
    <section className={className ?? "mt-8"}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {title}
      </h2>
      {seasons.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {seasons.map((c) => (
            <li key={c.slug}>
              <SeasonCard challenge={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SeasonCard({ challenge: c }: { challenge: Challenge }) {
  const archived = isSeasonArchived(c.status);
  const href = archived
    ? `/challenges/${c.slug}/memorial`
    : `/challenges/${c.slug}`;
  const cta = archived ? "Open memorial →" : "Enter league board";

  return (
    <Frame>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold tracking-tight">{c.name}</h3>
        <span
          className={`rounded-lg px-2 py-0.5 text-xs font-semibold tracking-tight ${seasonStatusChipClass(c.status)}`}
        >
          {seasonStatusLabel(c.status)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {c.year} · {c.game}
        {c.visibility === "INVITE" ? " · Invite only" : null}
      </p>
      <p className="mt-3 text-sm leading-relaxed">{c.description}</p>
      <Link
        href={href}
        className={`${CTA_PRIMARY} mt-4`}
      >
        {cta}
      </Link>
    </Frame>
  );
}
