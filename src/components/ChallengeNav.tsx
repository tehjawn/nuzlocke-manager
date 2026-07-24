"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ChallengeNavProps = {
  slug: string;
  year: number;
};

type NavItem = {
  href: string;
  label: string;
  title?: string;
  match: "exact" | "prefix";
};

export function ChallengeNav({ slug, year }: ChallengeNavProps) {
  const pathname = usePathname();
  const base = `/challenges/${slug}`;

  const items: NavItem[] = [
    {
      href: base,
      label: "Board",
      title: `Season ${year} Board`,
      match: "exact",
    },
    {
      href: `${base}/setup`,
      label: "Setup",
      match: "prefix",
    },
    {
      href: `${base}/rules`,
      label: "Rules",
      match: "prefix",
    },
    {
      href: `${base}/faq`,
      label: "FAQ",
      match: "prefix",
    },
  ];

  return (
    <nav
      aria-label="Season pages"
      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
    >
      {items.map((item) => {
        const active =
          item.match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-sm border-2 border-frame px-2.5 py-1.5 text-sm font-bold whitespace-nowrap transition-colors lg:w-full ${
              active
                ? "bg-accent text-white"
                : "bg-surface text-ink hover:bg-accent/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
