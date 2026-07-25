import Image from "next/image";
import Link from "next/link";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { Frame } from "@/components/Frame";
import { TypeBadge } from "@/components/TypeBadge";
import { pokemonSpriteUrl } from "@/lib/sprites";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";

type MemorialEntry = {
  trainer: TrainerProfile;
  pokemon: PokemonEntry;
};

type MemorialBoardProps = {
  challenge: Challenge;
};

export function MemorialBoard({ challenge }: MemorialBoardProps) {
  const entries: MemorialEntry[] = challenge.trainers
    .flatMap((trainer) =>
      pokemonInSlot(trainer, "GRAVEYARD").map((pokemon) => ({
        trainer,
        pokemon,
      })),
    )
    .sort((a, b) => {
      const byTrainer = a.trainer.sortOrder - b.trainer.sortOrder;
      if (byTrainer !== 0) return byTrainer;
      return a.pokemon.partyIndex - b.pokemon.partyIndex;
    });

  const byTrainer = challenge.trainers
    .map((trainer) => ({
      trainer,
      graves: pokemonInSlot(trainer, "GRAVEYARD"),
    }))
    .filter((row) => row.graves.length > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          End of season
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          Memorial
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Every fallen partner from {challenge.name}
          {challenge.status === "ARCHIVED" ? " — season archived and read-only" : ""}.
          Nicknames first; causes of death when known.
        </p>
        <p className="text-xs text-muted">
          {entries.length} memorialized · {byTrainer.length} trainers with losses
        </p>
      </header>

      {entries.length === 0 ? (
        <Frame title="R.I.P." tone="rip">
          <p className="text-sm text-muted">
            No graves yet. May it stay that way — or at least stay interesting.
          </p>
        </Frame>
      ) : (
        <div className="space-y-5">
          {byTrainer.map(({ trainer, graves }) => (
            <Frame
              key={trainer.id}
              title={displayName(trainer)}
              tone="rip"
              actions={
                <Link
                  href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
                  className="text-xs font-bold text-white/90 underline-offset-2 hover:underline"
                >
                  Board
                </Link>
              }
            >
              <ul className="grid gap-3 sm:grid-cols-2">
                {graves.map((pokemon) => {
                  const label = pokemon.nickname || pokemon.species;
                  const sprite = pokemonSpriteUrl(pokemon.species, {
                    shiny: pokemon.isShiny,
                    pokedexId: pokemon.pokedexId,
                  });
                  return (
                    <li
                      key={pokemon.id}
                      className="flex gap-3 rounded-xl border border-frame/40 bg-surface/70 p-3"
                    >
                      <div className="relative h-16 w-16 shrink-0">
                        <Image
                          src={sprite}
                          alt=""
                          width={64}
                          height={64}
                          className="pixelated h-full w-full object-contain opacity-90"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display truncate text-sm font-bold">
                          {label}
                          {pokemon.isShiny ? (
                            <span className="ml-1 text-accent-2" title="Shiny">
                              ✦
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted">
                          {pokemon.species}
                          {pokemon.level != null ? ` · Lv.${pokemon.level}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {pokemon.types.map((type) => (
                            <TypeBadge key={type} type={type} />
                          ))}
                        </div>
                        {pokemon.causeOfDeath ? (
                          <p className="mt-2 text-sm leading-snug text-ink">
                            {pokemon.causeOfDeath}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted italic">
                            Cause unknown
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Frame>
          ))}
        </div>
      )}
    </div>
  );
}
