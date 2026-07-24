import Link from "next/link";
import type { ChallengeStatus } from "@/lib/challenge-types";
import { seasonStatusLabel } from "@/lib/season-status";

type SeasonStatusBannerProps = {
  slug: string;
  status: ChallengeStatus;
};

export function SeasonStatusBanner({ slug, status }: SeasonStatusBannerProps) {
  if (status === "ACTIVE" || status === "DRAFT") return null;

  if (status === "ARCHIVED") {
    return (
      <div className="rounded-sm border-2 border-frame bg-rip px-3 py-3 text-sm sm:px-4">
        <p className="font-display text-xs font-bold tracking-[0.16em] text-accent-deep uppercase">
          Season archived
        </p>
        <p className="mt-1 text-muted">
          Boards are read-only. Visit the memorial for the full R.I.P. record.
        </p>
        <Link
          href={`/challenges/${slug}/memorial`}
          className="pressable mt-3 inline-block rounded-sm bg-accent px-3 py-1.5 text-xs font-bold text-white uppercase"
        >
          Open memorial
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-sm border-2 border-frame bg-surface-2 px-3 py-3 text-sm sm:px-4">
      <p className="font-display text-xs font-bold tracking-[0.16em] text-accent-deep uppercase">
        {seasonStatusLabel(status)}
      </p>
      <p className="mt-1 text-muted">
        Main Squads are locked for the ladder. Check the tournament board.
      </p>
      <Link
        href={`/challenges/${slug}/tournament`}
        className="pressable mt-3 inline-block rounded-sm bg-accent px-3 py-1.5 text-xs font-bold text-white uppercase"
      >
        Open tournament
      </Link>
    </div>
  );
}
