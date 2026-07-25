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
};

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[11px] font-semibold tracking-tight text-muted">
        {label}
      </dt>
      <dd>
        <span className="info-chip text-sm">{value}</span>
      </dd>
    </div>
  );
}

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
  const battleMax = calcMaxBattleStats({
    pokedexId: pokemon.pokedexId,
    level: pokemon.level,
  });
  const moves = pokemon.moves.map(resolveMoveName).filter(Boolean);
  const ivs = pokemon.ivs;
  const evs = pokemon.evs;
  const showIvs = !isEmptySpread(ivs);
  const showEvs = !isEmptySpread(evs);

  return (
    <Modal open title={label} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-frame bg-surface-2 sm:h-40 sm:w-40">
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
          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-semibold tracking-tight text-muted">
                Name
              </p>
              <p className="mt-1">
                <span className="info-chip text-base font-semibold">{label}</span>
              </p>
            </div>
            <p className="text-sm text-muted">
              {pokemon.species}
              {pokemon.level != null ? ` · Lv ${pokemon.level}` : ""}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pokemon.nature ? (
              <MetaRow label="Nature" value={pokemon.nature} />
            ) : null}
            {pokemon.ability ? (
              <MetaRow label="Ability" value={pokemon.ability} />
            ) : null}
            {pokemon.catchRoute ? (
              <MetaRow label="Route" value={pokemon.catchRoute} />
            ) : null}
            {pokemon.heldItem ? (
              <MetaRow label="Item" value={pokemon.heldItem} />
            ) : null}
          </dl>

          {battle ? (
            <div>
              <p className="mb-1 text-xs font-semibold tracking-tight text-muted">
                Battle stats
              </p>
              <p className="mb-2 text-[11px] leading-snug text-muted">
                Value vs species max at this level.
              </p>
              <StatGrid spread={battle} maxSpread={battleMax} showMax />
            </div>
          ) : null}

          {showIvs && ivs ? (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-tight text-muted">
                IVs
              </p>
              <StatGrid spread={ivs} tone="iv" showMax />
            </div>
          ) : null}

          {showEvs && evs ? (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-tight text-muted">
                EVs
              </p>
              <StatGrid spread={evs} tone="ev" showMax />
            </div>
          ) : null}

          {moves.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-tight text-muted">
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

          {pokemon.causeOfDeath ? (
            <p className="border-t border-frame/20 pt-3 text-sm leading-relaxed text-muted italic">
              {pokemon.causeOfDeath}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
