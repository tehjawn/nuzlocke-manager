"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  gmInitTournamentAction,
  gmSetMatchWinnerAction,
} from "@/app/actions/challenge";
import type { Challenge, TournamentView } from "@/lib/challenge-types";
import { Frame } from "@/components/Frame";

type TournamentBracketProps = {
  challenge: Challenge;
  tournament: TournamentView | null;
  isGm: boolean;
};

export function TournamentBracket({
  challenge,
  tournament,
  isGm,
}: TournamentBracketProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lockedTrainers = challenge.trainers.filter((t) => t.mainSquadLocked);
  const rounds = tournament
    ? [...new Set(tournament.matches.map((m) => m.round))].sort(
        (a, b) => a - b,
      )
    : [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Endgame ladder
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          Tournament
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Post-Champion ladder. Lock Main Squads from the GM console, seed a
          single-elimination bracket, then pick winners — each finished round
          advances automatically.
        </p>
      </header>

      <Frame title="Eligible Main Squads">
        {lockedTrainers.length === 0 ? (
          <p className="text-sm text-muted">
            No Main Squads locked yet. GMs can lock trainers from the console
            when they&apos;re ready for the ladder.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {lockedTrainers.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-frame bg-surface-2 px-2.5 py-1 text-sm font-bold"
              >
                {t.handle}
              </li>
            ))}
          </ul>
        )}
        {isGm && challenge.id ? (
          <button
            type="button"
            disabled={pending || lockedTrainers.length < 2}
            className="pressable mt-4 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
            onClick={() => {
              startTransition(async () => {
                const result = await gmInitTournamentAction({
                  challengeId: challenge.id!,
                });
                if (result.ok) {
                  setError(null);
                  setMessage(result.message ?? "Tournament seeded");
                  router.refresh();
                } else {
                  setMessage(null);
                  setError(result.error);
                }
              });
            }}
          >
            {tournament ? "Reseed bracket" : "Seed bracket from locked squads"}
          </button>
        ) : null}
      </Frame>

      {!tournament ? (
        <Frame title="Bracket">
          <p className="text-sm text-muted">
            No tournament yet
            {isGm
              ? " — seed one when at least two Main Squads are locked."
              : "."}
          </p>
        </Frame>
      ) : (
        <div className="space-y-4">
          {tournament.status === "COMPLETE" ? (
            <p className="text-sm font-semibold text-accent-deep">
              Bracket complete — champion decided.
            </p>
          ) : null}
          {rounds.map((round) => {
            const matches = tournament.matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <Frame key={round} title={roundLabel(round, rounds.length)}>
                <ul className="space-y-3">
                  {matches.map((match) => (
                    <li
                      key={match.id}
                      className="rounded-lg border border-frame/30 bg-surface-2/50 p-3"
                    >
                      <p className="text-xs font-semibold tracking-tight text-muted">
                        {match.label ?? `Match ${match.sortOrder + 1}`}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <MatchSide
                          handle={match.trainerAHandle}
                          isWinner={match.winnerId === match.trainerAId}
                          canPick={
                            Boolean(
                              isGm &&
                                match.trainerAId &&
                                !match.winnerId,
                            )
                          }
                          pending={pending}
                          onPick={() => {
                            if (!match.trainerAId) return;
                            startTransition(async () => {
                              const result = await gmSetMatchWinnerAction({
                                matchId: match.id,
                                winnerId: match.trainerAId!,
                              });
                              if (result.ok) {
                                setError(null);
                                setMessage(result.message ?? "Winner set");
                                router.refresh();
                              } else {
                                setMessage(null);
                                setError(result.error);
                              }
                            });
                          }}
                        />
                        <MatchSide
                          handle={match.trainerBHandle}
                          isWinner={match.winnerId === match.trainerBId}
                          canPick={
                            Boolean(
                              isGm &&
                                match.trainerBId &&
                                !match.winnerId,
                            )
                          }
                          pending={pending}
                          onPick={() => {
                            if (!match.trainerBId) return;
                            startTransition(async () => {
                              const result = await gmSetMatchWinnerAction({
                                matchId: match.id,
                                winnerId: match.trainerBId!,
                              });
                              if (result.ok) {
                                setError(null);
                                setMessage(result.message ?? "Winner set");
                                router.refresh();
                              } else {
                                setMessage(null);
                                setError(result.error);
                              }
                            });
                          }}
                        />
                      </div>
                      {match.winnerHandle ? (
                        <p className="mt-2 text-sm font-bold text-accent-deep">
                          Winner: {match.winnerHandle}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Frame>
            );
          })}
        </div>
      )}

      {message ? (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

function MatchSide({
  handle,
  isWinner,
  canPick,
  pending,
  onPick,
}: {
  handle: string | null;
  isWinner: boolean;
  canPick: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  const body = (
    <span
      className={`block rounded-lg border px-3 py-2 text-sm font-bold ${
        isWinner
          ? "border-accent bg-accent/15 text-accent-deep"
          : "border-frame bg-surface"
      } ${!handle ? "text-muted" : ""}`}
    >
      {handle ?? "TBD"}
      {isWinner ? " ✓" : ""}
    </span>
  );

  if (!canPick) return body;

  return (
    <button
      type="button"
      disabled={pending}
      className="text-left disabled:opacity-60"
      onClick={onPick}
      title="Set as winner"
    >
      {body}
    </button>
  );
}

function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1 && totalRounds > 1) return "Semifinals";
  return `Round ${round}`;
}
