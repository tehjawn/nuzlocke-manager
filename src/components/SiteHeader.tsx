import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";

type SiteHeaderProps = {
  challengeSlug?: string;
  challengeName?: string;
  showGm?: boolean;
  myTrainerId?: string | null;
};

export function SiteHeader({
  challengeSlug,
  challengeName,
  showGm = false,
  myTrainerId = null,
}: SiteHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <Link
          href="/"
          className="font-display text-xs font-bold tracking-[0.18em] text-accent-deep uppercase"
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
      <nav className="flex shrink-0 items-center gap-2 text-sm">
        <Link
          href="/challenges"
          className="pressable rounded-sm bg-surface px-3 py-1.5 font-medium"
        >
          Seasons
        </Link>
        {challengeSlug ? (
          <>
            {myTrainerId ? (
              <Link
                href={`/challenges/${challengeSlug}/me`}
                className="pressable rounded-sm bg-accent px-3 py-1.5 font-bold text-white"
              >
                My board
              </Link>
            ) : null}
            {showGm ? (
              <Link
                href={`/challenges/${challengeSlug}/gm`}
                className="pressable rounded-sm bg-accent-2/40 px-3 py-1.5 font-medium"
              >
                GM
              </Link>
            ) : null}
          </>
        ) : null}
        <AuthButtons hideMyBoard={Boolean(myTrainerId)} />
      </nav>
    </header>
  );
}
