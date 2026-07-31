"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  PokemonSpriteBrowser,
  TrainerSpriteBrowser,
} from "@/components/SpriteBrowser";
import {
  parseAvatarKey,
  pokemonAnimatedAvatarKey,
  pokemonAvatarKey,
  trainerAvatarKey,
} from "@/lib/sprites";

type AvatarBrowserProps = {
  open: boolean;
  value: string;
  onClose: () => void;
  onSelect: (avatarSpriteKey: string) => void;
};

export function AvatarBrowser({
  open,
  value,
  onClose,
  onSelect,
}: AvatarBrowserProps) {
  if (!open) return null;
  return (
    <AvatarBrowserInner
      key={value}
      value={value}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

function AvatarBrowserInner({
  value,
  onClose,
  onSelect,
}: Omit<AvatarBrowserProps, "open">) {
  const parsed = parseAvatarKey(value);
  const [tab, setTab] = useState<"trainer" | "pokemon">(
    parsed.kind === "pokemon" || parsed.kind === "pokemon-ani"
      ? "pokemon"
      : "trainer",
  );
  const [pokemonMotion, setPokemonMotion] = useState<"still" | "animated">(
    parsed.kind === "pokemon-ani" ? "animated" : "still",
  );

  // Don't invent a trainer draft for custom/pokemon values — Use stays disabled
  // until the user actually picks a sprite (avoids overwriting custom uploads).
  const selectedTrainer = parsed.kind === "trainer" ? parsed.key : null;
  const selectedPokedexId =
    parsed.kind === "pokemon" || parsed.kind === "pokemon-ani"
      ? parsed.pokedexId
      : null;

  return (
    <Modal open title="Browse portraits" onClose={onClose} wide>
      <div
        role="group"
        aria-label="Avatar catalog"
        className="mb-3 flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          aria-pressed={tab === "trainer"}
          className={`pressable rounded-md px-2.5 py-1.5 font-display text-xs font-semibold tracking-tight ${
            tab === "trainer"
              ? "bg-accent text-[var(--on-accent)]"
              : "border border-frame bg-surface"
          }`}
          onClick={() => setTab("trainer")}
        >
          Trainers
        </button>
        <button
          type="button"
          aria-pressed={tab === "pokemon"}
          className={`pressable rounded-md px-2.5 py-1.5 font-display text-xs font-semibold tracking-tight ${
            tab === "pokemon"
              ? "bg-accent text-[var(--on-accent)]"
              : "border border-frame bg-surface"
          }`}
          onClick={() => setTab("pokemon")}
        >
          Pokémon
        </button>
      </div>

      {tab === "trainer" ? (
        <TrainerSpriteBrowser
          open
          embedded
          selectedKey={selectedTrainer}
          onClose={onClose}
          onSelect={(key) => onSelect(trainerAvatarKey(key))}
        />
      ) : (
        <PokemonSpriteBrowser
          open
          embedded
          showMotionFilter
          animated={pokemonMotion === "animated"}
          onAnimatedChange={(next) =>
            setPokemonMotion(next ? "animated" : "still")
          }
          selectedId={selectedPokedexId}
          onClose={onClose}
          onSelect={(entry) =>
            onSelect(
              pokemonMotion === "animated"
                ? pokemonAnimatedAvatarKey(entry.pokedexId, entry.name)
                : pokemonAvatarKey(entry.pokedexId, entry.name),
            )
          }
        />
      )}
    </Modal>
  );
}
