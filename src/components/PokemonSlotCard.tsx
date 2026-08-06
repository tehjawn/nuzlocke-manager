import { BondHeart } from "@/components/BondHeart";
import { HeldItemLabel } from "@/components/HeldItemLabel";
import { InfoTip } from "@/components/InfoTip";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { StatGrid } from "@/components/StatGrid";
import {
  SurvivalSentimentCaption,
  SurvivalSentimentIcon,
} from "@/components/SurvivalPollChip";
import { TombstoneIcon } from "@/components/TombstoneIcon";
import { TypeBadge } from "@/components/TypeBadge";
import { abilityDescription } from "@/data/pokemon-lookups";
import type { PokemonEntry } from "@/lib/challenge-types";
import { catchTierHasChrome } from "@/lib/iv-quality";
import { moveTypeWashStyle } from "@/lib/move-meta";
import { resolveMoveName } from "@/lib/move-names";
import {
  resolveCatchTier,
  resolveTrainingTier,
} from "@/lib/pokemon-grades";
import {
  calcBattleStats,
  calcMaxBattleStats,
  isEmptySpread,
  natureEffectDescription,
} from "@/lib/stats";

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
   * Encounter ledger: sprite + species name + dex # (no nickname / battle stats).
   */
  speciesOnly?: boolean;
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
  speciesOnly = false,
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

  const label = speciesOnly
    ? pokemon.species
    : pokemon.nickname || pokemon.species;
  const battle = showCompetitiveDetails && !speciesOnly
    ? calcBattleStats({
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
        ivs: pokemon.ivs,
        evs: pokemon.evs,
        nature: pokemon.nature,
      })
    : null;
  const battleMax = showCompetitiveDetails && !speciesOnly
    ? calcMaxBattleStats({
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
      })
    : null;
  // Box / some memorial mons lack party level — battle formula can't run, but
  // IVs are still on the specimen and worth showing on the board card.
  const ivFallback =
    showCompetitiveDetails &&
    !speciesOnly &&
    !battle &&
    !isEmptySpread(pokemon.ivs)
      ? pokemon.ivs
      : null;
  const moves =
    showCompetitiveDetails && !speciesOnly
      ? pokemon.moves.map((m) => m.trim()).filter(Boolean)
      : [];
  const showStatColumn = Boolean(battle || ivFallback);
  // Tier chrome is public — it survives redaction on the entry itself, so it
  // does not ride on `showCompetitiveDetails` (which gates the numbers).
  const catchTier = speciesOnly ? null : resolveCatchTier(pokemon);
  const trainingTier = speciesOnly ? null : resolveTrainingTier(pokemon);
  const hasCatchChrome = catchTier !== null && catchTierHasChrome(catchTier);
  const tierRing = hasCatchChrome
    ? `pokemon-catch-ring pokemon-catch-ring--${catchTier}`
    : null;

  if (speciesOnly) {
    const encounter = (
      <div
        className={`flex h-full min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-frame bg-surface px-1.5 py-2 text-center ${
          memorial ? "opacity-90" : ""
        } ${looksInteractive ? "cursor-pointer transition hover:border-interactive/60 hover:bg-interactive-soft/30" : ""}`}
      >
        <PokemonSpriteImage
          alt=""
          className="pixelated h-14 w-14 shrink-0 object-contain"
          height={56}
          pokedexId={pokemon.pokedexId}
          shiny={pokemon.isShiny}
          species={pokemon.species}
          width={56}
        />
        <div className="w-full min-w-0 px-0.5">
          <p className="truncate text-[11px] font-bold leading-tight tracking-tight sm:text-xs">
            {label}
            {pokemon.isShiny ? (
              <span className="ml-0.5 text-accent-2" title="Shiny">
                ✦
              </span>
            ) : null}
          </p>
          {pokemon.pokedexId != null && pokemon.pokedexId > 0 ? (
            <p className="truncate font-mono text-[10px] leading-tight tabular-nums text-muted">
              #{formatEncounterDexNo(pokemon.pokedexId)}
            </p>
          ) : null}
        </div>
      </div>
    );
    if (!onSelect) return <article className="h-full">{encounter}</article>;
    return (
      <button
        type="button"
        className="h-full w-full cursor-pointer text-left"
        aria-label={
          pokemon.pokedexId != null && pokemon.pokedexId > 0
            ? `${pokemon.species}, Pokédex #${formatEncounterDexNo(pokemon.pokedexId)}`
            : pokemon.species
        }
        onClick={onSelect}
      >
        {encounter}
      </button>
    );
  }

  if (size === "sm") {
    const compact = (
      <div
        className={`flex h-full min-h-20 items-center gap-2 rounded-lg border border-frame bg-surface p-2 ${
          memorial ? "opacity-90" : ""
        } ${looksInteractive ? "cursor-pointer transition hover:border-interactive/60 hover:bg-interactive-soft/30" : ""}`}
      >
        <div
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
            hasCatchChrome
              ? `pokemon-catch-sprite pokemon-catch-sprite--${catchTier}`
              : "border-frame/50 bg-surface-2"
          }`}
        >
          <PokemonSpriteImage
            alt=""
            className="pixelated h-10 w-10 object-contain"
            height={48}
            pokedexId={pokemon.pokedexId}
            shiny={pokemon.isShiny}
            species={pokemon.species}
            width={48}
          />
          {pokemon.survivalPoll && pokemon.survivalPoll.total > 0 ? (
            <SurvivalSentimentIcon
              className="pokemon-survival-sentiment--corner-dense h-3 w-3"
              poll={pokemon.survivalPoll}
            />
          ) : null}
          {trainingTier !== null ? (
            <BondHeart
              className="pokemon-bond-heart--corner-dense h-3 w-3"
              tier={trainingTier}
            />
          ) : null}
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
      className={
        tierRing
          ? `${tierRing} h-full`
          : `pokemon-catch-ring pokemon-catch-ring--oof h-full`
      }
    >
      <div
        className={`flex h-full flex-col gap-3 rounded-lg border bg-surface p-3 ${
          tierRing ? "border-transparent" : "border-frame"
        } ${memorial ? "opacity-90" : ""} ${
          looksInteractive ? "cursor-pointer" : ""
        }`}
      >
      <div className="flex shrink-0 items-start gap-3">
        <div
          className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-surface-2 ${
            hasCatchChrome
              ? `pokemon-catch-sprite pokemon-catch-sprite--${catchTier}`
              : "border-frame"
          }`}
        >
          <PokemonSpriteImage
            alt=""
            className="pixelated h-20 w-20 object-contain"
            height={96}
            pokedexId={pokemon.pokedexId}
            shiny={pokemon.isShiny}
            species={pokemon.species}
            width={96}
          />
          {pokemon.survivalPoll && pokemon.survivalPoll.total > 0 ? (
            <SurvivalSentimentIcon
              className="pokemon-survival-sentiment--corner h-3.5 w-3.5"
              poll={pokemon.survivalPoll}
            />
          ) : null}
          {trainingTier !== null ? (
            <BondHeart
              className="pokemon-bond-heart--corner h-3.5 w-3.5"
              tier={trainingTier}
            />
          ) : null}
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
          {pokemon.survivalPoll && pokemon.survivalPoll.total > 0 ? (
            <SurvivalSentimentCaption
              className="justify-start text-left text-[11px] font-semibold tracking-tight"
              poll={pokemon.survivalPoll}
            />
          ) : null}
        </div>
      </div>

      <div
        className={`shrink-0 ${
          showStatColumn
            ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2.5"
            : ""
        }`}
      >
        <dl className="flex min-w-0 flex-col gap-1.5">
          {showCompetitiveDetails && pokemon.nature ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-tight text-muted">
                Nature
              </dt>
              <dd className="mt-0.5">
                <InfoTip
                  tip={natureEffectDescription(pokemon.nature)}
                  embedded={looksInteractive}
                  chipClassName="info-chip text-xs"
                >
                  {pokemon.nature}
                </InfoTip>
              </dd>
            </div>
          ) : null}
          {showCompetitiveDetails && pokemon.ability ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold tracking-tight text-muted">
                Ability
              </dt>
              <dd className="mt-0.5">
                <InfoTip
                  tip={abilityDescription(pokemon.ability) ?? ""}
                  embedded={looksInteractive}
                  chipClassName="info-chip max-w-full text-xs"
                >
                  {pokemon.ability}
                </InfoTip>
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
                <HeldItemLabel
                  name={pokemon.heldItem}
                  embedded
                  className="info-chip max-w-full text-xs"
                  iconSize={14}
                />
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
        ) : ivFallback ? (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold tracking-tight text-muted">
              IVs
              <span className="ml-1 font-medium text-muted/80">
                (no level on file)
              </span>
            </p>
            <StatGrid spread={ivFallback} tone="iv" compact />
          </div>
        ) : null}
      </div>

      {moves.length > 0 ? (
        <div className="mt-auto shrink-0">
          <p className="mb-1.5 text-[10px] font-semibold tracking-tight text-muted">
            Moves
          </p>
          <ul className="grid grid-cols-2 gap-1.5">
            {moves.map((move, index) => {
              const name = resolveMoveName(move) || move;
              return (
                <li
                  key={`${index}-${move}`}
                  className="truncate rounded-lg border border-frame/40 bg-info px-2 py-1.5 text-[11px] text-info-ink"
                  style={moveTypeWashStyle(move)}
                  title={name}
                >
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-auto" aria-hidden />
      )}

      {memorial && pokemon.causeOfDeath ? (
        <div className="shrink-0 border-t border-frame/20 pt-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <TombstoneIcon className="h-2.5 w-2.5 shrink-0" />
            Cause of death
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted italic">
            {pokemon.causeOfDeath}
          </p>
        </div>
      ) : null}
      </div>
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

function formatEncounterDexNo(id: number): string {
  if (id >= 10000) return String(id);
  return String(id).padStart(3, "0");
}
