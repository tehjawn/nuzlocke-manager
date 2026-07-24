import Link from "next/link";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { SiteHeader } from "@/components/SiteHeader";
import { listChallenges } from "@/lib/challenges";

export default async function HomePage() {
  const session = await auth();
  const challenges = await listChallenges();
  const active = challenges.find((c) => c.status === "ACTIVE");

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 pb-16 pt-6 sm:px-6">
        <p className="font-display text-sm font-bold tracking-[0.2em] text-accent-deep uppercase">
          Friend-group clubhouse
        </p>
        <h1 className="font-display mt-3 max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
          Track the run.
          <span className="mt-1 block text-accent-deep">Honor the fallen.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          A warm, Gen 3–flavored board for your crew&apos;s Nuzlocke season —
          league standings, trainer boards, badges, and memorials.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {active ? (
            <Link
              href={`/challenges/${active.slug}`}
              className="pressable rounded-sm bg-accent px-5 py-3 font-display text-sm font-bold tracking-wide text-white uppercase"
            >
              Open {active.year} league
            </Link>
          ) : null}
          <Link
            href="/challenges"
            className="pressable rounded-sm bg-surface px-5 py-3 font-display text-sm font-bold tracking-wide uppercase"
          >
            All seasons
          </Link>
          {!session?.user ? (
            <Link
              href="/login"
              className="pressable rounded-sm bg-surface px-5 py-3 font-display text-sm font-bold tracking-wide uppercase"
            >
              Sign in
            </Link>
          ) : null}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "League board",
              body: "See every trainer’s status, badges, and Main Squad at a glance.",
            },
            {
              title: "Live editing",
              body: "Players update boards; GMs own rules, roster, and overrides.",
            },
            {
              title: "Season archives",
              body: "Trash Pack 2026 stays readable when 2027 starts.",
            },
          ].map((item) => (
            <Frame key={item.title} title={item.title}>
              <p className="text-sm leading-relaxed text-muted">{item.body}</p>
            </Frame>
          ))}
        </div>
      </main>
    </div>
  );
}
