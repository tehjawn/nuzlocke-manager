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
import { avatarImageUrl, pokemonSpriteUrl } from "@/lib/sprites";

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

  return (
    <>
      {variant === "grid" ? (
        <Frame className="h-full">
          <div className="grid h-full grid-cols-[7rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <div className="relative w-full">
                <Image
                  src={avatarImageUrl(trainer.avatarSpriteKey)}
                  alt=""
                  width={72}
                  height={72}
                  className="pixelated mx-auto h-[4.5rem] w-[4.5rem] object-contain"
                  unoptimized
                />
                <Link
                  href={boardHref}
                  aria-label={`Open ${trainer.handle}'s board`}
                  title="Open board"
                  className="pressable absolute top-0 right-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[var(--on-accent)] hover:brightness-105"
                >
                  <ArrowIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
              <h2 className="w-full truncate text-sm font-bold leading-tight tracking-tight">
                <Link href={boardHref} className="hover:text-accent-deep">
                  {trainer.statusEmoji ? (
                    <span className="mr-1" aria-hidden>
                      {trainer.statusEmoji}
                    </span>
                  ) : null}
                  {trainer.handle}
                </Link>
              </h2>
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
      ) : (
        <Frame>
          <div className="flex items-start gap-3">
            <Image
              src={avatarImageUrl(trainer.avatarSpriteKey)}
              alt=""
              width={64}
              height={64}
              className="pixelated h-16 w-16 object-contain"
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
    </>
  );
}

function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      aria-hidden
    >
      <path d="M7 17L17 7" strokeLinecap="round" />
      <path d="M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
