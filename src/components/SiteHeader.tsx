import Image from "next/image";
import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Shared shell width for the site header and page content on every page. */
export const SITE_SHELL_MAX_CLASS = "max-w-7xl";

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
      className={`relative z-40 mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
    >
      <div className="min-w-0">
        <Link
          href="/"
          className="site-brand inline-flex items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg"
        >
          <Image
            src="/nuzlocke-mark.png"
            alt=""
            width={36}
            height={36}
            className="size-8 shrink-0 rounded-md sm:size-9"
            priority
          />
          <span className="min-w-0 truncate">Nuzlocke Manager</span>
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
        {/* Inline pills at sm+; below that they collapse into the drawer. */}
        <div className="hidden items-center gap-2 sm:flex">
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
        </div>
        <MobileNavDrawer
          className="sm:hidden"
          challengeSlug={challengeSlug}
          showGm={showGm}
          myTrainerId={myTrainerId}
        />
        <AuthButtons hideMyTrainer={Boolean(myTrainerId)} />
        <ThemeToggle />
      </nav>
    </header>
  );
}
