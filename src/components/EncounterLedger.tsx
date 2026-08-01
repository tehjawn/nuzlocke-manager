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
      <Frame title="No routes logged yet">
        <p className="text-sm text-muted">
          When trainers set a catch route on a Pokémon, that claim shows up here
          so the pack can see who locked which area.
        </p>
      </Frame>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Frame
          key={group.route}
          title={group.route}
          actions={
            <span className="text-xs font-semibold text-white/80">
              {group.claims.length} claim{group.claims.length === 1 ? "" : "s"}
            </span>
          }
        >
          <ul className="divide-y divide-frame/50">
            {group.claims.map((claim) => (
              <li
                key={claim.pokemonId}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <PokemonSpriteImage
                  alt=""
                  className={`pixelated h-10 w-10 object-contain ${
                    claim.isAlive ? "" : "opacity-50 grayscale"
                  }`}
                  height={40}
                  pokedexId={claim.pokedexId}
                  shiny={claim.isShiny}
                  species={claim.species}
                  width={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {claim.nickname?.trim() || claim.species}
                    {claim.nickname?.trim() ? (
                      <span className="ml-1 font-normal text-muted">
                        ({claim.species})
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    <Link
                      href={`/challenges/${slug}/trainers/${claim.trainerId}`}
                      className="font-medium hover:text-ink"
                    >
                      {claim.trainerHandle}
                    </Link>
                    {" · "}
                    {slotLabel(claim.slot)}
                    {!claim.isAlive ? " · fallen" : ""}
                  </p>
                </div>
              </li>
            ))}
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
