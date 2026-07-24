import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";

type SiteHeaderProps = {
  challengeSlug?: string;
  challengeName?: string;
  showGm?: boolean;
  myTrainerId?: string | null;
  wide?: boolean;
};

export function SiteHeader({
  challengeSlug,
  challengeName,
  showGm = false,
  myTrainerId = null,
  wide = false,
}: SiteHeaderProps) {
  return (
    <header
      className={`relative z-40 mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${
        wide ? "max-w-7xl" : "max-w-6xl"
      }`}
    >
      <div className="min-w-0">
        <Link
          href="/"
          className="site-brand font-display text-xs font-bold tracking-[0.18em] text-accent-deep uppercase"
        >
          Nuzlocke Manager
        </Link>
        {challengeName && challengeSlug ? (
          <p className="truncate text-sm text-muted">
            <Link
              href={`/challenges/${challengeSlug}`}
              className="hover:text-ink"
            >
              {challengeName}
            </Link>
          </p>
        ) : null}
      </div>
      <nav className="relative flex shrink-0 items-center gap-2 text-sm">
        <Link
          href="/challenges"
          className="pressable inline-flex h-9 items-center bg-surface px-3 font-medium"
        >
          Seasons
        </Link>
        {challengeSlug ? (
          <>
            {myTrainerId ? (
              <Link
                href={`/challenges/${challengeSlug}/me`}
                className="pressable inline-flex h-9 items-center bg-accent px-3 font-bold text-white"
              >
                My Trainer
              </Link>
            ) : null}
            {showGm ? (
              <Link
                href={`/challenges/${challengeSlug}/gm`}
                className="pressable inline-flex h-9 items-center bg-accent-2/40 px-3 font-medium"
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
