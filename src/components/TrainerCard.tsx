"use client";

import Link from "next/link";
import { useState } from "react";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { BadgeCase } from "@/components/BadgeCase";
import { ChampionRibbon } from "@/components/ChampionRibbon";
import { Frame } from "@/components/Frame";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { ReviveToken } from "@/components/ReviveToken";
import { StatusLine } from "@/components/StatusLine";
import { formatPlayTime } from "@/lib/gen3-save/playtime";
import { pokemonInSlot } from "@/lib/trainer-display";

type TrainerCardProps = {
  challenge: Pick<Challenge, "slug" | "badges">;
  trainer: TrainerProfile;
  variant?: "list" | "grid";
  /** Signed-in player's own card — soft revolving rainbow edge. */
  isYou?: boolean;
  /** Nature / ability / stats / moves — owners, or GMs with lens on. */
  showCompetitiveDetails?: boolean;
};

export function TrainerCard({
  challenge,
  trainer,
  variant = "list",
  isYou = false,
  showCompetitiveDetails = false,
}: TrainerCardProps) {
  const main = pokemonInSlot(trainer, "MAIN").slice(0, 6);
  const caughtCount = trainer.slotCounts
    ? trainer.slotCounts.main + trainer.slotCounts.reserve
    : pokemonInSlot(trainer, "MAIN").length +
      pokemonInSlot(trainer, "RESERVE").length;
  const encounteredCount = trainer.slotCounts
    ? trainer.slotCounts.encountered
    : pokemonInSlot(trainer, "ENCOUNTERED").length;
  const ripCount = trainer.slotCounts
    ? trainer.slotCounts.graveyard
    : pokemonInSlot(trainer, "GRAVEYARD").length;
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );
  const boardHref = `/challenges/${challenge.slug}/trainers/${trainer.id}`;
  const isDemo = !trainer.userId;
  const firstMon = main.find((p) => p.partyIndex === 0) ?? main[0] ?? null;
  const earnedCount = trainer.earnedBadgeKeys.length;
  const statusTrimmed = trainer.statusText?.trim() ?? "";
  const hasStatus = Boolean(trainer.statusEmoji || statusTrimmed);
  const statusTitle = [trainer.statusEmoji, statusTrimmed]
    .filter(Boolean)
    .join(" ");
  const completionCount = trainer.completionCount ?? 0;
  const isChampion = completionCount > 0;
  const boardLabel = [
    `Open ${trainer.handle}'s board`,
    isYou ? "(you)" : null,
    isChampion
      ? completionCount === 1
        ? "— Champion"
        : `— Champion · ${completionCount} completions`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const cardBg = trainer.cardBackgroundKey;
  const avatarBg = trainer.avatarBackgroundKey;
  const championOverlay = isChampion ? (
    <ChampionRibbon completionCount={completionCount} />
  ) : null;
  const championOverlayDense = isChampion ? (
    <ChampionRibbon completionCount={completionCount} dense />
  ) : null;

  const statsFull = [
    `${caughtCount} caught`,
    `${encounteredCount} encountered`,
    `${ripCount} R.I.P.`,
    `Run ${trainer.activeRunNumber}`,
    completionCount > 0
      ? `${completionCount} completion${completionCount === 1 ? "" : "s"}`
      : null,
    trainer.money != null
      ? `$${trainer.money.toLocaleString("en-US")}`
      : null,
    trainer.playTimeSeconds != null
      ? formatPlayTime(trainer.playTimeSeconds)
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
  // Phones: drop the long middle of the stats string so the footer can't
  // contribute to horizontal overflow beside the revive chip.
  const statsMobile = [
    `${caughtCount} caught`,
    `${ripCount} R.I.P.`,
    `Run ${trainer.activeRunNumber}`,
    trainer.money != null
      ? `$${trainer.money.toLocaleString("en-US")}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      data-tour={
        isYou ? "your-trainer" : isDemo ? "demo-trainer" : undefined
      }
      className={`min-w-0${isYou ? " trainer-you-ring" : ""}`}
    >
      {variant === "grid" ? (
        <>
          {/*
            Compact card — below md. Mirrors the homepage carousel: avatar
            with the lead squad Pokémon peeking top-right, trainer name,
            then badge count.
          */}
          <Link
            aria-label={boardLabel}
            className="group block h-full md:hidden"
            href={boardHref}
          >
            <Frame
              cardBackgroundKey={cardBg}
              className="h-full transition-[border-color,box-shadow] duration-200 group-hover:border-interactive/45"
              dense
              overlay={championOverlayDense}
            >
              <div className="flex h-full flex-col items-center text-center">
                <div className="relative flex h-28 w-full items-end justify-center overflow-visible">
                  {firstMon ? (
                    <PokemonSpriteImage
                      alt=""
                      className="pixelated absolute top-0 left-1/2 z-0 h-16 w-16 -translate-x-[15%] object-contain opacity-80"
                      height={96}
                      pokedexId={firstMon.pokedexId}
                      shiny={firstMon.isShiny}
                      species={firstMon.species}
                      width={96}
                    />
                  ) : null}
                  <AvatarPortrait
                    avatarSpriteKey={trainer.avatarSpriteKey}
                    backgroundKey={avatarBg}
                    sizeClass="relative z-1 h-20 w-20"
                    width={96}
                    height={96}
                    imgClassName="drop-shadow-[0_6px_12px_var(--shadow-md)]"
                  />
                </div>
                <p className="mt-1.5 w-full truncate text-sm font-bold leading-tight tracking-tight group-hover:text-accent-deep">
                  {trainer.handle}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {earnedCount > 0 &&
                  earnedCount === challenge.badges.length
                    ? "All badges · ready"
                    : `${earnedCount} ${earnedCount === 1 ? "badge" : "badges"}`}
                </p>
              </div>
            </Frame>
          </Link>

          {/* Full card — md and up; compact 3×2 squad grid */}
          <Frame
            cardBackgroundKey={cardBg}
            className="group hidden h-full transition-[border-color,box-shadow] duration-200 hover:border-interactive/45 md:block"
            overlay={championOverlay}
          >
            <Link
              aria-label={boardLabel}
              className="absolute inset-0 z-1"
              href={boardHref}
            />
            <div className="flex h-full flex-col gap-2.5">
              <div className="grid min-h-0 flex-1 grid-cols-[7rem_minmax(0,1fr)] gap-3 lg:grid-cols-[8rem_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col items-center gap-1.5 overflow-visible text-center">
                  <AvatarPortrait
                    avatarSpriteKey={trainer.avatarSpriteKey}
                    backgroundKey={avatarBg}
                    sizeClass="mx-auto h-20 w-20 lg:h-24 lg:w-24"
                    width={112}
                    height={112}
                    className="overflow-visible"
                  />
                  <h2 className="w-full truncate text-sm font-bold leading-tight tracking-tight group-hover:text-accent-deep">
                    {trainer.handle}
                  </h2>
                  {hasStatus ? (
                    <StatusLine
                      emoji={trainer.statusEmoji}
                      text={trainer.statusText}
                      empty=""
                      className="w-full line-clamp-2 text-[11px] leading-snug text-muted"
                    />
                  ) : null}
                </div>

                <div className="grid min-h-0 grid-cols-3 grid-rows-2 gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const mon = main.find((p) => p.partyIndex === i);
                    if (!mon) {
                      return (
                        <div
                          key={`slot-${i}`}
                          className="flex aspect-square min-h-0 items-center justify-center rounded-lg border border-dashed border-frame/40 bg-surface-2/50"
                          title="Empty"
                        >
                          <span className="text-muted/35">·</span>
                        </div>
                      );
                    }
                    const label = mon.nickname || mon.species;
                    return (
                      <PokemonHoverPreview
                        className="relative z-2 min-h-0"
                        key={mon.id}
                        pokemon={mon}
                      >
                        <button
                          type="button"
                          title={label}
                          aria-label={`View ${label}`}
                          className="pressable flex aspect-square h-full min-h-0 w-full cursor-pointer items-center justify-center rounded-lg border border-frame/50 bg-surface-2 p-1 transition hover:border-interactive/60 hover:bg-interactive-soft/40"
                          onClick={() => setDetailsPokemon(mon)}
                        >
                          <PokemonSpriteImage
                            alt={label}
                            className="pixelated h-full w-full max-h-14 object-contain lg:max-h-16"
                            height={96}
                            pokedexId={mon.pokedexId}
                            shiny={mon.isShiny}
                            species={mon.species}
                            width={96}
                          />
                        </button>
                      </PokemonHoverPreview>
                    );
                  })}
                </div>
              </div>

              {/* Full-width strip: same as list — earned clear, unearned blurred */}
              <div className="flex shrink-0 justify-center pt-1">
                <BadgeCase
                  badges={challenge.badges}
                  earnedKeys={trainer.earnedBadgeKeys}
                  strip
                  hideCount
                />
              </div>
            </div>
          </Frame>
        </>
      ) : (
        <Frame
          className="group min-w-0 transition-[border-color,box-shadow] duration-200 hover:border-interactive/45"
          cardBackgroundKey={cardBg}
          overlay={championOverlay}
        >
          {/*
            List layout:
            - <sm: stack identity → full-width badge strip → squad → compact
              stats. Side-by-side badges previously forced horizontal scroll
              when the strip's min-content beat max-w.
            - sm+: identity rail | badges + squad + footer
            Whole card opens the board; squad slots stay above the link.
          */}
          <Link
            href={boardHref}
            className="absolute inset-0 z-1"
            aria-label={boardLabel}
          />
          <div className="relative flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-col items-start gap-1.5 overflow-visible sm:w-28 sm:shrink-0 sm:items-center sm:text-center md:w-32">
              <AvatarPortrait
                avatarSpriteKey={trainer.avatarSpriteKey}
                backgroundKey={avatarBg}
                sizeClass="h-14 w-14 shrink-0 sm:h-24 sm:w-24 md:h-28 md:w-28"
                width={112}
                height={112}
              />
              <div className="min-w-0 w-full">
                <h2 className="truncate text-sm font-bold leading-tight tracking-tight group-hover:text-accent-deep sm:text-base">
                  {trainer.handle}
                </h2>
                {trainer.realName?.trim() ? (
                  <p className="mt-0.5 truncate text-xs text-muted/80">
                    {trainer.realName.trim()}
                  </p>
                ) : null}
                {hasStatus ? (
                  <div title={statusTitle} className="mt-0.5 min-w-0">
                    <StatusLine
                      emoji={trainer.statusEmoji}
                      text={trainer.statusText}
                      empty=""
                      className="line-clamp-2 text-xs leading-snug text-muted sm:line-clamp-3"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="min-w-0 sm:hidden">
                <BadgeCase
                  badges={challenge.badges}
                  earnedKeys={trainer.earnedBadgeKeys}
                  strip
                  hideCount
                  dense
                />
              </div>
              <div className="hidden min-w-0 sm:block">
                <BadgeCase
                  badges={challenge.badges}
                  earnedKeys={trainer.earnedBadgeKeys}
                  strip
                />
              </div>

              <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
                {Array.from({ length: 6 }).map((_, i) => {
                  const mon = main.find((p) => p.partyIndex === i);
                  if (!mon) {
                    return (
                      <div
                        key={`slot-${i}`}
                        className="flex h-[5.25rem] min-w-0 items-center justify-center rounded-lg border border-dashed border-frame/40 bg-surface-2/50 sm:h-24"
                        title="Empty"
                      >
                        <span className="text-muted/35">·</span>
                      </div>
                    );
                  }
                  const label = mon.nickname || mon.species;
                  return (
                    <PokemonHoverPreview
                      key={mon.id}
                      pokemon={mon}
                      className="relative z-2 min-w-0"
                    >
                      <button
                        type="button"
                        title={label}
                        aria-label={`View ${label}`}
                        className="pressable group/slot flex h-[5.25rem] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-frame/50 bg-surface-2 px-1 py-1 transition hover:border-interactive/60 hover:bg-interactive-soft/40 sm:h-24"
                        onClick={() => setDetailsPokemon(mon)}
                      >
                        <PokemonSpriteImage
                          alt={label}
                          className="pixelated h-12 w-12 object-contain sm:h-14 sm:w-14"
                          height={80}
                          pokedexId={mon.pokedexId}
                          shiny={mon.isShiny}
                          species={mon.species}
                          width={80}
                        />
                        <span className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-tight text-muted group-hover/slot:text-ink">
                          {label}
                        </span>
                      </button>
                    </PokemonHoverPreview>
                  );
                })}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-3 pt-0.5">
                <p
                  className="min-w-0 truncate text-xs text-muted sm:hidden"
                  title={statsFull}
                >
                  {statsMobile}
                </p>
                <p className="hidden min-w-0 truncate text-xs text-muted sm:block">
                  {statsFull}
                </p>
                <ReviveToken
                  used={trainer.reviveUsed}
                  size="chip"
                  className="shrink-0"
                />
              </div>
            </div>
          </div>
        </Frame>
      )}

      <PokemonDetailsModal
        open={detailsPokemon != null}
        slug={challenge.slug}
        pokemon={detailsPokemon}
        showCompetitiveDetails={showCompetitiveDetails}
        onClose={() => setDetailsPokemon(null)}
      />
    </div>
  );
}
