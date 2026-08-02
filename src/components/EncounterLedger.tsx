import Link from "next/link";
import { Frame } from "@/components/Frame";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";

type EncounterLedgerProps = {
  slug: string;
  groups: EncounterRouteGroup[];
};

export function EncounterLedger({ slug, groups }: EncounterLedgerProps) {
  if (groups.length === 0) {
    return (
      <Frame title="No routes logged yet" dense>
        <p className="text-sm text-muted">
          When trainers set a catch route on a Pokémon, that claim shows up here
          so the pack can see who locked which area.
        </p>
      </Frame>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <Frame
          key={group.route}
          title={group.route}
          dense
          actions={
            <span className="text-[11px] font-semibold tabular-nums text-white/80">
              {group.claims.length} claim
              {group.claims.length === 1 ? "" : "s"}
            </span>
          }
        >
          <ul className="divide-y divide-frame/40">
            {group.claims.map((claim) => {
              const label = claim.nickname?.trim() || claim.species;
              const showSpecies =
                Boolean(claim.nickname?.trim()) &&
                claim.nickname!.trim() !== claim.species;
              return (
                <li
                  key={claim.pokemonId}
                  className="flex items-center gap-2 py-1 first:pt-0 last:pb-0"
                >
                  <PokemonSpriteImage
                    alt=""
                    className={`pixelated h-7 w-7 shrink-0 object-contain ${
                      claim.isAlive ? "" : "opacity-50 grayscale"
                    }`}
                    height={28}
                    pokedexId={claim.pokedexId}
                    shiny={claim.isShiny}
                    species={claim.species}
                    width={28}
                  />
                  <p className="min-w-0 flex-1 truncate text-xs leading-snug">
                    <span className="font-semibold">{label}</span>
                    {showSpecies ? (
                      <span className="text-muted"> ({claim.species})</span>
                    ) : null}
                    <span className="text-muted">
                      {" · "}
                      <Link
                        href={`/challenges/${slug}/trainers/${claim.trainerId}`}
                        className="font-medium hover:text-ink"
                      >
                        {claim.trainerHandle}
                      </Link>
                      {" · "}
                      {slotLabel(claim.slot)}
                      {!claim.isAlive ? " · fallen" : ""}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </Frame>
      ))}
    </div>
  );
}

function slotLabel(slot: EncounterRouteGroup["claims"][number]["slot"]): string {
  switch (slot) {
    case "MAIN":
      return "Main";
    case "RESERVE":
      return "Reserve";
    case "GRAVEYARD":
      return "R.I.P.";
    case "ENCOUNTERED":
      return "Encountered";
    default:
      return slot;
  }
}
