"use client";

import Image from "next/image";
import { Modal } from "@/components/Modal";
import { TypeBadge } from "@/components/TypeBadge";
import { resolveMoveName } from "@/data/pokemon-lookups";
import type { PokemonEntry } from "@/lib/challenge-types";
import { pokemonSpriteUrl } from "@/lib/sprites";
import {
  calcBattleStats,
  formatSpreadShort,
  isEmptySpread,
  STAT_KEYS,
  STAT_LABELS,
} from "@/lib/stats";

type PokemonDetailsModalProps = {
  open: boolean;
  pokemon: PokemonEntry | null;
  onClose: () => void;
};

export function PokemonDetailsModal({
  open,
  pokemon,
  onClose,
}: PokemonDetailsModalProps) {
  if (!open || !pokemon) return null;

  const label = pokemon.nickname || pokemon.species;
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
  const moves = pokemon.moves.map(resolveMoveName).filter(Boolean);

  return (
    <Modal open title={label} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-36 w-36 items-center justify-center rounded-sm border-2 border-frame bg-surface-2 sm:h-40 sm:w-40">
            <Image
              src={sprite}
              alt=""
              width={144}
              height={144}
              className="pixelated h-32 w-32 object-contain sm:h-36 sm:w-36"
              unoptimized
            />
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          {pokemon.isShiny ? (
            <p className="text-xs font-bold text-accent-2">Shiny ✦</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div>
            <p className="font-display text-xl font-extrabold leading-tight">
              {label}
            </p>
            <p className="text-sm text-muted">
              {pokemon.species}
              {pokemon.level != null ? ` · Lv ${pokemon.level}` : ""}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {pokemon.nature ? (
              <>
                <dt className="text-muted">Nature</dt>
                <dd>{pokemon.nature}</dd>
              </>
            ) : null}
            {pokemon.ability ? (
              <>
                <dt className="text-muted">Ability</dt>
                <dd>{pokemon.ability}</dd>
              </>
            ) : null}
            {pokemon.catchRoute ? (
              <>
                <dt className="text-muted">Route</dt>
                <dd>{pokemon.catchRoute}</dd>
              </>
            ) : null}
            {pokemon.heldItem ? (
              <>
                <dt className="text-muted">Item</dt>
                <dd>{pokemon.heldItem}</dd>
              </>
            ) : null}
          </dl>

          {battle ? (
            <div>
              <p className="mb-2 font-display text-xs font-bold tracking-wide text-muted uppercase">
                Stats
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STAT_KEYS.map((key) => (
                  <div
                    key={key}
                    className="rounded-sm border border-frame/30 bg-surface-2 px-2 py-1.5 text-center"
                  >
                    <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                      {STAT_LABELS[key]}
                    </p>
                    <p className="font-mono text-sm font-bold">{battle[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isEmptySpread(pokemon.ivs) || !isEmptySpread(pokemon.evs) ? (
            <dl className="grid grid-cols-1 gap-y-1.5 text-xs sm:grid-cols-2 sm:gap-x-3">
              {!isEmptySpread(pokemon.ivs) ? (
                <>
                  <dt className="text-muted">IVs</dt>
                  <dd className="font-mono">{formatSpreadShort(pokemon.ivs)}</dd>
                </>
              ) : null}
              {!isEmptySpread(pokemon.evs) ? (
                <>
                  <dt className="text-muted">EVs</dt>
                  <dd className="font-mono">{formatSpreadShort(pokemon.evs)}</dd>
                </>
              ) : null}
            </dl>
          ) : null}

          {moves.length > 0 ? (
            <div>
              <p className="mb-2 font-display text-xs font-bold tracking-wide text-muted uppercase">
                Moves
              </p>
              <ul className="grid grid-cols-2 gap-1.5">
                {moves.map((move) => (
                  <li
                    key={move}
                    className="rounded-sm border border-frame/30 bg-surface-2 px-2 py-1.5 text-sm"
                  >
                    {move}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pokemon.causeOfDeath ? (
            <p className="border-t-2 border-frame/20 pt-3 text-sm leading-relaxed text-muted italic">
              {pokemon.causeOfDeath}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
