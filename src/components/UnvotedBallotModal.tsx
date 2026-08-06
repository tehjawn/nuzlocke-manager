"use client";

import { useMemo, useState, useTransition } from "react";
import { castSurvivalVoteAction } from "@/app/actions/survival";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { Modal } from "@/components/Modal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { TrainerProfile } from "@/lib/challenge-types";
import type {
  SurvivalMarketListItem,
  SurvivalPrediction,
} from "@/lib/survival-market-types";
import {
  buildUnvotedBallot,
  isContested,
  monLabel,
  type UnvotedBallotItem,
  type UnvotedBallotSlotFilter,
} from "@/lib/survival-market-board";

type UnvotedBallotModalProps = {
  open: boolean;
  onClose: () => void;
  trainers: TrainerProfile[];
  markets: SurvivalMarketListItem[];
  /** Refresh Floor tallies after a successful cast. */
  onVoted: () => void;
  /** Optional — open the Pokémon details modal for a hot take. */
  onOpenDetails?: (pokemonId: string) => void;
};

/**
 * Vote-now list — living mons on active runs you haven’t weighed in on,
 * grouped by trainer (most badges first). Championship finishes are excluded.
 * One-tap Survive/Die; optional hot takes stay on Details.
 */
export function UnvotedBallotModal({
  open,
  onClose,
  trainers,
  markets,
  onVoted,
  onOpenDetails,
}: UnvotedBallotModalProps) {
  const [slot, setSlot] = useState<UnvotedBallotSlotFilter>("MAIN");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const ballot = useMemo(
    () => buildUnvotedBallot({ trainers, markets, slot }),
    [markets, slot, trainers],
  );

  const cast = (pokemonId: string, prediction: SurvivalPrediction) => {
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[pokemonId];
      return next;
    });
    setPendingId(pokemonId);
    startTransition(async () => {
      const result = await castSurvivalVoteAction({
        pokemonId,
        prediction,
        comment: null,
      });
      setPendingId(null);
      if (!result.ok) {
        setErrorById((prev) => ({ ...prev, [pokemonId]: result.error }));
        return;
      }
      onVoted();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Vote now"
      subtitle={
        ballot.total === 0
          ? "You’re caught up — every active-run mon already has your take."
          : `${ballot.total} still need your take · trainers closest to the end first`
      }
      headerActions={
        <div
          role="group"
          aria-label="Slot filter"
          className="flex gap-1"
        >
          <button
            type="button"
            aria-pressed={slot === "MAIN"}
            onClick={() => setSlot("MAIN")}
            className={`pressable rounded-md border px-2 py-1 text-[11px] font-semibold ${
              slot === "MAIN"
                ? "border-interactive/50 bg-interactive-soft/50 text-interactive"
                : "border-frame/50 bg-surface text-muted"
            }`}
          >
            Main
          </button>
          <button
            type="button"
            aria-pressed={slot === "all"}
            onClick={() => setSlot("all")}
            className={`pressable rounded-md border px-2 py-1 text-[11px] font-semibold ${
              slot === "all"
                ? "border-interactive/50 bg-interactive-soft/50 text-interactive"
                : "border-frame/50 bg-surface text-muted"
            }`}
          >
            Main + Reserve
          </button>
        </div>
      }
    >
      {ballot.total === 0 ? (
        <p className="rounded-lg border border-frame/40 bg-surface-2/50 px-3 py-4 text-sm text-muted">
          {slot === "MAIN"
            ? "Every Main Squad mon already has your call — flip to Main + Reserve or close."
            : "You’ve weighed in on every living Main and Reserve. Nice work."}
        </p>
      ) : (
        <div className="space-y-4">
          {ballot.groups.map((group) => (
            <section key={group.trainer.id} className="space-y-2">
              <header className="flex items-center gap-2.5 border-b border-frame/35 pb-1.5">
                <AvatarPortrait
                  avatarSpriteKey={group.trainer.avatarSpriteKey}
                  backgroundKey={group.trainer.avatarBackgroundKey}
                  sizeClass="h-8 w-8"
                  width={32}
                  height={32}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight">
                    {group.trainer.handle}
                  </p>
                  <p className="text-[11px] text-muted">
                    {group.badgeCount} badge
                    {group.badgeCount === 1 ? "" : "s"} · {group.items.length}{" "}
                    unvoted
                  </p>
                </div>
              </header>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.pokemonId}>
                    <BallotRow
                      item={item}
                      busy={pending && pendingId === item.pokemonId}
                      disabled={pending}
                      error={errorById[item.pokemonId] ?? null}
                      onCast={(prediction) =>
                        cast(item.pokemonId, prediction)
                      }
                      onOpenDetails={
                        onOpenDetails
                          ? () => onOpenDetails(item.pokemonId)
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

function BallotRow({
  item,
  busy,
  disabled,
  error,
  onCast,
  onOpenDetails,
}: {
  item: UnvotedBallotItem;
  busy: boolean;
  disabled: boolean;
  error: string | null;
  onCast: (prediction: SurvivalPrediction) => void;
  onOpenDetails?: () => void;
}) {
  const { pokemon, market } = item;
  const label = monLabel(pokemon.species, pokemon.nickname);
  const showSpecies = Boolean(pokemon.nickname?.trim());
  const contested = market ? isContested(market) : false;
  const tally =
    market && market.total > 0
      ? `${market.survivePct}% Survive · ${market.total}`
      : "No votes yet";

  return (
    <div className="rounded-lg border border-frame/45 bg-surface px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <PokemonSpriteImage
          species={pokemon.species}
          pokedexId={pokemon.pokedexId}
          shiny={pokemon.isShiny}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{label}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            {showSpecies ? <span>{pokemon.species}</span> : null}
            <span>{pokemon.slot === "MAIN" ? "Main" : "Reserve"}</span>
            <span>{tally}</span>
            {contested ? (
              <span className="font-bold text-warn">Contested</span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCast("SURVIVE")}
          className="pressable flex-1 rounded-md border border-accent/40 bg-accent/12 px-2 py-1.5 text-[11px] font-bold text-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "…" : "Survive"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCast("DIE")}
          className="pressable flex-1 rounded-md border border-danger/40 bg-danger/10 px-2 py-1.5 text-[11px] font-bold text-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "…" : "Die"}
        </button>
        {onOpenDetails ? (
          <button
            type="button"
            onClick={onOpenDetails}
            className="pressable rounded-md border border-frame/50 px-2 py-1.5 text-[11px] font-semibold text-interactive"
          >
            Details
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] font-medium text-danger">{error}</p>
      ) : null}
    </div>
  );
}
