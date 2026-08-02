"use client";

import type { ReactNode } from "react";
import { HeldItemLabel } from "@/components/HeldItemLabel";
import { InfoTip } from "@/components/InfoTip";
import { Modal } from "@/components/Modal";
import { MoveLabel } from "@/components/MoveLabel";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { StatGrid } from "@/components/StatGrid";
import { TombstoneIcon } from "@/components/TombstoneIcon";
import { TypeBadge } from "@/components/TypeBadge";
import { abilityDescription } from "@/data/pokemon-lookups";
import type { PokemonEntry } from "@/lib/challenge-types";
import { summarizeIvs } from "@/lib/iv-quality";
import { recommendPlaystyle } from "@/lib/playstyle";
import {
  calcBattleStats,
  calcMaxBattleStats,
  isEmptySpread,
  natureEffectDescription,
} from "@/lib/stats";

type PokemonDetailsModalProps = {
  open: boolean;
  pokemon: PokemonEntry | null;
  onClose: () => void;
  /** Own-board: switch into the edit form. */
  onEdit?: () => void;
  /**
   * When false, hide nature / ability / battle stats / IVs / EVs / moves
   * (public viewers and league peek for other trainers).
   */
  showCompetitiveDetails?: boolean;
};

function MetaChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-frame/40 bg-surface-2 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold tracking-tight text-muted">
        {label}
      </p>
      <div className="text-sm font-semibold leading-tight">
        {typeof value === "string" ? (
          <p className="truncate">{value}</p>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function PlaystyleChips({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className="info-chip text-xs font-semibold">{primary}</span>
      {secondary ? (
        <span className="info-chip text-xs font-semibold text-muted">
          {secondary}
        </span>
      ) : null}
    </div>
  );
}

export function PokemonDetailsModal({
  open,
  pokemon,
  onClose,
  onEdit,
  showCompetitiveDetails = true,
}: PokemonDetailsModalProps) {
  if (!open || !pokemon) return null;

  const nickname = pokemon.nickname?.trim() ?? "";
  const title = nickname || pokemon.species;
  const showSpeciesInSubtitle = Boolean(nickname);
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
    ? pokemon.moves.map((m) => m.trim()).filter(Boolean)
    : [];
  const ivs = showCompetitiveDetails ? pokemon.ivs : null;
  const evs = showCompetitiveDetails ? pokemon.evs : null;
  const showIvs = !isEmptySpread(ivs);
  const showEvs = !isEmptySpread(evs);
  const ivSummary = showIvs ? summarizeIvs(ivs) : null;
  const playstyle = showCompetitiveDetails
    ? recommendPlaystyle({
        pokedexId: pokemon.pokedexId,
        nature: pokemon.nature,
        ability: pokemon.ability,
        ivs: showIvs ? ivs : null,
      })
    : null;

  const subtitleParts: string[] = [];
  if (showSpeciesInSubtitle) subtitleParts.push(pokemon.species);
  if (pokemon.level != null) subtitleParts.push(`Lv ${pokemon.level}`);
  const subtitleText = subtitleParts.join(" · ");
  const hasSubtitle =
    Boolean(subtitleText) || pokemon.isShiny;

  const subtitle = (
    <>
      {subtitleText}
      {pokemon.isShiny ? (
        <span className={subtitleText ? "ml-1.5 font-semibold text-accent-2" : "font-semibold text-accent-2"}>
          Shiny ✦
        </span>
      ) : null}
    </>
  );

  const meta = [
    showCompetitiveDetails && pokemon.nature
      ? {
          label: "Nature",
          value: (
            <InfoTip tip={natureEffectDescription(pokemon.nature)}>
              {pokemon.nature}
            </InfoTip>
          ),
        }
      : null,
    showCompetitiveDetails && pokemon.ability
      ? {
          label: "Ability",
          value: (
            <InfoTip tip={abilityDescription(pokemon.ability) ?? ""}>
              {pokemon.ability}
            </InfoTip>
          ),
        }
      : null,
    pokemon.catchRoute ? { label: "Route", value: pokemon.catchRoute } : null,
    pokemon.heldItem
      ? {
          label: "Item",
          value: <HeldItemLabel name={pokemon.heldItem} iconSize={18} />,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: ReactNode }>;

  return (
    <Modal
      open
      title={title}
      subtitle={hasSubtitle ? subtitle : undefined}
      onClose={onClose}
      size="md"
      headerActions={
        onEdit ? (
          <button
            type="button"
            className="pressable border-frame bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
            onClick={onEdit}
          >
            Edit
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start">
          {/* Identity rail — fills the old empty left column */}
          <div className="flex flex-col items-center gap-2 sm:items-stretch">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-lg border border-frame bg-surface-2 sm:mx-0 sm:h-auto sm:w-full sm:aspect-square">
              <PokemonSpriteImage
                alt=""
                className="pixelated h-28 w-28 object-contain sm:h-[85%] sm:w-[85%]"
                height={144}
                pokedexId={pokemon.pokedexId}
                shiny={pokemon.isShiny}
                species={pokemon.species}
                width={144}
              />
            </div>
            {pokemon.types.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                {pokemon.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            ) : null}
            {meta.length > 0 ? (
              <dl className="hidden w-full space-y-1.5 sm:block">
                {meta.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="text-[10px] font-semibold tracking-tight text-muted">
                      {row.label}
                    </dt>
                    <dd className="text-sm font-semibold leading-tight">
                      {typeof row.value === "string" ? (
                        <p className="truncate">{row.value}</p>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="min-w-0 space-y-4">
            {/* Mobile meta — desktop lives under the sprite */}
            {meta.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 sm:hidden">
                {meta.map((row) => (
                  <MetaChip
                    key={row.label}
                    label={row.label}
                    value={row.value}
                  />
                ))}
              </div>
            ) : null}

            {playstyle ? (
              <div>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-tight text-muted">
                    Playstyle
                  </p>
                  {pokemon.nature ? (
                    <p
                      className={`text-[10px] font-semibold tracking-tight ${
                        playstyle.natureAlignment === "helps"
                          ? "text-accent-deep"
                          : "text-muted"
                      }`}
                    >
                      {playstyle.natureAlignmentLabel}
                    </p>
                  ) : null}
                </div>
                <PlaystyleChips
                  primary={playstyle.primary}
                  secondary={playstyle.secondary}
                />
                <p className="mt-1.5 text-[11px] leading-snug text-muted">
                  {playstyle.tip}
                </p>
              </div>
            ) : null}

            {battle ? (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-tight text-muted">
                    Battle stats
                  </p>
                  <p className="text-[10px] text-muted">vs max at this level</p>
                </div>
                <StatGrid
                  spread={battle}
                  maxSpread={battleMax}
                  showMax
                  compact
                />
              </div>
            ) : null}

            {showIvs || showEvs ? (
              <div
                className={`grid gap-3 ${
                  showIvs && showEvs ? "sm:grid-cols-2" : ""
                }`}
              >
                {showIvs && ivs ? (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold tracking-tight text-muted">
                        IVs
                      </p>
                      {ivSummary?.headline ? (
                        <p
                          className={`text-[10px] font-semibold tracking-tight ${
                            ivSummary.cracked
                              ? "text-accent-2"
                              : "text-muted"
                          }`}
                        >
                          {ivSummary.headline}
                        </p>
                      ) : null}
                    </div>
                    <StatGrid spread={ivs} tone="iv" compact />
                  </div>
                ) : null}
                {showEvs && evs ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                      EVs
                    </p>
                    <StatGrid spread={evs} tone="ev" compact />
                  </div>
                ) : null}
              </div>
            ) : null}

            {moves.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                  Moves
                </p>
                <ul className="grid grid-cols-2 gap-1.5">
                  {moves.map((move, index) => (
                    <li
                      key={`${index}-${move}`}
                      className="rounded-lg border border-frame/40 bg-info px-2 py-1.5 text-sm text-info-ink"
                    >
                      <MoveLabel move={move} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {pokemon.causeOfDeath ? (
          <div className="border-t border-frame/20 pt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <TombstoneIcon className="h-3.5 w-3.5 shrink-0" />
              Cause of death
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted italic">
              {pokemon.causeOfDeath}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
