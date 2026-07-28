import Image from "next/image";
import type { PokemonEntry } from "@/lib/challenge-types";
import { StatGrid } from "@/components/StatGrid";
import { TypeBadge } from "@/components/TypeBadge";
import { resolveMoveName } from "@/lib/move-names";
import { pokemonSpriteUrl } from "@/lib/sprites";
import { calcBattleStats, calcMaxBattleStats } from "@/lib/stats";

type PokemonSlotCardProps = {
  pokemon?: PokemonEntry | null;
  memorial?: boolean;
  size?: "sm" | "md";
  onSelect?: () => void;
  /**
   * Visual “tappable” affordance without wrapping in a <button>.
   * Use when a parent already provides the interactive surface (e.g. DnD).
   */
  interactive?: boolean;
  /** Soft hint under species line when the card is interactive. */
  selectHint?: string;
  /**
   * When false, hide nature / ability / battle stats / moves on md cards
   * (public board viewers).
   */
  showCompetitiveDetails?: boolean;
};

export function PokemonSlotCard({
  pokemon,
  memorial = false,
  size = "md",
  onSelect,
  interactive = false,
  selectHint,
  showCompetitiveDetails = true,
}: PokemonSlotCardProps) {
  const looksInteractive = Boolean(onSelect) || interactive;
  if (!pokemon) {
    const empty = (
      <div
        className={`flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-frame/40 bg-surface-2/60 text-muted ${
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
        className="h-full w-full cursor-pointer text-left"
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
  const battle = showCompetitiveDetails
    ? calcBattleStats({
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
        ivs: pokemon.ivs,
        evs: pokemon.evs,
        nature: pokemon.nature,
      })
    : null;
  const battleMax = showCompetitiveDetails
    ? calcMaxBattleStats({
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
      })
    : null;
  const moves = showCompetitiveDetails
    ? pokemon.moves.map(resolveMoveName).filter(Boolean)
    : [];

  if (size === "sm") {
    const compact = (
      <div
        className={`flex h-full min-h-20 items-center gap-2 rounded-lg border border-frame bg-surface p-2 ${
          memorial ? "opacity-90" : ""
        } ${looksInteractive ? "cursor-pointer transition hover:border-interactive/60 hover:bg-interactive-soft/30" : ""}`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-frame/50 bg-surface-2">
          <Image
            src={sprite}
            alt=""
            width={48}
            height={48}
            className="pixelated h-10 w-10 object-contain"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">
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
        </div>
      </div>
    );
    if (!onSelect) return <article className="h-full">{compact}</article>;
    return (
      <button
        type="button"
        className="h-full w-full cursor-pointer text-left"
        onClick={onSelect}
      >
        {compact}
      </button>
    );
  }

  const body = (
    <div
      className={`flex h-full flex-col gap-3 rounded-lg border border-frame bg-surface p-3 ${
        memorial ? "opacity-90" : ""
      } ${looksInteractive ? "cursor-pointer transition hover:border-interactive/60 hover:bg-interactive-soft/30" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-frame bg-surface-2">
          <Image
            src={sprite}
            alt=""
            width={96}
            height={96}
            className="pixelated h-20 w-20 object-contain"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <p className="truncate text-base font-bold leading-tight tracking-tight">
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
          </div>
          <div className="flex flex-wrap gap-1">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
      </div>

      <div
        className={
          battle
            ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2.5"
            : undefined
        }
      >
        <dl className="flex min-w-0 flex-col gap-1.5">
          {showCompetitiveDetails && pokemon.nature ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-tight text-muted">
                Nature
              </dt>
              <dd className="mt-0.5">
                <span className="info-chip text-xs">{pokemon.nature}</span>
              </dd>
            </div>
          ) : null}
          {showCompetitiveDetails && pokemon.ability ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-tight text-muted">
                Ability
              </dt>
              <dd className="mt-0.5">
                <span className="info-chip max-w-full truncate text-xs">
                  {pokemon.ability}
                </span>
              </dd>
            </div>
          ) : null}
          {pokemon.catchRoute ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-tight text-muted">
                Route
              </dt>
              <dd className="mt-0.5">
                <span className="info-chip max-w-full truncate text-xs">
                  {pokemon.catchRoute}
                </span>
              </dd>
            </div>
          ) : null}
          {pokemon.heldItem ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-tight text-muted">
                Item
              </dt>
              <dd className="mt-0.5">
                <span className="info-chip max-w-full truncate text-xs">
                  {pokemon.heldItem}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        {battle ? (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold tracking-tight text-muted">
              Battle stats
            </p>
            <StatGrid spread={battle} maxSpread={battleMax} compact />
          </div>
        ) : null}
      </div>

      {moves.length > 0 ? (
        <div className="mt-auto">
          <p className="mb-1.5 text-[10px] font-semibold tracking-tight text-muted">
            Moves
          </p>
          <ul className="grid grid-cols-2 gap-1.5">
            {moves.map((move, index) => (
              <li
                key={`${index}-${move}`}
                className="rounded-lg border border-frame/40 bg-info px-2 py-1.5 text-[11px] text-info-ink"
              >
                {move}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-auto" aria-hidden />
      )}

      {memorial && pokemon.causeOfDeath ? (
        <p className="border-t border-frame/20 pt-2 text-xs leading-relaxed text-muted italic">
          {pokemon.causeOfDeath}
        </p>
      ) : null}
    </div>
  );

  if (!onSelect) {
    return <article className="h-full">{body}</article>;
  }
  return (
    <button
      type="button"
      className="h-full w-full cursor-pointer text-left"
      onClick={onSelect}
    >
      {body}
    </button>
  );
}
