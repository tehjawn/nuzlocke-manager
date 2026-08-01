import Link from "next/link";
import { Frame } from "@/components/Frame";
import { MemorialCauseEditor } from "@/components/MemorialCauseEditor";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { memorialSeasonHighlights } from "@/lib/memorial-stats";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";

type MemorialEntry = {
  trainer: TrainerProfile;
  pokemon: PokemonEntry;
};

type MemorialBoardProps = {
  challenge: Challenge;
  /** Trainer IDs the viewer may edit causes for (owner / GM with lens). */
  editableTrainerIds?: string[];
};

function formatTiedLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

export function MemorialBoard({
  challenge,
  editableTrainerIds = [],
}: MemorialBoardProps) {
  const editable = new Set(editableTrainerIds);
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

  const highlights = memorialSeasonHighlights(challenge.trainers);

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Across every wipe
        </p>
        <h2 className="text-2xl font-bold tracking-tight">Memorial</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Every fallen partner from {challenge.name}
          {challenge.status === "ARCHIVED"
            ? " — season archived and read-only"
            : ""}
          , including losses carried through run restarts. Nicknames first;
          causes when known.
        </p>
        <p className="text-xs text-muted">
          {highlights.totalGraves} memorialized ·{" "}
          {highlights.trainersWithLosses} trainers with losses
        </p>
      </header>

      {entries.length > 0 &&
      (highlights.heaviestMemorial || highlights.mostMourned) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {highlights.heaviestMemorial ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Heaviest memorial
                {highlights.heaviestMemorial.tied ? " · tied" : ""}
              </p>
              <p className="mt-0.5 font-display text-sm font-bold leading-tight">
                {formatTiedLabels(highlights.heaviestMemorial.labels)}
              </p>
              <p className="text-[11px] text-muted">
                {highlights.heaviestMemorial.count} RIP
              </p>
            </div>
          ) : null}
          {highlights.mostMourned ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Most mourned
                {highlights.mostMourned.tied ? " · tied" : ""}
              </p>
              <p className="mt-0.5 flex items-center gap-2 font-display text-sm font-bold leading-tight">
                <span className="relative inline-block h-7 w-7 shrink-0">
                  <PokemonSpriteImage
                    alt=""
                    className="pixelated h-full w-full object-contain"
                    height={28}
                    pokedexId={highlights.mostMourned.pokedexId}
                    species={highlights.mostMourned.species}
                    width={28}
                  />
                </span>
                {highlights.mostMourned.species}
              </p>
              <p className="text-[11px] text-muted">
                {highlights.mostMourned.count} RIP across the season
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

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
                    <span className="text-[11px] font-semibold tabular-nums text-white/80">
                      {graves.length} RIP
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
                              <span
                                className="ml-0.5 text-accent-2"
                                title="Shiny"
                              >
                                ✦
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] leading-tight text-muted">
                            {pokemon.species}
                            {pokemon.level != null
                              ? ` · Lv.${pokemon.level}`
                              : ""}
                            {pokemon.diedOnRun != null
                              ? ` · Run ${pokemon.diedOnRun}`
                              : ""}
                          </p>
                          <MemorialCauseEditor
                            trainerId={trainer.id}
                            pokemonId={pokemon.id}
                            causeOfDeath={pokemon.causeOfDeath}
                            canEdit={editable.has(trainer.id)}
                          />
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
