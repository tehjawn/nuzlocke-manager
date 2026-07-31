import Link from "next/link";
import { SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/features/fx";

const ORGANIZER_URL = "https://ouboridesigns.carrd.co/";
const MAINTAINER_URL = "https://www.jawn.codes/";
const ROM_AUTHOR_URL = "https://github.com/chethtrayen/nzl_modern";

const creditLinkClass =
  "font-medium text-ink underline-offset-2 hover:text-accent-deep hover:underline";

/** Global secondary chrome: About, credit, sound, theme. Auth + Jump stay in the header. */
export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <Link
            href="/about"
            className="font-medium text-ink hover:text-accent-deep"
          >
            About
          </Link>
          <span aria-hidden className="text-frame">
            ·
          </span>
          <p className="min-w-0 leading-relaxed">
            Organized by{" "}
            <a
              href={ORGANIZER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={creditLinkClass}
            >
              Oubori
            </a>
            <span aria-hidden> • </span>
            App by{" "}
            <a
              href={MAINTAINER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={creditLinkClass}
            >
              jawn
            </a>
            <span aria-hidden> • </span>
            ROM by{" "}
            <a
              href={ROM_AUTHOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={creditLinkClass}
            >
              chedda
            </a>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
