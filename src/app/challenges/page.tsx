import Link from "next/link";
import type { Metadata } from "next";
import { Frame } from "@/components/Frame";
import { SiteHeader } from "@/components/SiteHeader";
import { listChallenges } from "@/lib/challenges";

export const metadata: Metadata = {
  title: "Seasons",
};

export default async function ChallengesPage() {
  const challenges = await listChallenges();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Seasons
        </h1>
        <p className="mt-2 text-muted">
          Annual Nuzlocke challenges. Active seasons first; archives forever.
        </p>

        <ul className="mt-8 space-y-4">
          {challenges.map((c) => (
            <li key={c.slug}>
              <Frame>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-bold tracking-tight">{c.name}</h2>
                  <span className="rounded-lg bg-accent-2/20 px-2 py-0.5 text-xs font-semibold tracking-tight text-accent-ink">
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.year} · {c.game} · <code>{c.slug}</code> · {c.source}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{c.description}</p>
                <Link
                  href={`/challenges/${c.slug}`}
                  className="pressable mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-xs font-semibold tracking-tight text-[var(--on-accent)]"
                >
                  Enter league board
                </Link>
              </Frame>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
