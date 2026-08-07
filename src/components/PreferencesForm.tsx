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
                icon={themePreferenceIcon(preference)}
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
            icon={<SfxOnIcon />}
            label="On"
            onSelect={() => patchFxPrefs({ sfxEnabled: true })}
          />
          <PreferenceChoice
            active={!fxPrefs.sfxEnabled}
            icon={<SfxOffIcon />}
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
                  icon={
                    preference === "2d" ? (
                      <SpriteStillIcon />
                    ) : (
                      <SpriteAnimatedIcon />
                    )
                  }
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
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PreferenceChoice({
  active,
  icon,
  label,
  onSelect,
}: {
  active: boolean;
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={`pressable flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold ${
        active
          ? "border-interactive/50 bg-interactive-soft text-ink"
          : "border-frame bg-surface text-muted hover:border-interactive/40 hover:text-ink"
      }`}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      {icon && (
        <span className="shrink-0 opacity-90" aria-hidden>
          {icon}
        </span>
      )}
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

function themePreferenceIcon(preference: ThemePreference): ReactNode {
  switch (preference) {
    case "light":
      return <SunIcon />;
    case "dark":
      return <MoonIcon />;
    case "system":
      return <SystemIcon />;
  }
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="10" cy="10" r="3.25" />
      <path
        d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M15.3 4.7l-1.1 1.1M5.8 14.2l-1.1 1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M12.5 3.2A6.5 6.5 0 1016.8 12 5.2 5.2 0 0112.5 3.2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="2.5" y="3.5" width="15" height="10.5" rx="1.5" />
      <path d="M7 17h6M10 14v3" strokeLinecap="round" />
    </svg>
  );
}

function SfxOnIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8.25v3.5h2.75L10.5 15V5L6.25 8.25H3.5z"
        strokeLinejoin="round"
      />
      <path d="M13 7.5a3.2 3.2 0 010 5" strokeLinecap="round" />
      <path d="M14.75 5.5a5.5 5.5 0 010 9" strokeLinecap="round" />
    </svg>
  );
}

function SfxOffIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8.25v3.5h2.75L10.5 15V5L6.25 8.25H3.5z"
        strokeLinejoin="round"
      />
      <path d="M13.5 8l3 3M16.5 8l-3 3" strokeLinecap="round" />
    </svg>
  );
}

function SpriteStillIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <path d="M3.5 13.5l3.5-3 3 2.5 2.5-2 4 2.5" strokeLinejoin="round" />
    </svg>
  );
}

function SpriteAnimatedIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M8 7.5l5 2.5-5 2.5V7.5z" strokeLinejoin="round" />
    </svg>
  );
}
