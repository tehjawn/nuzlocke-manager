import Image from "next/image";
import Link from "next/link";
import type { Challenge, TrainerProfile } from "@/lib/challenge-types";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
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

  return (
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
          <h2 className="font-display text-lg font-bold leading-tight">
            <Link
              href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
              className="hover:text-accent-deep"
            >
              {displayName(trainer)}
            </Link>
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {trainer.statusText ?? "No status update yet."}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <ReviveToken used={trainer.reviveUsed} />
      </div>

      <div className="mt-4">
        <p className="mb-2 font-display text-xs font-bold tracking-wide text-muted uppercase">
          Badges
        </p>
        <BadgeCase
          badges={challenge.badges}
          earnedKeys={trainer.earnedBadgeKeys}
          compact
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 font-display text-xs font-bold tracking-wide text-muted uppercase">
          Main Squad
        </p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 6 }).map((_, i) => {
            const mon = main.find((p) => p.partyIndex === i) ?? main[i];
            return (
              <div
                key={mon?.id ?? `slot-${i}`}
                className="flex h-11 w-11 items-center justify-center rounded-sm border-2 border-frame bg-surface-2"
                title={mon ? mon.nickname || mon.species : "Empty"}
              >
                {mon ? (
                  <Image
                    src={pokemonSpriteUrl(mon.species, {
                      shiny: mon.isShiny,
                      pokedexId: mon.pokedexId,
                    })}
                    alt={mon.nickname || mon.species}
                    width={36}
                    height={36}
                    className="pixelated h-9 w-9 object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="text-muted/50">·</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>{deaths} in memorial</span>
        <Link
          href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
          className="pressable rounded-sm bg-accent px-3 py-1.5 font-display text-xs font-bold tracking-wide text-white uppercase"
        >
          Open board
        </Link>
      </div>
    </Frame>
  );
}
