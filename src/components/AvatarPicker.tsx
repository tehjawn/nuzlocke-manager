"use client";

import Image from "next/image";
import { useState } from "react";
import {
  PokemonSpriteBrowser,
  TrainerSpriteBrowser,
} from "@/components/SpriteBrowser";
import { DEFAULT_TRAINER_SPRITES } from "@/lib/sprites";
import {
  avatarImageUrl,
  parseAvatarKey,
  pokemonAvatarKey,
  pokemonSpriteUrl,
  trainerAvatarKey,
  trainerSpriteUrl,
  type AvatarKind,
} from "@/lib/sprites";
import { findPokemonById } from "@/data/pokemon-index";

type AvatarPickerProps = {
  value: string;
  onChange: (avatarSpriteKey: string) => void;
};

const QUICK_TRAINERS = DEFAULT_TRAINER_SPRITES;
const QUICK_POKEMON_IDS = [252, 255, 258, 25, 6, 94, 254, 257, 260, 376];

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const parsed = parseAvatarKey(value);
  const [tab, setTab] = useState<AvatarKind>(parsed.kind);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [pokemonOpen, setPokemonOpen] = useState(false);

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
          className="pixelated h-[72px] w-[72px] rounded-xl border border-frame bg-surface-2 object-contain p-1"
          unoptimized
        />
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              className={`pressable rounded-xl px-3 py-2 font-display text-xs font-semibold tracking-tight ${
                tab === "trainer"
                  ? "bg-accent text-[var(--on-accent)]"
                  : "border border-frame bg-surface"
              }`}
              onClick={() => setTab("trainer")}
            >
              Trainer
            </button>
            <button
              type="button"
              className={`pressable rounded-xl px-3 py-2 font-display text-xs font-semibold tracking-tight ${
                tab === "pokemon"
                  ? "bg-accent text-[var(--on-accent)]"
                  : "border border-frame bg-surface"
              }`}
              onClick={() => setTab("pokemon")}
            >
              Pokémon
            </button>
          </div>
          <button
            type="button"
            className="pressable rounded-xl border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
            onClick={() =>
              tab === "trainer" ? setTrainerOpen(true) : setPokemonOpen(true)
            }
          >
            Browse all…
          </button>
        </div>
      </div>

      {tab === "trainer" ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {QUICK_TRAINERS.map((key) => {
            const selected =
              selectedTrainer === key && parsed.kind === "trainer";
            return (
              <button
                key={key}
                type="button"
                title={key}
                aria-label={`Choose ${key}`}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 ${
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
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {QUICK_POKEMON_IDS.map((id) => {
            const mon = findPokemonById(id);
            if (!mon) return null;
            const selected =
              parsed.kind === "pokemon" && selectedPokedexId === mon.pokedexId;
            return (
              <button
                key={mon.pokedexId}
                type="button"
                title={mon.name}
                aria-label={`Choose ${mon.name}`}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 ${
                  selected
                    ? "border-accent bg-accent/15"
                    : "border-frame bg-surface-2 hover:bg-accent/10"
                }`}
                onClick={() =>
                  onChange(pokemonAvatarKey(mon.pokedexId, mon.name))
                }
              >
                <Image
                  src={pokemonSpriteUrl(mon.name, {
                    pokedexId: mon.pokedexId,
                  })}
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
      )}

      <TrainerSpriteBrowser
        open={trainerOpen}
        selectedKey={selectedTrainer}
        onClose={() => setTrainerOpen(false)}
        onSelect={(key) => {
          onChange(trainerAvatarKey(key));
          setTab("trainer");
        }}
      />
      <PokemonSpriteBrowser
        open={pokemonOpen}
        selectedId={selectedPokedexId}
        onClose={() => setPokemonOpen(false)}
        onSelect={(entry) => {
          onChange(pokemonAvatarKey(entry.pokedexId, entry.name));
          setTab("pokemon");
        }}
      />
    </div>
  );
}
