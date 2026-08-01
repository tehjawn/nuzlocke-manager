"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  DEFAULT_FX_PREFS,
  patchFxPrefs,
  readFxPrefs,
  subscribeFxPrefs,
} from "@/features/fx/fx-prefs";
import { usePokemonSpritePreference } from "@/features/preferences/PokemonSpritePreferenceProvider";
import {
  writePokemonSpritePreference,
  type PokemonSpritePreference,
} from "@/features/preferences/pokemon-sprite-prefs";
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";

export function PreferencesForm() {
  const fxPrefs = useSyncExternalStore(
    subscribeFxPrefs,
    readFxPrefs,
    getServerFxPrefs,
  );
  const spritePreference = usePokemonSpritePreference();
  const themePreference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    getServerThemePreference,
  );

  return (
    <div className="space-y-7">
      <PreferenceSection
        description="Use a light or dark palette, or follow this device."
        title="Theme"
      >
        <div
          aria-label="Theme"
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
        >
          {(["light", "dark", "system"] satisfies ThemePreference[]).map(
            (preference) => (
              <PreferenceChoice
                active={themePreference === preference}
                key={preference}
                label={themePreferenceLabel(preference)}
                onSelect={() => setThemePreference(preference)}
              />
            ),
          )}
        </div>
      </PreferenceSection>

      <PreferenceSection
        description="Play feedback for catches, badges, wipes, and other game events."
        title="Sound effects"
      >
        <div
          aria-label="Sound effects"
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
        >
          <PreferenceChoice
            active={fxPrefs.sfxEnabled}
            label="On"
            onSelect={() => patchFxPrefs({ sfxEnabled: true })}
          />
          <PreferenceChoice
            active={!fxPrefs.sfxEnabled}
            label="Off"
            onSelect={() => patchFxPrefs({ sfxEnabled: false })}
          />
        </div>
      </PreferenceSection>

      <PreferenceSection
        description="Choose the artwork used for Pokémon throughout the app."
        title="Pokémon sprites"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
          <div
            aria-label="Pokémon sprites"
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
          >
            {(["2d", "animated"] satisfies PokemonSpritePreference[]).map(
              (preference) => (
                <PreferenceChoice
                  active={spritePreference === preference}
                  key={preference}
                  label={preference === "2d" ? "2D" : "Animated"}
                  onSelect={() => writePokemonSpritePreference(preference)}
                />
              ),
            )}
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-frame/50 bg-surface-2 px-3 py-2 sm:flex-col sm:gap-1 sm:px-2">
            <PokemonSpriteImage
              alt="Pikachu sprite preference preview"
              className="pixelated h-14 w-14 object-contain"
              height={64}
              pokedexId={25}
              species="Pikachu"
              width={64}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Preview
            </span>
          </div>
        </div>
      </PreferenceSection>

      <p className="text-xs text-muted">
        Preferences save automatically on this device and apply immediately.
      </p>
    </div>
  );
}

function getServerFxPrefs() {
  return DEFAULT_FX_PREFS;
}

function getServerThemePreference(): ThemePreference {
  return "system";
}

function PreferenceSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-3 border-b border-frame/50 pb-7 last:border-b-0 last:pb-0">
      <div>
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function PreferenceChoice({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={`pressable flex min-h-11 items-center justify-center px-3 py-2 text-sm font-semibold ${
        active
          ? "border-interactive/50 bg-interactive-soft text-ink"
          : "border-frame bg-surface text-muted hover:border-interactive/40 hover:text-ink"
      }`}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      {label}
    </button>
  );
}

function themePreferenceLabel(preference: ThemePreference): string {
  switch (preference) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "system":
      return "System";
  }
}
