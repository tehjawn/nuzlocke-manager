import Link from "next/link";
import { Frame } from "@/components/Frame";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
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
    <div className="space-y-5">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Across every wipe
        </p>
        <h2 className="text-2xl font-bold tracking-tight">Memorial</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Every fallen partner from {challenge.name}
          {challenge.status === "ARCHIVED" ? " — season archived and read-only" : ""}
          , including losses carried through run restarts. Nicknames first;
          causes when known.
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
        <div className="space-y-4">
          {byTrainer.map(({ trainer, graves }) => {
            const wipes = trainer.wipeCount ?? 0;
            return (
              <Frame
                key={trainer.id}
                title={displayName(trainer)}
                tone="rip"
                dense
                actions={
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-white/75">
                      {graves.length} fallen
                      {wipes > 0
                        ? ` · ${wipes} wipe${wipes === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <Link
                      href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
                      className="text-xs font-bold text-white/90 underline-offset-2 hover:underline"
                    >
                      Board
                    </Link>
                  </div>
                }
              >
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {graves.map((pokemon) => {
                    const label = pokemon.nickname || pokemon.species;
                    return (
                      <li
                        key={pokemon.id}
                        className="flex gap-2 rounded-md border border-frame/35 bg-surface/65 p-2"
                      >
                        <div className="relative h-10 w-10 shrink-0">
                          <PokemonSpriteImage
                            alt=""
                            className="pixelated h-full w-full object-contain opacity-90"
                            height={40}
                            pokedexId={pokemon.pokedexId}
                            shiny={pokemon.isShiny}
                            species={pokemon.species}
                            width={40}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-display truncate text-xs font-bold leading-tight">
                            {label}
                            {pokemon.isShiny ? (
                              <span className="ml-0.5 text-accent-2" title="Shiny">
                                ✦
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] leading-tight text-muted">
                            {pokemon.species}
                            {pokemon.level != null ? ` · Lv.${pokemon.level}` : ""}
                          </p>
                          {pokemon.causeOfDeath ? (
                            <p
                              className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink/90"
                              title={pokemon.causeOfDeath}
                            >
                              {pokemon.causeOfDeath}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] italic text-muted">
                              Cause unknown
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Frame>
            );
          })}
        </div>
      )}
    </div>
  );
}
