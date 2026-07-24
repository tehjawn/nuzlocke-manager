import Image from "next/image";
import type { PokemonEntry } from "@/lib/challenge-types";
import { TypeBadge } from "@/components/TypeBadge";
import { pokemonSpriteUrl } from "@/lib/sprites";

type PokemonSlotCardProps = {
  pokemon?: PokemonEntry | null;
  memorial?: boolean;
  size?: "sm" | "md";
};

export function PokemonSlotCard({
  pokemon,
  memorial = false,
  size = "md",
}: PokemonSlotCardProps) {
  if (!pokemon) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-sm border-2 border-dashed border-frame/40 bg-surface-2/60 text-muted ${
          size === "sm" ? "min-h-20 p-2" : "min-h-36 p-3"
        }`}
      >
        <span className="text-lg opacity-40" aria-hidden>
          ○
        </span>
        <span className="text-xs">Empty</span>
      </div>
    );
  }

  const sprite = pokemonSpriteUrl(pokemon.species, {
    shiny: pokemon.isShiny,
    pokedexId: pokemon.pokedexId,
  });
  const label = pokemon.nickname || pokemon.species;

  return (
    <article
      className={`rounded-sm border-2 border-frame bg-surface ${
        memorial ? "opacity-90" : ""
      } ${size === "sm" ? "p-2" : "p-3"}`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`relative shrink-0 ${size === "sm" ? "h-10 w-10" : "h-14 w-14"}`}
        >
          <Image
            src={sprite}
            alt=""
            width={size === "sm" ? 40 : 56}
            height={size === "sm" ? 40 : 56}
            className="pixelated h-full w-full object-contain"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-sm font-bold leading-tight">
            {label}
            {pokemon.isShiny ? (
              <span className="ml-1 text-accent-2" title="Shiny">
                ✦
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted">
            {pokemon.species}
            {pokemon.level != null ? ` · Lv ${pokemon.level}` : ""}
          </p>
          {size === "md" ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {pokemon.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {size === "md" ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          {pokemon.nature ? (
            <>
              <dt className="text-muted">Nature</dt>
              <dd>{pokemon.nature}</dd>
            </>
          ) : null}
          {pokemon.ability ? (
            <>
              <dt className="text-muted">Ability</dt>
              <dd className="truncate">{pokemon.ability}</dd>
            </>
          ) : null}
          {pokemon.catchRoute ? (
            <>
              <dt className="text-muted">Route</dt>
              <dd className="truncate">{pokemon.catchRoute}</dd>
            </>
          ) : null}
          {pokemon.heldItem ? (
            <>
              <dt className="text-muted">Item</dt>
              <dd className="truncate">{pokemon.heldItem}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {size === "md" && pokemon.moves.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-1">
          {pokemon.moves.map((move) => (
            <li
              key={move}
              className="rounded-sm border border-frame/30 bg-surface-2 px-1.5 py-1 text-[11px]"
            >
              {move}
            </li>
          ))}
        </ul>
      ) : null}

      {memorial && pokemon.causeOfDeath ? (
        <p className="mt-3 border-t-2 border-frame/20 pt-2 text-xs leading-relaxed text-muted italic">
          {pokemon.causeOfDeath}
        </p>
      ) : null}
    </article>
  );
}
