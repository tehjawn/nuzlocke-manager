import Link from "next/link";
import type { ChallengeStatus } from "@/lib/challenge-types";
import { CTA_PRIMARY_SM } from "@/lib/cta";
import { seasonStatusLabel } from "@/lib/season-status";

type SeasonStatusBannerProps = {
  slug: string;
  status: ChallengeStatus;
  /** Temporary WIP gate (#240): tournament CTA is GM-only. */
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
        <Link
          href={`/challenges/${slug}/memorial`}
          className={`${CTA_PRIMARY_SM} mt-3`}
        >
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
        {isGm ? " Check the tournament board." : null}
      </p>
      {isGm ? (
        <Link
          href={`/challenges/${slug}/tournament`}
          className={`${CTA_PRIMARY_SM} mt-3`}
        >
          Open tournament
        </Link>
      ) : null}
    </div>
  );
}
