import Link from "next/link";

type SiteHeaderProps = {
  challengeSlug?: string;
  challengeName?: string;
};

export function SiteHeader({ challengeSlug, challengeName }: SiteHeaderProps) {
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
            <Link
              href={`/challenges/${challengeSlug}/rules`}
              className="pressable hidden rounded-sm bg-surface px-3 py-1.5 font-medium sm:inline-block"
            >
              Rules
            </Link>
            <Link
              href={`/challenges/${challengeSlug}/faq`}
              className="pressable hidden rounded-sm bg-surface px-3 py-1.5 font-medium sm:inline-block"
            >
              FAQ
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
