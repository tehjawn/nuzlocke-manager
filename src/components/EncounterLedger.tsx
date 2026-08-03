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
              {group.claims.length + group.flagClaims.length}
            </span>
          }
        >
          {group.kind === "catch-records" && (
            <p className="mb-2 text-xs text-muted">
              These catches only retain Modern Emerald&apos;s generic Safari met
              location. Import a current save to resolve their directional area.
            </p>
          )}
          {group.flagClaims.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1">
              {group.flagClaims.map((claim) => (
                <li
                  className="rounded-full border border-frame/40 bg-interactive-soft/40 px-2 py-1 text-[10px] font-semibold text-ink"
                  key={claim.trainerId}
                >
                  {claim.trainerHandle} · game encounter flag
                </li>
              ))}
            </ul>
          )}
          {group.claims.length > 0 && (
            <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {group.claims.map((claim) => {
                const label = claim.nickname?.trim() || claim.species;
                return (
                  <li key={claim.pokemonId}>
                    <Link
                      href={`/challenges/${slug}/trainers/${claim.trainerId}`}
                      title={`${label} · ${claim.trainerHandle} · ${slotLabel(claim.slot)}${
                        claim.isAlive ? "" : " · fallen"
                      }`}
                      aria-label={`${label} · ${claim.trainerHandle}${
                        claim.isAlive ? "" : " · fallen"
                      }`}
                      className="pressable flex h-full flex-col items-center gap-0.5 rounded-md border border-frame/30 bg-surface/40 px-1 py-1.5 text-center hover:border-interactive/40 hover:bg-interactive-soft/30"
                    >
                      <PokemonSpriteImage
                        alt=""
                        className={`pixelated h-12 w-12 object-contain sm:h-14 sm:w-14 ${
                          claim.isAlive ? "" : "opacity-50 grayscale"
                        }`}
                        height={56}
                        pokedexId={claim.pokedexId}
                        shiny={claim.isShiny}
                        species={claim.species}
                        width={56}
                      />
                      <span className="w-full truncate text-[11px] font-semibold leading-tight">
                        {label}
                      </span>
                      <span className="w-full truncate text-[9px] leading-tight text-muted">
                        {claim.trainerHandle}
                        {!claim.isAlive ? " · RIP" : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
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
