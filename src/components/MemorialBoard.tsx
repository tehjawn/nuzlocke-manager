import Link from "next/link";
import { AvatarPortrait } from "@/components/AvatarPortrait";
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
  const trainersById = new Map(
    challenge.trainers.map((trainer) => [trainer.id, trainer]),
  );

  function trainersForHighlight(
    highlight: { trainerIds: string[] } | null | undefined,
  ): TrainerProfile[] {
    if (!highlight) return [];
    return highlight.trainerIds
      .map((id) => trainersById.get(id))
      .filter((trainer): trainer is TrainerProfile => Boolean(trainer));
  }

  const heaviestTrainers = trainersForHighlight(highlights.heaviestMemorial);
  const wipeTrainers = trainersForHighlight(highlights.mostPartyWipes);
  const richestTrainers = trainersForHighlight(highlights.richest);
  const hasCallouts = Boolean(
    highlights.heaviestMemorial ||
      highlights.mostPartyWipes ||
      highlights.mostDeathProne ||
      highlights.richest,
  );

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

      {hasCallouts ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.heaviestMemorial ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Heaviest memorial
                {highlights.heaviestMemorial.tied ? " · tied" : ""}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                {heaviestTrainers.length > 0 ? (
                  <div className="flex shrink-0 items-end -space-x-2">
                    {heaviestTrainers.slice(0, 3).map((trainer) => (
                      <AvatarPortrait
                        key={trainer.id}
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-12 w-12"
                        width={48}
                        height={48}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">
                    {formatTiedLabels(highlights.heaviestMemorial.labels)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {highlights.heaviestMemorial.count} RIP
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {highlights.mostPartyWipes ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Most party wipes
                {highlights.mostPartyWipes.tied ? " · tied" : ""}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                {wipeTrainers.length > 0 ? (
                  <div className="flex shrink-0 items-end -space-x-2">
                    {wipeTrainers.slice(0, 3).map((trainer) => (
                      <AvatarPortrait
                        key={trainer.id}
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-12 w-12"
                        width={48}
                        height={48}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">
                    {formatTiedLabels(highlights.mostPartyWipes.labels)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {highlights.mostPartyWipes.count} wipe
                    {highlights.mostPartyWipes.count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {highlights.mostDeathProne ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Most death-prone Pokémon
                {highlights.mostDeathProne.tied ? " · tied" : ""}
              </p>
              <p className="mt-1 flex items-center gap-2.5 font-display text-sm font-bold leading-tight">
                <span className="relative inline-block h-12 w-12 shrink-0">
                  <PokemonSpriteImage
                    alt=""
                    className="pixelated h-full w-full object-contain"
                    height={48}
                    pokedexId={highlights.mostDeathProne.pokedexId}
                    species={highlights.mostDeathProne.species}
                    width={48}
                  />
                </span>
                <span className="min-w-0">
                  {highlights.mostDeathProne.species}
                  <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                    {highlights.mostDeathProne.count} RIP across the season
                  </span>
                </span>
              </p>
            </div>
          ) : null}
          {highlights.richest ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Richest
                {highlights.richest.tied ? " · tied" : ""}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                {richestTrainers.length > 0 ? (
                  <div className="flex shrink-0 items-end -space-x-2">
                    {richestTrainers.slice(0, 3).map((trainer) => (
                      <AvatarPortrait
                        key={trainer.id}
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-12 w-12"
                        width={48}
                        height={48}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">
                    {formatTiedLabels(highlights.richest.labels)}
                  </p>
                  <p className="text-[11px] text-muted">
                    ${highlights.richest.count.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
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
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {graves.map((pokemon) => {
                    const label = pokemon.nickname || pokemon.species;
                    return (
                      <li
                        key={pokemon.id}
                        className="flex gap-3 rounded-md border border-frame/35 bg-surface/65 p-2.5"
                      >
                        <div className="relative h-16 w-16 shrink-0">
                          <PokemonSpriteImage
                            alt=""
                            className="pixelated h-full w-full object-contain opacity-90"
                            height={64}
                            pokedexId={pokemon.pokedexId}
                            shiny={pokemon.isShiny}
                            species={pokemon.species}
                            width={64}
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
