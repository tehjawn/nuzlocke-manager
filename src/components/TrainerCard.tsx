"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { ReviveToken } from "@/components/ReviveToken";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";
import { avatarImageUrl, pokemonSpriteUrl } from "@/lib/sprites";

type TrainerCardProps = {
  challenge: Challenge;
  trainer: TrainerProfile;
};

export function TrainerCard({ challenge, trainer }: TrainerCardProps) {
  const main = pokemonInSlot(trainer, "MAIN").slice(0, 6);
  const deaths = pokemonInSlot(trainer, "GRAVEYARD").length;
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );

  return (
    <>
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
                <Link
                  href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
                  className="hover:text-accent-deep"
                >
                  {displayName(trainer)}
                </Link>
              </h2>
              <ReviveToken used={trainer.reviveUsed} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {trainer.statusText ?? "No status update yet."}
            </p>
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
            href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
            className="pressable rounded-lg border-accent/30 bg-accent px-3.5 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
          >
            Open board
          </Link>
        </div>
      </Frame>

      <PokemonDetailsModal
        open={detailsPokemon != null}
        pokemon={detailsPokemon}
        onClose={() => setDetailsPokemon(null)}
      />
    </>
  );
}
