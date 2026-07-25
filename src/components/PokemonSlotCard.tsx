import Image from "next/image";
import type { PokemonEntry } from "@/lib/challenge-types";
import { TypeBadge } from "@/components/TypeBadge";
import { resolveMoveName } from "@/data/pokemon-lookups";
import { pokemonSpriteUrl } from "@/lib/sprites";
import {
  calcBattleStats,
  formatBattleStatsShort,
} from "@/lib/stats";

type PokemonSlotCardProps = {
  pokemon?: PokemonEntry | null;
  memorial?: boolean;
  size?: "sm" | "md";
  onSelect?: () => void;
  /** Soft hint under species line when the card is interactive. */
  selectHint?: string;
};

export function PokemonSlotCard({
  pokemon,
  memorial = false,
  size = "md",
  onSelect,
  selectHint,
}: PokemonSlotCardProps) {
  if (!pokemon) {
    const empty = (
      <div
        className={`flex h-full flex-col items-center justify-center rounded-sm border-2 border-dashed border-frame/40 bg-surface-2/60 text-muted ${
          size === "sm" ? "min-h-20 p-2" : "min-h-40 p-3"
        }`}
      >
        <span className="text-lg opacity-40" aria-hidden>
          ○
        </span>
        <span className="text-xs">{onSelect ? "Tap to add" : "Empty"}</span>
      </div>
    );
    if (!onSelect) return empty;
    return (
      <button
        type="button"
        className="h-full w-full text-left"
        onClick={onSelect}
      >
        {empty}
      </button>
    );
  }

  const sprite = pokemonSpriteUrl(pokemon.species, {
    shiny: pokemon.isShiny,
    pokedexId: pokemon.pokedexId,
  });
  const label = pokemon.nickname || pokemon.species;
  const battle = calcBattleStats({
    pokedexId: pokemon.pokedexId,
    level: pokemon.level,
    ivs: pokemon.ivs,
    evs: pokemon.evs,
    nature: pokemon.nature,
  });
  const moves = pokemon.moves.map(resolveMoveName).filter(Boolean);

  const body = (
    <div
      className={`flex h-full flex-col rounded-sm border-2 border-frame bg-surface ${
        memorial ? "opacity-90" : ""
      } ${
        size === "sm" ? "min-h-20 p-2" : "min-h-40 p-3"
      } ${onSelect ? "transition hover:border-accent-deep" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`relative shrink-0 ${size === "sm" ? "h-12 w-12" : "h-24 w-24"}`}
        >
          <Image
            src={sprite}
            alt=""
            width={size === "sm" ? 48 : 96}
            height={size === "sm" ? 48 : 96}
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
            {selectHint ? ` · ${selectHint}` : ""}
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
          {battle ? (
            <>
              <dt className="text-muted">Stats</dt>
              <dd className="truncate font-mono text-[10px]">
                {formatBattleStatsShort(battle)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {size === "md" && moves.length > 0 ? (
        <ul className="mt-auto grid grid-cols-2 gap-1 pt-3">
          {moves.map((move) => (
            <li
              key={move}
              className="rounded-sm border border-frame/30 bg-surface-2 px-1.5 py-1 text-[11px]"
            >
              {move}
            </li>
          ))}
        </ul>
      ) : size === "md" ? (
        <div className="mt-auto pt-3" aria-hidden />
      ) : null}

      {memorial && pokemon.causeOfDeath ? (
        <p className="mt-3 border-t-2 border-frame/20 pt-2 text-xs leading-relaxed text-muted italic">
          {pokemon.causeOfDeath}
        </p>
      ) : null}
    </div>
  );

  if (!onSelect) {
    return <article className="h-full">{body}</article>;
  }
  return (
    <button type="button" className="h-full w-full text-left" onClick={onSelect}>
      {body}
    </button>
  );
}
