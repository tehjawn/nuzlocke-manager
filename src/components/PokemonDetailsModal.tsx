"use client";

import Image from "next/image";
import { Modal } from "@/components/Modal";
import { StatGrid } from "@/components/StatGrid";
import { TypeBadge } from "@/components/TypeBadge";
import type { PokemonEntry } from "@/lib/challenge-types";
import { resolveMoveName } from "@/lib/move-names";
import { pokemonSpriteUrl } from "@/lib/sprites";
import {
  calcBattleStats,
  calcMaxBattleStats,
  isEmptySpread,
} from "@/lib/stats";

type PokemonDetailsModalProps = {
  open: boolean;
  pokemon: PokemonEntry | null;
  onClose: () => void;
  /** Own-board: switch into the edit form. */
  onEdit?: () => void;
};

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-frame/40 bg-surface-2 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold tracking-tight text-muted">
        {label}
      </p>
      <p className="truncate text-sm font-semibold leading-tight">{value}</p>
    </div>
  );
}

export function PokemonDetailsModal({
  open,
  pokemon,
  onClose,
  onEdit,
}: PokemonDetailsModalProps) {
  if (!open || !pokemon) return null;

  const nickname = pokemon.nickname?.trim() ?? "";
  const title = nickname || pokemon.species;
  const showSpeciesInSubtitle = Boolean(nickname);
  const sprite = pokemonSpriteUrl(pokemon.species, {
    shiny: pokemon.isShiny,
    pokedexId: pokemon.pokedexId,
  });
  const battle = calcBattleStats({
    pokedexId: pokemon.pokedexId,
    level: pokemon.level,
    ivs: pokemon.ivs,
    evs: pokemon.evs,
    nature: pokemon.nature,
  });
  const battleMax = calcMaxBattleStats({
    pokedexId: pokemon.pokedexId,
    level: pokemon.level,
  });
  const moves = pokemon.moves.map(resolveMoveName).filter(Boolean);
  const ivs = pokemon.ivs;
  const evs = pokemon.evs;
  const showIvs = !isEmptySpread(ivs);
  const showEvs = !isEmptySpread(evs);

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
    pokemon.nature ? { label: "Nature", value: pokemon.nature } : null,
    pokemon.ability ? { label: "Ability", value: pokemon.ability } : null,
    pokemon.catchRoute ? { label: "Route", value: pokemon.catchRoute } : null,
    pokemon.heldItem ? { label: "Item", value: pokemon.heldItem } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

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
              <Image
                src={sprite}
                alt=""
                width={144}
                height={144}
                className="pixelated h-28 w-28 object-contain sm:h-[85%] sm:w-[85%]"
                unoptimized
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
                    <dd className="truncate text-sm font-semibold leading-tight">
                      {row.value}
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
                    <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                      IVs
                    </p>
                    <StatGrid spread={ivs} tone="iv" />
                  </div>
                ) : null}
                {showEvs && evs ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                      EVs
                    </p>
                    <StatGrid spread={evs} tone="ev" />
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
                      {move}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {pokemon.causeOfDeath ? (
          <p className="border-t border-frame/20 pt-3 text-sm leading-relaxed text-muted italic">
            {pokemon.causeOfDeath}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
