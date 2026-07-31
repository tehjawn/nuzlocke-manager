"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { ReviveToken } from "@/components/ReviveToken";
import { StatusLine } from "@/components/StatusLine";
import { pokemonInSlot } from "@/lib/trainer-display";
import { pokemonSpriteUrl } from "@/lib/sprites";

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
  const cardBg = trainer.cardBackgroundKey;
  const avatarBg = trainer.avatarBackgroundKey;

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
            aria-label={boardLabel}
            className="group block h-full md:hidden"
            href={boardHref}
          >
            <Frame
              cardBackgroundKey={cardBg}
              className="h-full transition-[border-color,box-shadow] duration-200 group-hover:border-interactive/45"
              dense
            >
              <div className="flex h-full flex-col items-center text-center">
                <div className="relative flex h-28 w-full items-end justify-center overflow-visible">
                  {firstMon ? (
                    <Image
                      src={pokemonSpriteUrl(firstMon.species, {
                        shiny: firstMon.isShiny,
                        pokedexId: firstMon.pokedexId,
                      })}
                      alt=""
                      width={96}
                      height={96}
                      className="pixelated absolute top-0 left-1/2 z-0 h-16 w-16 -translate-x-[15%] object-contain opacity-80"
                      unoptimized
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
        <Frame
          className="group transition-[border-color,box-shadow] duration-200 hover:border-interactive/45"
          cardBackgroundKey={cardBg}
        >          {/*
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
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 overflow-visible sm:w-28 sm:flex-none sm:shrink-0 sm:items-center sm:text-center md:w-32">
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
