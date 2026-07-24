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
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
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
                  <h2 className="font-display text-xl font-bold">{c.name}</h2>
                  <span className="font-display text-xs font-bold tracking-wide text-accent-2 uppercase">
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.year} · {c.game} · <code>{c.slug}</code> · {c.source}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{c.description}</p>
                <Link
                  href={`/challenges/${c.slug}`}
                  className="pressable mt-4 inline-block rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase"
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
