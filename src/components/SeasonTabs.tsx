"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SeasonTabsProps = {
  slug: string;
};

type Tab = {
  href: string;
  label: string;
  match: "exact" | "prefix";
};

export function SeasonTabs({ slug }: SeasonTabsProps) {
  const pathname = usePathname();
  const base = `/challenges/${slug}`;

  const tabs: Tab[] = [
    { href: base, label: "Players", match: "exact" },
    { href: `${base}/setup`, label: "Get Started", match: "prefix" },
    { href: `${base}/rules`, label: "Rules", match: "prefix" },
    { href: `${base}/faq`, label: "FAQ", match: "prefix" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Season sections"
      className="flex flex-wrap gap-1 rounded-sm border-2 border-frame bg-surface-2 p-1"
    >
      {tabs.map((tab) => {
        const active =
          tab.match === "exact"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={`rounded-sm px-3 py-2 text-sm font-bold transition-colors ${
              active
                ? "bg-accent text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
