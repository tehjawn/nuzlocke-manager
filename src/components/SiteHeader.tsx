import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";

/** Shared shell width for the site header on every page. */
export const SITE_HEADER_MAX_CLASS = "max-w-7xl";

type SiteHeaderProps = {
  challengeSlug?: string;
  challengeYear?: number;
  showGm?: boolean;
  myTrainerId?: string | null;
};

export function SiteHeader({
  challengeSlug,
  challengeYear,
  showGm = false,
  myTrainerId = null,
}: SiteHeaderProps) {
  return (
    <header
      className={`relative z-40 mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${SITE_HEADER_MAX_CLASS}`}
    >
      <div className="min-w-0">
        <Link
          href="/"
          className="site-brand text-base font-bold tracking-tight sm:text-lg"
        >
          Nuzlocke Manager
        </Link>
        {challengeYear != null && challengeSlug ? (
          <p className="truncate text-sm text-muted">
            <Link
              href={`/challenges/${challengeSlug}`}
              className="hover:text-ink"
            >
              Season {challengeYear} League
            </Link>
          </p>
        ) : null}
      </div>
      <nav className="relative flex shrink-0 items-center gap-2 text-sm">
        <Link
          href="/challenges"
          className="pressable inline-flex h-9 items-center border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
        >
          Seasons
        </Link>
        <Link
          href="/about"
          className="pressable inline-flex h-9 items-center border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
        >
          About
        </Link>
        {challengeSlug ? (
          <>
            {myTrainerId ? (
              <Link
                href={`/challenges/${challengeSlug}/me`}
                className="pressable inline-flex h-9 items-center border-accent/30 bg-accent px-3.5 font-semibold text-[var(--on-accent)]"
              >
                My Trainer
              </Link>
            ) : null}
            {showGm ? (
              <Link
                href={`/challenges/${challengeSlug}/gm`}
                className="pressable inline-flex h-9 items-center bg-accent-2/25 px-3.5 font-medium"
              >
                GM
              </Link>
            ) : null}
          </>
        ) : null}
        <AuthButtons hideMyTrainer={Boolean(myTrainerId)} />
      </nav>
    </header>
  );
}
