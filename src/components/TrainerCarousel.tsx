"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";

export type CarouselTrainer = {
  id: string;
  handle: string;
  realName: string | null;
  avatarSpriteKey: string;
  avatarBackgroundKey: string | null;
  badgeCount: number;
  leadPokemon: {
    species: string;
    nickname: string | null;
    pokedexId: number | null;
    isShiny: boolean;
  } | null;
};

type TrainerCarouselProps = {
  challengeSlug: string;
  trainers: CarouselTrainer[];
};

/** Seconds to scroll one trainer card — keeps px/s stable as roster grows. */
const SECONDS_PER_TRAINER = 3.5;
/** Split into opposite-direction rows once the roster hits this size. */
const DUAL_CAROUSEL_MIN = 12;
/**
 * Minimum cards in one animation half so a ~2560px viewport stays filled
 * (card ~160px + gap ~56px). Extra copies still apply for very short rosters.
 */
const MIN_LOOP_CARDS = 14;

function trainerLabel(trainer: CarouselTrainer): string {
  return trainer.realName
    ? `${trainer.handle} (${trainer.realName})`
    : trainer.handle;
}

function buildLoop(trainers: CarouselTrainer[]): CarouselTrainer[] {
  const copies = Math.max(4, Math.ceil(MIN_LOOP_CARDS / trainers.length));
  return Array.from({ length: copies }, () => trainers).flat();
}

type CarouselRowProps = {
  challengeSlug: string;
  trainers: CarouselTrainer[];
  direction: "forward" | "reverse";
  /** ~30% shorter cards when two rows share the homepage. */
  compact?: boolean;
};

function CarouselRow({
  challengeSlug,
  trainers,
  direction,
  compact = false,
}: CarouselRowProps) {
  const loop = buildLoop(trainers);
  // Two identical halves → seamless -50% translate loop.
  const track = [...loop, ...loop];
  const durationSec = Math.max(loop.length * SECONDS_PER_TRAINER, 24);

  return (
    <div
      className={`trainer-carousel relative overflow-hidden ${
        compact ? "py-1.5" : "py-3"
      }`}
    >
      <div
        className="trainer-carousel-fade pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28"
        aria-hidden
      />
      <div
        className="trainer-carousel-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28"
        aria-hidden
      />

      <div
        className={`trainer-carousel-track flex w-max ${
          compact ? "gap-8 sm:gap-11" : "gap-10 sm:gap-14"
        } ${direction === "reverse" ? "trainer-carousel-track-reverse" : ""}`}
        style={
          {
            "--carousel-duration": `${durationSec}s`,
          } as CSSProperties
        }
      >
        {track.map((trainer, index) => (
          <Link
            key={`${trainer.id}-${index}`}
            href={`/challenges/${challengeSlug}/trainers/${trainer.id}`}
            className={`group flex shrink-0 flex-col items-center text-center ${
              compact
                ? "w-[110px] sm:w-[125px]"
                : "w-[140px] sm:w-[160px]"
            }`}
            tabIndex={index >= loop.length ? -1 : undefined}
            aria-hidden={index >= loop.length ? true : undefined}
          >
            <div
              className={`relative flex w-full items-end justify-center ${
                compact
                  ? "h-[98px] sm:h-[112px]"
                  : "h-[140px] sm:h-[160px]"
              }`}
            >
              {trainer.leadPokemon ? (
                <PokemonSpriteImage
                  alt=""
                  className={`pixelated absolute top-1.5 left-1/2 -translate-x-[15%] object-contain opacity-80 transition-transform duration-300 group-hover:-translate-y-1 ${
                    compact
                      ? "h-14 w-14 sm:h-16 sm:w-16"
                      : "top-2 h-20 w-20 sm:h-24 sm:w-24"
                  }`}
                  height={96}
                  pokedexId={trainer.leadPokemon.pokedexId}
                  shiny={trainer.leadPokemon.isShiny}
                  species={trainer.leadPokemon.species}
                  width={96}
                />
              ) : null}
              <AvatarPortrait
                avatarSpriteKey={trainer.avatarSpriteKey}
                backgroundKey={trainer.avatarBackgroundKey}
                sizeClass={
                  compact
                    ? "relative z-[1] h-[62px] w-[62px] sm:h-[73px] sm:w-[73px]"
                    : "relative z-[1] h-[88px] w-[88px] sm:h-[104px] sm:w-[104px]"
                }
                width={96}
                height={96}
                imgClassName="drop-shadow-[0_8px_16px_var(--shadow-md)] transition-transform duration-300 group-hover:translate-y-[-2px]"
              />
            </div>
            <p
              className={`font-display truncate font-bold leading-tight group-hover:text-accent-deep ${
                compact
                  ? "mt-1.5 text-xs sm:text-sm"
                  : "mt-2 text-sm"
              }`}
            >
              {trainerLabel(trainer)}
            </p>
            <p
              className={`text-muted ${
                compact ? "mt-0.5 text-[11px]" : "mt-0.5 text-xs"
              }`}
            >
              {trainer.badgeCount}{" "}
              {trainer.badgeCount === 1 ? "badge" : "badges"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TrainerCarousel({
  challengeSlug,
  trainers,
}: TrainerCarouselProps) {
  if (trainers.length === 0) return null;

  const dual = trainers.length >= DUAL_CAROUSEL_MIN;
  const rows = dual
    ? (() => {
        const mid = Math.ceil(trainers.length / 2);
        return [
          { trainers: trainers.slice(0, mid), direction: "forward" as const },
          { trainers: trainers.slice(mid), direction: "reverse" as const },
        ];
      })()
    : [{ trainers, direction: "forward" as const }];

  // One full-bleed breakout for all rows — nesting breakouts inside a dual
  // wrapper made left-1/2 resolve against a shrink-wrapped parent and pinned
  // the carousel to the content column instead of the viewport edge.
  return (
    <div
      className="relative left-1/2 mt-12 w-screen max-w-[100vw] -translate-x-1/2 space-y-1"
      aria-label="Season trainers"
    >
      {rows.map((row) => (
        <CarouselRow
          key={row.direction}
          challengeSlug={challengeSlug}
          trainers={row.trainers}
          direction={row.direction}
          compact={dual}
        />
      ))}
    </div>
  );
}
