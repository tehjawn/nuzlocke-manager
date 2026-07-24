import Link from "next/link";

const planned = [
  {
    title: "Trainer boards",
    body: "Status, revive token, gym/Elite badges, Main Squad, Reserves, and R.I.P. with full Pokémon details.",
  },
  {
    title: "Seasons & archives",
    body: "Run Trash Pack 2026, then keep 2027+ as separate challenge records with shared history.",
  },
  {
    title: "Players + Game Masters",
    body: "Players edit their own boards and accounts. GMs own rules, FAQ, roster, and full override control.",
  },
  {
    title: "Sprites that just work",
    body: "Open Pokémon sprites + Showdown trainer avatars — type a species, get the art.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <p className="font-display text-sm font-semibold tracking-[0.2em] text-accent uppercase">
          Nuzlocke Manager
        </p>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/challenges" className="transition hover:text-foreground">
            Challenges
          </Link>
          <a
            href="https://github.com/tehjawn/nuzlocke-manager"
            className="transition hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-20 pt-8">
        <p className="mb-4 text-sm font-medium tracking-wide text-accent-2">
          Friend-group Nuzlocke ops
        </p>
        <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          Track the run.
          <span className="block text-accent">Honor the fallen.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          A Vercel-ready replacement for the Trash Pack spreadsheet — live
          trainer boards, challenge history, and GM tools for your crew&apos;s
          next Nuzlocke season.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/challenges"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
          >
            View challenges
          </Link>
          <a
            href="https://github.com/tehjawn/nuzlocke-manager/blob/main/docs/MASTER_PLAN.md"
            className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
            target="_blank"
            rel="noreferrer"
          >
            Read the master plan
          </a>
        </div>

        <section className="mt-16 grid gap-6 sm:grid-cols-2">
          {planned.map((item) => (
            <article
              key={item.title}
              className="border-t border-border pt-4"
            >
              <h2 className="font-display text-lg font-semibold text-foreground">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-xs text-muted">
        Scaffolded for Vercel · See{" "}
        <code className="text-foreground/80">docs/MASTER_PLAN.md</code>
      </footer>
    </div>
  );
}
