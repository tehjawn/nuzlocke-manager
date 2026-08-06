"use client";

import { useEffect, useState, useTransition } from "react";
import {
  castSurvivalVoteAction,
  getSurvivalMarketAction,
} from "@/app/actions/survival";
import type {
  SurvivalMarketView,
  SurvivalPrediction,
  SurvivalVoteView,
} from "@/lib/survival-market-types";

const MISSED_COLLAPSE_AT = 6;

function VoteRow({
  vote,
  highlight,
}: {
  vote: SurvivalVoteView;
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
        highlight ? "bg-interactive-soft/40 ring-1 ring-interactive/30" : ""
      }`}
    >
      {vote.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vote.user.image}
          alt=""
          className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-frame/40 object-cover"
        />
      ) : (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-frame/40 bg-surface-2 text-[10px] font-bold text-muted"
          aria-hidden
        >
          {vote.user.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight">
          {vote.user.displayName}
          {highlight ? (
            <span className="ml-1 text-[10px] font-bold text-accent-deep">
              you
            </span>
          ) : null}
          <span className="ml-1.5 text-[10px] font-medium text-muted">
            {vote.prediction === "SURVIVE" ? "Survive" : "Die"}
          </span>
        </p>
        {vote.comment ? (
          <p className="mt-0.5 text-[11px] leading-snug text-ink/80">
            “{vote.comment}”
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Roster({
  title,
  votes,
  viewerUserId,
  empty,
  collapseMisses,
}: {
  title: string;
  votes: SurvivalVoteView[];
  viewerUserId?: string | null;
  empty: string;
  collapseMisses?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsed =
    Boolean(collapseMisses) &&
    votes.length > MISSED_COLLAPSE_AT &&
    !expanded;
  const shown = collapsed ? votes.slice(0, MISSED_COLLAPSE_AT) : votes;

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        {title} · {votes.length}
      </p>
      {votes.length === 0 ? (
        <p className="text-[11px] text-muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((vote) => (
            <VoteRow
              key={vote.id}
              vote={vote}
              highlight={Boolean(
                viewerUserId && vote.user.id === viewerUserId,
              )}
            />
          ))}
        </ul>
      )}
      {collapsed ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-accent-deep underline-offset-2 hover:underline"
          onClick={() => setExpanded(true)}
        >
          Show {votes.length - MISSED_COLLAPSE_AT} more misses
        </button>
      ) : null}
    </div>
  );
}

export function SurvivalPollSection({
  pokemonId,
  enabled,
  viewerUserId,
  onVoted,
}: {
  pokemonId: string;
  /** Challenge flag — omit section entirely when off and no market. */
  enabled: boolean;
  viewerUserId?: string | null;
  /** Fired after a successful cast so parent boards can refresh tallies. */
  onVoted?: () => void;
}) {
  const [market, setMarket] = useState<SurvivalMarketView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getSurvivalMarketAction({ pokemonId }).then((view) => {
      if (cancelled) return;
      setMarket(view);
      setComment(
        view?.votes.find((v) => v.user.id === viewerUserId)?.comment ?? "",
      );
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pokemonId, viewerUserId]);

  if (!enabled && !market) return null;
  if (!loaded) {
    return (
      <section className="rounded-xl border border-frame/40 bg-surface-2/40 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Will they make it?
        </p>
        <p className="mt-1 text-[11px] text-muted">Loading poll…</p>
      </section>
    );
  }
  if (!market) return null;

  const cast = (prediction: SurvivalPrediction) => {
    setError(null);
    startTransition(async () => {
      const result = await castSurvivalVoteAction({
        pokemonId,
        prediction,
        comment: comment.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const next = await getSurvivalMarketAction({ pokemonId });
      setMarket(next);
      onVoted?.();
    });
  };

  const summaryLine =
    market.status === "RESOLVED_DIE"
      ? `Cooked — ${market.die}/${market.total} called Die`
      : market.status === "RESOLVED_SURVIVE"
        ? `Locked — ${market.survive}/${market.total} called Survive`
        : market.status === "VOID"
          ? "Poll voided — no score"
          : market.total > 0
            ? `${market.survivePct}% Survive · ${market.total} vote${market.total === 1 ? "" : "s"}`
            : "No votes yet";

  return (
    <section className="rounded-xl border border-frame/40 bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Will they make it?
        </p>
        <p className="text-[11px] font-semibold text-ink/80">{summaryLine}</p>
      </div>

      {market.status === "OPEN" ? (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!market.canVote || pending}
              onClick={() => cast("SURVIVE")}
              className={`pressable flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition ${
                market.myPrediction === "SURVIVE"
                  ? "border-accent bg-accent/15 text-accent-deep"
                  : "border-frame bg-surface text-ink hover:border-interactive/60"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Survive
            </button>
            <button
              type="button"
              disabled={!market.canVote || pending}
              onClick={() => cast("DIE")}
              className={`pressable flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition ${
                market.myPrediction === "DIE"
                  ? "border-danger bg-danger/10 text-danger"
                  : "border-frame bg-surface text-ink hover:border-interactive/60"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Die
            </button>
          </div>
          {market.canVote ? (
            <label className="block">
              <span className="sr-only">Optional hot take</span>
              <input
                type="text"
                value={comment}
                maxLength={140}
                placeholder="Optional hot take…"
                onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-lg border border-frame/50 bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted"
              />
            </label>
          ) : market.voteBlockedReason ? (
            <p className="text-[11px] text-muted">{market.voteBlockedReason}</p>
          ) : null}
          {error ? (
            <p className="text-[11px] font-medium text-danger">{error}</p>
          ) : null}
          {market.votes.length > 0 ? (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
              {market.votes.slice(0, 12).map((vote) => (
                <VoteRow
                  key={vote.id}
                  vote={vote}
                  highlight={Boolean(
                    viewerUserId && vote.user.id === viewerUserId,
                  )}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : market.status === "VOID" ? (
        <p className="mt-2 text-[11px] text-muted">
          This poll was voided (board reset or import) and is not scored.
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Roster
            title="Called it"
            votes={market.calledIt}
            viewerUserId={viewerUserId}
            empty="Nobody called this one"
          />
          <Roster
            title="Missed"
            votes={market.missed}
            viewerUserId={viewerUserId}
            empty="Perfect call — no misses"
            collapseMisses
          />
        </div>
      )}
    </section>
  );
}
