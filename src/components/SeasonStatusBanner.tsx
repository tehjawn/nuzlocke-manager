import Link from "next/link";
import type { ChallengeStatus } from "@/lib/challenge-types";
import { CTA_PRIMARY_SM } from "@/lib/cta";
import { seasonStatusLabel } from "@/lib/season-status";
import { seasonStatsHref } from "@/lib/tools-routes";

type SeasonStatusBannerProps = {
  slug: string;
  status: ChallengeStatus;
  /** When true, emphasize GM ladder tooling in the copy. */
  isGm?: boolean;
};

export function SeasonStatusBanner({
  slug,
  status,
  isGm = false,
}: SeasonStatusBannerProps) {
  if (status === "ACTIVE" || status === "DRAFT") return null;

  if (status === "ARCHIVED") {
    return (
      <div className="rounded-lg border border-frame bg-rip px-3 py-3 text-sm sm:px-4">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Season archived
        </p>
        <p className="mt-1 text-muted">
          Boards are read-only. Visit Season Stats for the full R.I.P. record.
        </p>
        <Link href={seasonStatsHref(slug)} className={`${CTA_PRIMARY_SM} mt-3`}>
          Open Season Stats
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-frame bg-surface-2 px-3 py-3 text-sm sm:px-4">
      <p className="text-xs font-semibold tracking-tight text-accent-deep">
        {seasonStatusLabel(status)}
      </p>
      <p className="mt-1 text-muted">
        Main Squads are locked for the ladder.
        {isGm
          ? " Manage brackets from Tournaments."
          : " Watch the arena as matches land."}
      </p>
      <Link
        href={`/challenges/${slug}/tournaments`}
        className={`${CTA_PRIMARY_SM} mt-3`}
      >
        Open tournaments
      </Link>
    </div>
  );
}
