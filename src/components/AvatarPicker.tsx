"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { SpeciesCombobox } from "@/components/SpeciesCombobox";
import { SPECIES_INDEX, type SpeciesInfo } from "@/data/species";
import {
  DEFAULT_TRAINER_SPRITES,
  avatarImageUrl,
  parseAvatarKey,
  pokemonAvatarKey,
  pokemonSpriteUrl,
  trainerAvatarKey,
  trainerSpriteUrl,
  type AvatarKind,
} from "@/lib/sprites";

const QUICK_POKEMON_IDS = [25, 6, 9, 94, 143, 149, 254, 257, 260, 282, 306, 376];

type AvatarPickerProps = {
  value: string;
  onChange: (avatarSpriteKey: string) => void;
};

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const parsed = parseAvatarKey(value);
  const [tab, setTab] = useState<AvatarKind>(parsed.kind);
  const [pokemonQuery, setPokemonQuery] = useState(
    parsed.kind === "pokemon" && !parsed.pokedexId ? parsed.species : "",
  );

  const quickPokemon = useMemo(
    () =>
      QUICK_POKEMON_IDS.map(
        (id) => SPECIES_INDEX.find((s) => s.pokedexId === id),
      ).filter((s): s is SpeciesInfo => Boolean(s)),
    [],
  );

  const selectedTrainer =
    parsed.kind === "trainer" ? parsed.key : trainerAvatarKey("brendan");
  const selectedPokedexId =
    parsed.kind === "pokemon" ? parsed.pokedexId : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Image
          src={avatarImageUrl(value)}
          alt=""
          width={72}
          height={72}
          className="pixelated h-[72px] w-[72px] rounded-sm border-2 border-frame bg-surface-2 object-contain p-1"
          unoptimized
        />
        <div className="flex gap-2">
          <button
            type="button"
            className={`pressable rounded-sm px-3 py-2 font-display text-xs font-bold tracking-wide uppercase ${
              tab === "trainer"
                ? "bg-accent text-white"
                : "bg-surface border-2 border-frame"
            }`}
            onClick={() => setTab("trainer")}
          >
            Trainer
          </button>
          <button
            type="button"
            className={`pressable rounded-sm px-3 py-2 font-display text-xs font-bold tracking-wide uppercase ${
              tab === "pokemon"
                ? "bg-accent text-white"
                : "bg-surface border-2 border-frame"
            }`}
            onClick={() => setTab("pokemon")}
          >
            Pokémon
          </button>
        </div>
      </div>

      {tab === "trainer" ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {DEFAULT_TRAINER_SPRITES.map((key) => {
            const selected = selectedTrainer === key && parsed.kind === "trainer";
            return (
              <button
                key={key}
                type="button"
                title={key}
                aria-label={`Choose ${key}`}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-sm border-2 p-2 ${
                  selected
                    ? "border-accent bg-accent/15"
                    : "border-frame bg-surface-2 hover:bg-accent/10"
                }`}
                onClick={() => onChange(trainerAvatarKey(key))}
              >
                <Image
                  src={trainerSpriteUrl(key)}
                  alt=""
                  width={48}
                  height={48}
                  className="pixelated h-12 w-12 object-contain"
                  unoptimized
                />
                <span className="truncate text-[10px] font-bold capitalize text-muted">
                  {key}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {quickPokemon.map((mon) => {
              const selected =
                parsed.kind === "pokemon" && selectedPokedexId === mon.pokedexId;
              return (
                <button
                  key={mon.pokedexId}
                  type="button"
                  title={mon.name}
                  aria-label={`Choose ${mon.name}`}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-sm border-2 p-2 ${
                    selected
                      ? "border-accent bg-accent/15"
                      : "border-frame bg-surface-2 hover:bg-accent/10"
                  }`}
                  onClick={() => onChange(pokemonAvatarKey(mon.pokedexId, mon.name))}
                >
                  <Image
                    src={pokemonSpriteUrl(mon.name, { pokedexId: mon.pokedexId })}
                    alt=""
                    width={48}
                    height={48}
                    className="pixelated h-12 w-12 object-contain"
                    unoptimized
                  />
                  <span className="truncate text-[10px] font-bold text-muted">
                    {mon.name}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-muted">
              Search any species
            </span>
            <SpeciesCombobox
              value={pokemonQuery}
              onChange={(species, meta) => {
                setPokemonQuery(species);
                if (meta) {
                  onChange(pokemonAvatarKey(meta.pokedexId, meta.name));
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
