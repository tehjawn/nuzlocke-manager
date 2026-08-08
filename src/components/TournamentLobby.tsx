"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { gmCreateTournamentAction } from "@/app/actions/challenge";
import type {
  Challenge,
  TournamentFormat,
  TournamentSummary,
} from "@/lib/challenge-types";
import { CTA_PRIMARY, CTA_SECONDARY_SM } from "@/lib/cta";
import {
  formatTournamentLabel,
  tournamentStatusLabel,
} from "@/lib/tournament";

type TournamentLobbyProps = {
  challenge: Challenge;
  tournaments: TournamentSummary[];
  isGm: boolean;
};

export function TournamentLobby({
  challenge,
  tournaments,
  isGm,
}: TournamentLobbyProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("SINGLE_ELIM");
  const [swissRounds, setSwissRounds] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lockedCount = challenge.trainers.filter((t) => t.mainSquadLocked).length;
  const base = `/challenges/${challenge.slug}/tournaments`;

  return (
    <div className="tournament-stage space-y-8">
      <header className="tournament-hero relative overflow-hidden rounded-[var(--radius)] border border-frame px-5 py-8 sm:px-8 sm:py-10">
        <div className="tournament-hero__glow" aria-hidden />
        <p className="relative text-xs font-semibold tracking-[0.18em] text-accent-2-ink uppercase">
          Endgame arena
        </p>
        <h1 className="relative mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Tournaments
        </h1>
        <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Bracket nights and Swiss gauntlets for locked Main Squads. Spectate
          the ladder, crown a champion, and keep every roster frozen at the
          moment the match was set.
        </p>
        <p className="relative mt-4 text-xs font-semibold text-accent-deep">
          {lockedCount} Main Squad{lockedCount === 1 ? "" : "s"} locked
        </p>
      </header>

      {isGm && challenge.id && (
        <section className="rounded-[var(--radius)] border border-frame bg-surface-2/80 p-4 sm:p-5">
          <h2 className="text-sm font-bold tracking-tight">Create tournament</h2>
          <p className="mt-1 text-xs text-muted">
            GM only. Create a shell, then open it to seed from locked squads.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${challenge.name} Finals`}
                className="mt-1 w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm font-medium"
              />
            </label>
            <label className="block text-xs font-semibold">
              Format
              <select
                value={format}
                onChange={(e) =>
                  setFormat(e.target.value as TournamentFormat)
                }
                className="mt-1 w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm font-medium"
              >
                <option value="SINGLE_ELIM">Single elimination</option>
                <option value="SWISS">Swiss</option>
              </select>
            </label>
            {format === "SWISS" && (
              <label className="block text-xs font-semibold sm:col-span-2">
                Swiss rounds
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={swissRounds}
                  onChange={(e) =>
                    setSwissRounds(Number(e.target.value) || 4)
                  }
                  className="mt-1 w-full max-w-[8rem] rounded-lg border border-frame bg-surface px-3 py-2 text-sm font-medium"
                />
              </label>
            )}
          </div>
          <button
            type="button"
            disabled={pending || !name.trim()}
            className={`${CTA_PRIMARY} mt-4 disabled:opacity-50`}
            onClick={() => {
              if (!challenge.id) return;
              startTransition(async () => {
                const result = await gmCreateTournamentAction({
                  challengeId: challenge.id!,
                  name: name.trim(),
                  format,
                  swissRoundCount: format === "SWISS" ? swissRounds : null,
                });
                if (result.ok && result.tournamentId) {
                  setError(null);
                  setMessage(result.message ?? "Created");
                  setName("");
                  router.push(`${base}/${result.tournamentId}`);
                  router.refresh();
                } else if (!result.ok) {
                  setMessage(null);
                  setError(result.error);
                }
              });
            }}
          >
            Create tournament
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight">Season events</h2>
        {tournaments.length === 0 ? (
          <p className="rounded-[var(--radius)] border border-dashed border-frame bg-surface-2/40 px-4 py-8 text-center text-sm text-muted">
            No tournaments yet
            {isGm
              ? " — create one when Main Squads are ready."
              : ". Check back when the GM opens the arena."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {tournaments.map((t, index) => (
              <li
                key={t.id}
                className="tournament-card group relative overflow-hidden rounded-[var(--radius)] border border-frame bg-surface"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Link
                  href={`${base}/${t.id}`}
                  className="block px-4 py-4 transition-colors hover:bg-surface-2/60 sm:px-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold tracking-tight text-accent-2-ink">
                        {formatTournamentLabel(t.format)}
                        {t.format === "SWISS" && t.swissRoundCount
                          ? ` · ${t.swissRoundCount} rounds`
                          : ""}
                      </p>
                      <h3 className="mt-0.5 text-lg font-bold tracking-tight">
                        {t.name ?? "Untitled tournament"}
                      </h3>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        t.status === "COMPLETE"
                          ? "bg-accent/15 text-accent-deep"
                          : t.status === "ACTIVE"
                            ? "bg-accent-2/20 text-accent-2-ink"
                            : "bg-surface-2 text-muted"
                      }`}
                    >
                      {tournamentStatusLabel(t.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {t.matchCount} match{t.matchCount === 1 ? "" : "es"}
                    {t.currentRound != null
                      ? ` · round ${t.currentRound}`
                      : ""}
                  </p>
                  <span className={`${CTA_SECONDARY_SM} mt-3 inline-flex`}>
                    Enter arena →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      )}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
