import Link from "next/link";
import { Frame } from "@/components/Frame";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { EncounterSpeciesHighlight } from "@/lib/encounter-stats";
import { toolsHref } from "@/lib/tools-routes";

type EncounterRarityViewProps = {
  entries: EncounterSpeciesHighlight[];
  slug: string;
};

export function EncounterRarityView({
  entries,
  slug,
}: EncounterRarityViewProps) {
  const rarestCount = entries[0]?.count ?? 0;
  const rarestSpecies = entries.filter(
    (entry) => entry.count === rarestCount,
  ).length;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link
          className="inline-flex text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
          href={`/challenges/${slug}/encounters`}
        >
          ← Encounter ledger
        </Link>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-tight text-accent-deep">
            Season rarity ranking
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Rarest seen</h2>
          <p className="max-w-2xl text-sm text-muted">
            Every species on current trainer boards, ordered from fewest
            appearances to most. Zigzagoon is skipped with the main encounter
            rankings.
          </p>
          {entries.length > 0 && (
            <p className="text-xs text-muted">
              {entries.length} species ranked · {rarestSpecies} tied at x
              {rarestCount}
            </p>
          )}
        </div>
      </header>

      {entries.length === 0 ? (
        <Frame dense title="No ranked species yet">
          <p className="text-sm text-muted">
            Add Pokémon to trainer boards to build the season rarity ranking.
          </p>
        </Frame>
      ) : (
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => {
            const rank = rankingPosition(entries, index);
            return (
              <li key={`${entry.species}-${entry.pokedexId ?? "x"}`}>
                <Link
                  aria-label={`Open ${entry.species} in the Pokédex`}
                  className={`pressable flex h-full items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:border-interactive/40 hover:bg-interactive-soft/30 ${
                    entry.count === rarestCount
                      ? "border-accent/35 bg-accent/10"
                      : "border-frame/35 bg-surface/60"
                  }`}
                  href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
                  prefetch={false}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface/80 text-xs font-bold tabular-nums text-muted">
                    {rank}
                  </span>
                  <PokemonSpriteImage
                    alt=""
                    className="pixelated h-12 w-12 shrink-0 object-contain"
                    height={48}
                    loading="lazy"
                    pokedexId={entry.pokedexId}
                    species={entry.species}
                    width={48}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-bold leading-tight">
                      {entry.species}
                    </span>
                    <span className="block text-[11px] text-muted">
                      x{entry.count} across the season
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function rankingPosition(
  entries: EncounterSpeciesHighlight[],
  index: number,
): number {
  const count = entries[index]?.count;
  if (count == null) return index + 1;
  const firstAtCount = entries.findIndex((entry) => entry.count === count);
  return firstAtCount + 1;
}
