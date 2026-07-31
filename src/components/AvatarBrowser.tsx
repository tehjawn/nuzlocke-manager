"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  PokemonSpriteBrowser,
  TrainerSpriteBrowser,
} from "@/components/SpriteBrowser";
import {
  parseAvatarKey,
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
    parsed.kind === "pokemon" ? "pokemon" : "trainer",
  );

  // Don't invent a trainer draft for custom/pokemon values — Use stays disabled
  // until the user actually picks a sprite (avoids overwriting custom uploads).
  const selectedTrainer = parsed.kind === "trainer" ? parsed.key : null;
  const selectedPokedexId =
    parsed.kind === "pokemon" ? parsed.pokedexId : null;

  return (
    <Modal open title="Browse portraits" onClose={onClose} wide>
      <div
        role="group"
        aria-label="Avatar catalog"
        className="mb-4 flex gap-2"
      >
        <button
          type="button"
          aria-pressed={tab === "trainer"}
          className={`pressable rounded-lg px-3 py-2 font-display text-xs font-semibold tracking-tight ${
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
          className={`pressable rounded-lg px-3 py-2 font-display text-xs font-semibold tracking-tight ${
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
          selectedId={selectedPokedexId}
          onClose={onClose}
          onSelect={(entry) =>
            onSelect(pokemonAvatarKey(entry.pokedexId, entry.name))
          }
        />
      )}
    </Modal>
  );
}
