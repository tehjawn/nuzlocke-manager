import Image from "next/image";
import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";
import { MobileMenuAuth } from "@/components/MobileMenuAuth";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { AboutIcon, MyTrainerIcon } from "@/components/nav-icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { JumpTrigger } from "@/features/jump";

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
          className="site-brand flex min-w-0 items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg"
        >
          <Image
            src="/nuzlocke-mark.png"
            alt="Nuzlocke Manager"
            width={36}
            height={36}
            className="size-8 shrink-0 rounded-md sm:size-9"
            priority
          />
          {/* Wordmark is redundant next to the logo on phones — hide it there. */}
          <span className="hidden min-w-0 truncate sm:inline">
            Nuzlocke Manager
          </span>
        </Link>
        {challengeYear != null && challengeSlug ? (
          <p className="hidden truncate text-sm text-muted sm:block">
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
        <JumpTrigger />
        {/* Inline pills at sm+; below that they collapse into the drawer. */}
        <div className="hidden items-center gap-2 sm:flex">
          {/* TEMP: Seasons index + SeasonsIcon hidden while only one season exists
          <Link
            href="/challenges"
            className="pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
          >
            <SeasonsIcon className="h-4 w-4 text-ink/70" />
            Seasons
          </Link>
          */}
          <Link
            href="/about"
            className="pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
          >
            <AboutIcon className="h-4 w-4 text-ink/70" />
            About
          </Link>
          {challengeSlug && myTrainerId ? (
            <Link
              href={`/challenges/${challengeSlug}/me`}
              className="pressable inline-flex h-9 items-center gap-2 border-accent/30 bg-accent px-3.5 font-semibold text-[var(--on-accent)]"
            >
              <MyTrainerIcon className="h-4 w-4" />
              My Trainer
            </Link>
          ) : null}
        </div>
        <AuthButtons
          hideMyTrainer={Boolean(myTrainerId)}
          gmHref={
            showGm && challengeSlug
              ? `/challenges/${challengeSlug}/gm`
              : null
          }
        />
        {/* Theme lives inline on desktop; on mobile it moves into the drawer. */}
        <span className="hidden sm:inline-flex">
          <ThemeToggle />
        </span>
        <MobileNavDrawer
          className="sm:hidden"
          challengeSlug={challengeSlug}
          showGm={showGm}
          myTrainerId={myTrainerId}
        >
          <MobileMenuAuth />
        </MobileNavDrawer>
      </nav>
    </header>
  );
}
