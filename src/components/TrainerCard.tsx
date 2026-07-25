"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { ReviveToken } from "@/components/ReviveToken";
import { StatusLine } from "@/components/StatusLine";
import { CTA_PRIMARY_SM } from "@/lib/cta";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";
import {
  avatarImageClassName,
  avatarImageUrl,
  pokemonSpriteUrl,
} from "@/lib/sprites";

type TrainerCardProps = {
  challenge: Challenge;
  trainer: TrainerProfile;
  variant?: "list" | "grid";
};

export function TrainerCard({
  challenge,
  trainer,
  variant = "list",
}: TrainerCardProps) {
  const main = pokemonInSlot(trainer, "MAIN").slice(0, 6);
  const deaths = pokemonInSlot(trainer, "GRAVEYARD").length;
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );
  const boardHref = `/challenges/${challenge.slug}/trainers/${trainer.id}`;
  const isDemo = !trainer.userId;
  const firstMon = main.find((p) => p.partyIndex === 0) ?? main[0] ?? null;
  const earnedCount = trainer.earnedBadgeKeys.length;

  return (
    <div data-tour={isDemo ? "demo-trainer" : undefined}>
      {variant === "grid" ? (
        <>
          {/*
            Compact card — mobile two-column grid. Mirrors the homepage
            carousel: avatar with the lead squad Pokémon peeking top-right,
            trainer name, then badge count.
          */}
          <Link
            href={boardHref}
            className="group block h-full sm:hidden"
            aria-label={`Open ${trainer.handle}'s board`}
          >
            <Frame dense className="h-full">
              <div className="flex h-full flex-col items-center text-center">
                <div className="relative flex h-24 w-full items-end justify-center">
                  {firstMon ? (
                    <Image
                      src={pokemonSpriteUrl(firstMon.species, {
                        shiny: firstMon.isShiny,
                        pokedexId: firstMon.pokedexId,
                      })}
                      alt=""
                      width={96}
                      height={96}
                      className="pixelated absolute top-0 left-1/2 h-14 w-14 -translate-x-[15%] object-contain opacity-80"
                      unoptimized
                    />
                  ) : null}
                  <Image
                    src={avatarImageUrl(trainer.avatarSpriteKey)}
                    alt=""
                    width={96}
                    height={96}
                    className={`${avatarImageClassName(trainer.avatarSpriteKey, "relative z-[1] h-16 w-16")} drop-shadow-[0_6px_12px_var(--shadow-md)]`}
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

          {/* Full card — sm and up */}
          <Frame className="hidden h-full sm:block">
          <div className="grid h-full grid-cols-[6rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <Image
                src={avatarImageUrl(trainer.avatarSpriteKey)}
                alt=""
                width={72}
                height={72}
                className={avatarImageClassName(
                  trainer.avatarSpriteKey,
                  "mx-auto h-[4.5rem] w-[4.5rem]",
                )}
                unoptimized
              />
              <h2 className="w-full truncate text-sm font-bold leading-tight tracking-tight">
                <Link href={boardHref} className="hover:text-accent-deep">
                  {trainer.handle}
                </Link>
              </h2>
              {trainer.statusEmoji || trainer.statusText?.trim() ? (
                <StatusLine
                  emoji={trainer.statusEmoji}
                  text={trainer.statusText}
                  empty=""
                  className="w-full line-clamp-2 text-[11px] leading-snug text-muted"
                />
              ) : null}
              <div className="w-full min-w-0">
                <BadgeCase
                  badges={challenge.badges}
                  earnedKeys={trainer.earnedBadgeKeys}
                  strip
                  earnedOnly
                  earnedColumns={2}
                />
              </div>
            </div>

            <div className="grid min-h-[13.5rem] grid-cols-2 grid-rows-3 gap-2 sm:min-h-[16rem]">
              {Array.from({ length: 6 }).map((_, i) => {
                const mon = main.find((p) => p.partyIndex === i);
                if (!mon) {
                  return (
                    <div
                      key={`slot-${i}`}
                      className="flex min-h-0 items-center justify-center rounded-lg border border-dashed border-frame/40 bg-surface-2/50"
                      title="Empty"
                    >
                      <span className="text-muted/35">·</span>
                    </div>
                  );
                }
                const label = mon.nickname || mon.species;
                return (
                  <button
                    key={mon.id}
                    type="button"
                    title={label}
                    aria-label={`View ${label}`}
                    className="pressable flex min-h-0 cursor-pointer items-center justify-center rounded-lg border border-frame/50 bg-surface-2 p-1.5 transition hover:border-interactive/60 hover:bg-interactive-soft/40"
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
                      className="pixelated h-full w-full max-h-20 object-contain sm:max-h-24"
                      unoptimized
                    />
                  </button>
                );
              })}
            </div>
          </div>
          </Frame>
        </>
      ) : (
        <Frame>
          <div className="flex items-start gap-3">
            <Image
              src={avatarImageUrl(trainer.avatarSpriteKey)}
              alt=""
              width={64}
              height={64}
              className={avatarImageClassName(
                trainer.avatarSpriteKey,
                "h-16 w-16",
              )}
              unoptimized
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold leading-tight tracking-tight">
                  <Link href={boardHref} className="hover:text-accent-deep">
                    {displayName(trainer)}
                  </Link>
                </h2>
                <ReviveToken used={trainer.reviveUsed} />
              </div>
              <StatusLine
                emoji={trainer.statusEmoji}
                text={trainer.statusText}
                className="mt-1 line-clamp-2 text-sm text-muted"
              />
            </div>
          </div>

          <div className="mt-4">
            <BadgeCase
              badges={challenge.badges}
              earnedKeys={trainer.earnedBadgeKeys}
              strip
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold tracking-tight text-muted">
              Main Squad
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => {
                const mon = main.find((p) => p.partyIndex === i);
                if (!mon) {
                  return (
                    <div
                      key={`slot-${i}`}
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-frame/50 bg-surface-2/60"
                      title="Empty"
                    >
                      <span className="text-muted/40">·</span>
                    </div>
                  );
                }
                const label = mon.nickname || mon.species;
                return (
                  <button
                    key={mon.id}
                    type="button"
                    title={label}
                    aria-label={`View ${label}`}
                    className="pressable group flex aspect-square cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-frame bg-surface-2 p-1.5 transition hover:border-interactive/60 hover:bg-interactive-soft/40"
                    onClick={() => setDetailsPokemon(mon)}
                  >
                    <Image
                      src={pokemonSpriteUrl(mon.species, {
                        shiny: mon.isShiny,
                        pokedexId: mon.pokedexId,
                      })}
                      alt={label}
                      width={72}
                      height={72}
                      className="pixelated h-14 w-14 object-contain sm:h-16 sm:w-16"
                      unoptimized
                    />
                    <span className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-tight text-muted group-hover:text-ink">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>{deaths} in memorial</span>
            <Link
              href={boardHref}
              className={CTA_PRIMARY_SM}
            >
              Open board
            </Link>
          </div>
        </Frame>
      )}

      <PokemonDetailsModal
        open={detailsPokemon != null}
        pokemon={detailsPokemon}
        onClose={() => setDetailsPokemon(null)}
      />
    </div>
  );
}
