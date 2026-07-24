import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Challenges",
};

const placeholderChallenges = [
  {
    slug: "2026-trash-pack",
    name: "Trash Pack Pokémon Nuzlocke",
    year: 2026,
    status: "Coming soon",
    blurb:
      "First season ported from the group spreadsheet — rules, FAQ, and trainer boards.",
  },
];

export default function ChallengesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <Link
        href="/"
        className="mb-8 text-sm text-muted transition hover:text-foreground"
      >
        ← Nuzlocke Manager
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Challenges
      </h1>
      <p className="mt-2 text-muted">
        Annual Nuzlocke seasons live here. Archives stay readable forever.
      </p>

      <ul className="mt-10 space-y-4">
        {placeholderChallenges.map((c) => (
          <li
            key={c.slug}
            className="rounded-lg border border-border bg-surface/60 p-5"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">{c.name}</h2>
              <span className="text-xs tracking-wide text-accent-2 uppercase">
                {c.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {c.year} · <code>{c.slug}</code>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              {c.blurb}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
