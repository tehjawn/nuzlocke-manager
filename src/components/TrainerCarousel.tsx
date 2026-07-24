"use client";

import Image from "next/image";
import Link from "next/link";
import { avatarImageUrl, pokemonSpriteUrl } from "@/lib/sprites";

export type CarouselTrainer = {
  id: string;
  handle: string;
  realName: string | null;
  avatarSpriteKey: string;
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

function trainerLabel(trainer: CarouselTrainer): string {
  return trainer.realName
    ? `${trainer.handle} (${trainer.realName})`
    : trainer.handle;
}

export function TrainerCarousel({
  challengeSlug,
  trainers,
}: TrainerCarouselProps) {
  if (trainers.length === 0) return null;

  // Enough copies that a short roster still fills a wide viewport.
  const copies = Math.max(4, Math.ceil(8 / trainers.length));
  const loop = Array.from({ length: copies }, () => trainers).flat();
  // Two identical halves → seamless -50% translate loop.
  const track = [...loop, ...loop];

  return (
    <div className="trainer-carousel relative left-1/2 mt-12 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden py-4">
      <div
        className="trainer-carousel-fade pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28"
        aria-hidden
      />
      <div
        className="trainer-carousel-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28"
        aria-hidden
      />

      <div className="trainer-carousel-track flex w-max gap-10 sm:gap-14">
        {track.map((trainer, index) => (
          <Link
            key={`${trainer.id}-${index}`}
            href={`/challenges/${challengeSlug}/trainers/${trainer.id}`}
            className="group flex w-[140px] shrink-0 flex-col items-center text-center sm:w-[160px]"
            tabIndex={index >= loop.length ? -1 : undefined}
            aria-hidden={index >= loop.length ? true : undefined}
          >
            <div className="relative flex h-[140px] w-full items-end justify-center sm:h-[160px]">
              {trainer.leadPokemon ? (
                <Image
                  src={pokemonSpriteUrl(trainer.leadPokemon.species, {
                    shiny: trainer.leadPokemon.isShiny,
                    pokedexId: trainer.leadPokemon.pokedexId,
                  })}
                  alt=""
                  width={96}
                  height={96}
                  className="pixelated absolute top-2 left-1/2 h-20 w-20 -translate-x-[15%] object-contain opacity-80 transition-transform duration-300 group-hover:-translate-y-1 sm:h-24 sm:w-24"
                  unoptimized
                />
              ) : null}
              <Image
                src={avatarImageUrl(trainer.avatarSpriteKey)}
                alt=""
                width={96}
                height={96}
                className="pixelated relative z-[1] h-[88px] w-[88px] object-contain drop-shadow-[2px_3px_0_var(--shadow)] transition-transform duration-300 group-hover:translate-y-[-2px] sm:h-[104px] sm:w-[104px]"
                unoptimized
              />
            </div>
            <p className="font-display mt-2 truncate text-sm font-bold leading-tight group-hover:text-accent-deep">
              {trainerLabel(trainer)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {trainer.badgeCount}{" "}
              {trainer.badgeCount === 1 ? "badge" : "badges"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
