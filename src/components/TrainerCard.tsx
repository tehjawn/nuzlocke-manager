"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { ReviveToken } from "@/components/ReviveToken";
import { StatusLine } from "@/components/StatusLine";
import { pokemonInSlot } from "@/lib/trainer-display";
import {
  avatarImageClassName,
  avatarImageUrl,
  pokemonSpriteUrl,
} from "@/lib/sprites";

type TrainerCardProps = {
  challenge: Challenge;
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
  const caughtCount =
    pokemonInSlot(trainer, "MAIN").length +
    pokemonInSlot(trainer, "RESERVE").length;
  const encounteredCount = pokemonInSlot(trainer, "ENCOUNTERED").length;
  const ripCount = pokemonInSlot(trainer, "GRAVEYARD").length;
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
  const boardLabel = `Open ${trainer.handle}'s board${isYou ? " (you)" : ""}`;

  return (
    <div
      data-tour={isDemo ? "demo-trainer" : undefined}
      className={isYou ? "trainer-you-ring" : undefined}
    >
      {variant === "grid" ? (
        <>
          {/*
            Compact card — below md. Mirrors the homepage carousel: avatar
            with the lead squad Pokémon peeking top-right, trainer name,
            then badge count.
          */}
          <Link
            href={boardHref}
            className="group block h-full md:hidden"
            aria-label={boardLabel}
          >
            <Frame dense className="h-full">
              <div className="flex h-full flex-col items-center text-center">
                <div className="relative flex h-28 w-full items-end justify-center">
                  {firstMon ? (
                    <Image
                      src={pokemonSpriteUrl(firstMon.species, {
                        shiny: firstMon.isShiny,
                        pokedexId: firstMon.pokedexId,
                      })}
                      alt=""
                      width={96}
                      height={96}
                      className="pixelated absolute top-0 left-1/2 h-16 w-16 -translate-x-[15%] object-contain opacity-80"
                      unoptimized
                    />
                  ) : null}
                  <Image
                    src={avatarImageUrl(trainer.avatarSpriteKey)}
                    alt=""
                    width={96}
                    height={96}
                    className={`${avatarImageClassName(trainer.avatarSpriteKey, "relative z-1 h-20 w-20")} drop-shadow-[0_6px_12px_var(--shadow-md)]`}
                    unoptimized
                  />
                </div>
                <p className="mt-1.5 w-full truncate text-sm font-bold leading-tight tracking-tight group-hover:text-accent-deep">
                  {trainer.handle}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {earnedCount} {earnedCount === 1 ? "badge" : "badges"}
                </p>
              </div>
            </Frame>
          </Link>

          {/* Full card — md and up; compact 3×2 squad grid */}
          <Frame className="hidden h-full md:block">
            <div className="flex h-full flex-col gap-2.5">
              <div className="grid min-h-0 flex-1 grid-cols-[6.5rem_minmax(0,1fr)] gap-3 lg:grid-cols-[7.5rem_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                  <Image
                    src={avatarImageUrl(trainer.avatarSpriteKey)}
                    alt=""
                    width={112}
                    height={112}
                    className={avatarImageClassName(
                      trainer.avatarSpriteKey,
                      "mx-auto h-20 w-20 lg:h-24 lg:w-24",
                    )}
                    unoptimized
                  />
                  <h2 className="w-full truncate text-sm font-bold leading-tight tracking-tight">
                    <Link
                      href={boardHref}
                      className="hover:text-accent-deep"
                      aria-label={`${trainer.handle}${isYou ? " (you)" : ""}`}
                    >
                      {trainer.handle}
                    </Link>
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
                      <PokemonHoverPreview key={mon.id} pokemon={mon} className="min-h-0">
                        <button
                          type="button"
                          title={label}
                          aria-label={`View ${label}`}
                          className="pressable flex aspect-square h-full min-h-0 w-full cursor-pointer items-center justify-center rounded-lg border border-frame/50 bg-surface-2 p-1 transition hover:border-interactive/60 hover:bg-interactive-soft/40"
                          onClick={() => setDetailsPokemon(mon)}
                        >
                          <Image
                            src={pokemonSpriteUrl(mon.species, {
                              shiny: mon.isShiny,
                              pokedexId: mon.pokedexId,
                            })}
                            alt={label}
                            width={96}
                            height={96}
                            className="pixelated h-full w-full max-h-14 object-contain lg:max-h-16"
                            unoptimized
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
        <Frame className="group transition-[border-color,box-shadow] duration-200 hover:border-interactive/45">
          {/*
            List layout:
            - <sm: identity + badges on one row, squad/stats/revive below
              (avoids clipping the 3×2 grid on narrow phones)
            - sm+: identity rail | badges + squad + footer (existing)
            Whole card opens the board; squad slots stay above the link.
          */}
          <Link
            href={boardHref}
            className="absolute inset-0 z-1"
            aria-label={boardLabel}
          />
          <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-start justify-between gap-2 sm:contents">
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:w-28 sm:flex-none sm:shrink-0 sm:items-center sm:text-center md:w-32">
                <Image
                  src={avatarImageUrl(trainer.avatarSpriteKey)}
                  alt=""
                  width={112}
                  height={112}
                  className={avatarImageClassName(
                    trainer.avatarSpriteKey,
                    "h-14 w-14 shrink-0 sm:h-24 sm:w-24 md:h-28 md:w-28",
                  )}
                  unoptimized
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

              <div className="max-w-[58%] shrink-0 sm:hidden">
                <BadgeCase
                  badges={challenge.badges}
                  earnedKeys={trainer.earnedBadgeKeys}
                  strip
                  className="justify-end"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="hidden sm:block">
                <BadgeCase
                  badges={challenge.badges}
                  earnedKeys={trainer.earnedBadgeKeys}
                  strip
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
                {Array.from({ length: 6 }).map((_, i) => {
                  const mon = main.find((p) => p.partyIndex === i);
                  if (!mon) {
                    return (
                      <div
                        key={`slot-${i}`}
                        className="flex h-[5.25rem] items-center justify-center rounded-lg border border-dashed border-frame/40 bg-surface-2/50 sm:h-24"
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
                      className="relative z-2"
                    >
                      <button
                        type="button"
                        title={label}
                        aria-label={`View ${label}`}
                        className="pressable group/slot flex h-[5.25rem] w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-frame/50 bg-surface-2 px-1 py-1 transition hover:border-interactive/60 hover:bg-interactive-soft/40 sm:h-24"
                        onClick={() => setDetailsPokemon(mon)}
                      >
                        <Image
                          src={pokemonSpriteUrl(mon.species, {
                            shiny: mon.isShiny,
                            pokedexId: mon.pokedexId,
                          })}
                          alt={label}
                          width={80}
                          height={80}
                          className="pixelated h-12 w-12 object-contain sm:h-14 sm:w-14"
                          unoptimized
                        />
                        <span className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-tight text-muted group-hover/slot:text-ink">
                          {label}
                        </span>
                      </button>
                    </PokemonHoverPreview>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <p className="min-w-0 truncate text-xs text-muted">
                  {caughtCount} caught • {encounteredCount} encountered •{" "}
                  {ripCount} R.I.P.
                  {(trainer.wipeCount ?? 0) > 0
                    ? ` • ${trainer.wipeCount} wipe${trainer.wipeCount === 1 ? "" : "s"}`
                    : ""}
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
        pokemon={detailsPokemon}
        showCompetitiveDetails={showCompetitiveDetails}
        onClose={() => setDetailsPokemon(null)}
      />
    </div>
  );
}
