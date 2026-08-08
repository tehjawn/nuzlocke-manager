"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  gmSeedTournamentAction,
  gmSetMatchPokepasteAction,
  gmSetMatchWinnerAction,
} from "@/app/actions/challenge";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { playSfx } from "@/features/fx/audio-engine";
import type {
  Challenge,
  MatchSideSnapshot,
  TournamentMatchView,
  TournamentView,
} from "@/lib/challenge-types";
import { CTA_PRIMARY, CTA_SECONDARY_SM } from "@/lib/cta";
import {
  formatTournamentLabel,
  tournamentStatusLabel,
} from "@/lib/tournament";
import { parsePokepastePreview } from "@/lib/tournament-snapshots";

type TournamentArenaProps = {
  challenge: Challenge;
  tournament: TournamentView;
  isGm: boolean;
};

export function TournamentArena({
  challenge,
  tournament,
  isGm,
}: TournamentArenaProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crownFlash, setCrownFlash] = useState(false);
  const prevStatus = useRef(tournament.status);

  const lockedTrainers = challenge.trainers.filter((t) => t.mainSquadLocked);
  const rounds = [
    ...new Set(tournament.matches.map((m) => m.round)),
  ].sort((a, b) => a - b);
  const champion =
    tournament.status === "COMPLETE"
      ? tournament.format === "SWISS"
        ? tournament.standings[0] ?? null
        : (() => {
            const final = tournament.matches
              .filter((m) => m.round === rounds[rounds.length - 1])
              .find((m) => m.winnerHandle);
            return final
              ? {
                  handle: final.winnerHandle!,
                  trainerId: final.winnerId!,
                }
              : null;
          })()
      : null;

  useEffect(() => {
    if (
      prevStatus.current !== "COMPLETE" &&
      tournament.status === "COMPLETE"
    ) {
      playSfx("champion");
      setCrownFlash(true);
      const t = window.setTimeout(() => setCrownFlash(false), 3200);
      return () => window.clearTimeout(t);
    }
    prevStatus.current = tournament.status;
  }, [tournament.status]);

  const base = `/challenges/${challenge.slug}/tournaments`;

  return (
    <div className="tournament-stage space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
        <Link
          href={base}
          className="text-accent-deep underline-offset-2 hover:underline"
        >
          ← All tournaments
        </Link>
      </div>

      <header
        className={`tournament-hero relative overflow-hidden rounded-[var(--radius)] border border-frame px-5 py-8 sm:px-8 sm:py-10 ${
          crownFlash ? "tournament-hero--crown" : ""
        }`}
      >
        <div className="tournament-hero__glow" aria-hidden />
        <div className="tournament-hero__rays" aria-hidden />
        <p className="relative text-xs font-semibold tracking-[0.18em] text-accent-2-ink uppercase">
          {formatTournamentLabel(tournament.format)}
          {tournament.format === "SWISS" && tournament.swissRoundCount
            ? ` · ${tournament.swissRoundCount} rounds`
            : ""}
        </p>
        <h1 className="relative mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {tournament.name ?? "Tournament"}
        </h1>
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
              tournament.status === "COMPLETE"
                ? "bg-accent/20 text-accent-deep"
                : tournament.status === "ACTIVE"
                  ? "bg-accent-2/25 text-accent-2-ink"
                  : "bg-surface-2 text-muted"
            }`}
          >
            {tournamentStatusLabel(tournament.status)}
          </span>
          {champion && (
            <span className="tournament-champion-chip rounded-lg bg-accent px-2.5 py-0.5 text-xs font-bold text-[var(--on-accent)]">
              Champion · {champion.handle}
            </span>
          )}
        </div>
      </header>

      {isGm && (
        <section className="rounded-[var(--radius)] border border-frame bg-surface-2/70 p-4">
          <h2 className="text-sm font-bold">GM controls</h2>
          <p className="mt-1 text-xs text-muted">
            {lockedTrainers.length} locked Main Squad
            {lockedTrainers.length === 1 ? "" : "s"} available to seed.
            Seeding snapshots each roster at lock time.
          </p>
          {lockedTrainers.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {lockedTrainers.map((t) => (
                <li
                  key={t.id}
                  className="rounded-md border border-frame bg-surface px-2 py-0.5 text-xs font-bold"
                >
                  {t.handle}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={pending || lockedTrainers.length < 2}
            className={`${CTA_PRIMARY} mt-3 disabled:opacity-50`}
            onClick={() => {
              startTransition(async () => {
                const result = await gmSeedTournamentAction({
                  tournamentId: tournament.id,
                });
                if (result.ok) {
                  setError(null);
                  setMessage(result.message ?? "Seeded");
                  playSfx("lock");
                  router.refresh();
                } else {
                  setMessage(null);
                  setError(result.error);
                  playSfx("error");
                }
              });
            }}
          >
            {tournament.matches.length > 0
              ? "Reseed from locked squads"
              : "Seed from locked squads"}
          </button>
        </section>
      )}

      {tournament.format === "SWISS" && tournament.standings.length > 0 && (
        <section className="rounded-[var(--radius)] border border-frame bg-surface p-4">
          <h2 className="text-sm font-bold tracking-tight">Standings</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-frame text-xs text-muted">
                  <th className="py-1.5 pr-2 font-semibold">#</th>
                  <th className="py-1.5 pr-2 font-semibold">Trainer</th>
                  <th className="py-1.5 pr-2 font-semibold">W–L</th>
                  <th className="py-1.5 pr-2 font-semibold">Pts</th>
                  <th className="py-1.5 font-semibold">Buchholz</th>
                </tr>
              </thead>
              <tbody>
                {tournament.standings.map((row, i) => (
                  <tr
                    key={row.trainerId}
                    className="border-b border-frame/40 last:border-0"
                  >
                    <td className="py-2 pr-2 font-bold text-muted">{i + 1}</td>
                    <td className="py-2 pr-2 font-bold">{row.handle}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {row.wins}–{row.losses}
                    </td>
                    <td className="py-2 pr-2 font-semibold tabular-nums">
                      {row.points}
                    </td>
                    <td className="py-2 tabular-nums text-muted">
                      {row.buchholz}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tournament.matches.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-frame px-4 py-10 text-center text-sm text-muted">
          Bracket not seeded yet
          {isGm
            ? " — lock Main Squads, then seed above."
            : ". The GM will open the arena soon."}
        </p>
      ) : (
        <div className="tournament-bracket-scroll space-y-5">
          {rounds.map((round, roundIndex) => {
            const matches = tournament.matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <section
                key={round}
                className="tournament-round"
                style={{ animationDelay: `${roundIndex * 80}ms` }}
              >
                <h2 className="mb-3 text-xs font-semibold tracking-[0.14em] text-accent-deep uppercase">
                  {roundLabel(round, rounds.length, tournament.format)}
                </h2>
                <ul className="grid gap-4 lg:grid-cols-2">
                  {matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isGm={isGm}
                      pending={pending}
                      onPickWinner={(winnerId) => {
                        startTransition(async () => {
                          const result = await gmSetMatchWinnerAction({
                            matchId: match.id,
                            winnerId,
                          });
                          if (result.ok) {
                            setError(null);
                            setMessage(result.message ?? "Winner set");
                            if (result.message?.includes("champion")) {
                              playSfx("champion");
                            } else {
                              playSfx("success");
                            }
                            router.refresh();
                          } else {
                            setMessage(null);
                            setError(result.error);
                            playSfx("error");
                          }
                        });
                      }}
                      onSavePokepaste={(side, pokepaste) => {
                        startTransition(async () => {
                          const result = await gmSetMatchPokepasteAction({
                            matchId: match.id,
                            side,
                            pokepaste,
                          });
                          if (result.ok) {
                            setError(null);
                            setMessage(result.message ?? "Saved");
                            playSfx("success");
                            router.refresh();
                          } else {
                            setMessage(null);
                            setError(result.error);
                            playSfx("error");
                          }
                        });
                      }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {message && (
        <p className="text-sm font-semibold text-accent-deep" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function MatchCard({
  match,
  isGm,
  pending,
  onPickWinner,
  onSavePokepaste,
}: {
  match: TournamentMatchView;
  isGm: boolean;
  pending: boolean;
  onPickWinner: (winnerId: string) => void;
  onSavePokepaste: (side: "A" | "B", pokepaste: string) => void;
}) {
  const decided = Boolean(match.winnerId);

  return (
    <li className="tournament-match relative overflow-hidden rounded-[var(--radius)] border border-frame bg-surface">
      <div className="tournament-match__rail" aria-hidden />
      <div className="relative p-4">
        <p className="text-xs font-semibold tracking-tight text-muted">
          {match.label ?? `Match ${match.sortOrder + 1}`}
        </p>
        <div className="mt-3 grid gap-3">
          <MatchSide
            handle={match.trainerAHandle}
            trainerId={match.trainerAId}
            squad={match.squadA}
            pokepaste={match.pokepasteA}
            isWinner={match.winnerId === match.trainerAId}
            isLoser={decided && match.winnerId !== match.trainerAId}
            canPick={Boolean(isGm && match.trainerAId && !match.winnerId)}
            canEditPaste={Boolean(isGm && match.trainerAId)}
            pending={pending}
            onPick={() => {
              if (match.trainerAId) onPickWinner(match.trainerAId);
            }}
            onSavePaste={(paste) => onSavePokepaste("A", paste)}
          />
          <div className="flex items-center gap-2 text-[0.65rem] font-bold tracking-[0.2em] text-muted uppercase">
            <span className="h-px flex-1 bg-frame" />
            vs
            <span className="h-px flex-1 bg-frame" />
          </div>
          <MatchSide
            handle={match.trainerBHandle}
            trainerId={match.trainerBId}
            squad={match.squadB}
            pokepaste={match.pokepasteB}
            isWinner={match.winnerId === match.trainerBId}
            isLoser={
              decided &&
              Boolean(match.trainerBId) &&
              match.winnerId !== match.trainerBId
            }
            canPick={Boolean(isGm && match.trainerBId && !match.winnerId)}
            canEditPaste={Boolean(isGm && match.trainerBId)}
            pending={pending}
            onPick={() => {
              if (match.trainerBId) onPickWinner(match.trainerBId);
            }}
            onSavePaste={(paste) => onSavePokepaste("B", paste)}
          />
        </div>
        {match.winnerHandle && (
          <p className="mt-3 text-sm font-bold text-accent-deep">
            Winner: {match.winnerHandle}
          </p>
        )}
      </div>
    </li>
  );
}

function MatchSide({
  handle,
  trainerId,
  squad,
  pokepaste,
  isWinner,
  isLoser,
  canPick,
  canEditPaste,
  pending,
  onPick,
  onSavePaste,
}: {
  handle: string | null;
  trainerId: string | null;
  squad: MatchSideSnapshot | null;
  pokepaste: string | null;
  isWinner: boolean;
  isLoser: boolean;
  canPick: boolean;
  canEditPaste: boolean;
  pending: boolean;
  onPick: () => void;
  onSavePaste: (paste: string) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState(pokepaste ?? "");
  const pasteId = useId();
  const preview = pokepaste ? parsePokepastePreview(pokepaste) : [];

  const body = (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors ${
        isWinner
          ? "border-accent bg-accent/15"
          : isLoser
            ? "border-frame/40 bg-surface-2/40 opacity-70"
            : "border-frame bg-surface-2/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-sm font-bold ${!handle ? "text-muted" : ""}`}
        >
          {handle ?? "TBD"}
          {isWinner ? " ✓" : ""}
        </span>
        {canPick && (
          <span className="text-[0.65rem] font-semibold tracking-tight text-accent-deep">
            Tap to crown
          </span>
        )}
      </div>

      {squad && squad.pokemon.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {squad.pokemon.map((mon) => (
            <li
              key={`${mon.partyIndex}-${mon.species}`}
              className="flex items-center gap-1 rounded-md border border-frame/50 bg-surface px-1.5 py-1"
              title={mon.nickname ? `${mon.nickname} (${mon.species})` : mon.species}
            >
              <PokemonSpriteImage
                species={mon.species}
                pokedexId={mon.pokedexId}
                shiny={mon.isShiny}
                className="h-7 w-7"
                width={28}
                height={28}
                alt=""
              />
              <span className="max-w-[4.5rem] truncate text-[0.65rem] font-semibold">
                {mon.nickname || mon.species}
                {mon.level != null ? ` Lv${mon.level}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {preview.length > 0 && (
        <p className="mt-2 text-[0.65rem] leading-relaxed text-muted">
          Poképaste:{" "}
          {preview
            .slice(0, 6)
            .map((p) => p.nickname || p.species)
            .join(" · ")}
          {preview.length > 6 ? "…" : ""}
        </p>
      )}

      {canEditPaste && trainerId && (
        <div className="mt-2">
          <button
            type="button"
            className={`${CTA_SECONDARY_SM} text-[0.65rem]`}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(pokepaste ?? "");
              setPasteOpen((v) => !v);
            }}
          >
            {pasteOpen ? "Hide Poképaste" : pokepaste ? "Edit Poképaste" : "Add Poképaste"}
          </button>
          {pasteOpen && (
            <form
              className="mt-2 space-y-2"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                onSavePaste(draft);
                setPasteOpen(false);
              }}
            >
              <label className="block text-[0.65rem] font-semibold" htmlFor={pasteId}>
                Poképaste
                <textarea
                  id={pasteId}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={5}
                  placeholder={"Species @ Item\nAbility: …\n- Move"}
                  className="mt-1 w-full rounded-lg border border-frame bg-surface px-2 py-1.5 font-mono text-[0.7rem]"
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                className={`${CTA_PRIMARY} text-xs disabled:opacity-50`}
              >
                Save Poképaste
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );

  if (!canPick) return body;

  return (
    <button
      type="button"
      disabled={pending}
      className="w-full text-left disabled:opacity-60"
      onClick={onPick}
      title="Set as winner"
    >
      {body}
    </button>
  );
}

function roundLabel(
  round: number,
  totalRounds: number,
  format: TournamentView["format"],
): string {
  if (format === "SWISS") return `Swiss round ${round}`;
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1 && totalRounds > 1) return "Semifinals";
  if (round === totalRounds - 2 && totalRounds > 2) return "Quarterfinals";
  return `Round ${round}`;
}
