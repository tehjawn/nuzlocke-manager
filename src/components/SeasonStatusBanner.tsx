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
      <div className="rounded-xl border border-frame bg-rip px-3 py-3 text-sm sm:px-4">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Season archived
        </p>
        <p className="mt-1 text-muted">
          Boards are read-only. Visit the memorial for the full R.I.P. record.
        </p>
        <Link
          href={`/challenges/${slug}/memorial`}
          className="pressable mt-3 inline-block rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
        >
          Open memorial
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-frame bg-surface-2 px-3 py-3 text-sm sm:px-4">
      <p className="text-xs font-semibold tracking-tight text-accent-deep">
        {seasonStatusLabel(status)}
      </p>
      <p className="mt-1 text-muted">
        Main Squads are locked for the ladder. Check the tournament board.
      </p>
      <Link
        href={`/challenges/${slug}/tournament`}
        className="pressable mt-3 inline-block rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
      >
        Open tournament
      </Link>
    </div>
  );
}
