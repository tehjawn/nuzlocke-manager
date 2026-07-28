"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SeasonRulesLinkProps = {
  slug: string;
  /** Extra classes for layout (e.g. mobile-only / desktop-only wrappers). */
  className?: string;
};

/**
 * Persistent Rules / FAQ entry near season section nav.
 * Kept out of the primary tab list (and the global header) so workflow tabs
 * stay uncrowded while the page remains one tap away on desktop and mobile.
 */
export function SeasonRulesLink({ slug, className = "" }: SeasonRulesLinkProps) {
  const pathname = usePathname() ?? "";
  const href = `/challenges/${slug}/rules`;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`pressable flex items-center gap-2.5 border px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
          : "border-frame bg-surface text-ink hover:border-interactive/50"
      } ${className}`}
    >
      <span
        className={`shrink-0 ${active ? "text-interactive" : "text-ink/70"}`}
        aria-hidden
      >
        <RulesIcon />
      </span>
      <span className="min-w-0 flex-1">Rules / FAQ</span>
      <span className="text-xs font-medium text-muted" aria-hidden>
        →
      </span>
    </Link>
  );
}

function RulesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M7 4.5h8.5L18 7v12.5H7A1.5 1.5 0 015.5 18V6A1.5 1.5 0 017 4.5z"
        strokeLinejoin="round"
      />
      <path d="M15.5 4.5V7H18" strokeLinejoin="round" />
      <path d="M9 11h6M9 14.5h6M9 18h3.5" strokeLinecap="round" />
    </svg>
  );
}
