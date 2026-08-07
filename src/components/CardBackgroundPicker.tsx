"use client";

import { useState, type CSSProperties } from "react";
import { CustomTextureModal } from "@/components/CustomTextureModal";
import {
  CARD_BACKGROUNDS,
  cardBackgroundCustomUrl,
  isCardBackgroundKey,
} from "@/data/card-backgrounds";
import { cssTextureUrl } from "@/lib/custom-texture";

type CardBackgroundPickerProps = {
  value: string | null;
  onChange: (key: string | null) => void;
  savedCustomBackground?: string | null;
  onSavedCustomBackgroundChange?: (key: string | null) => void;
  disabled?: boolean;
};

const CURATED: Array<{ key: string | null; label: string }> = [
  { key: null, label: "Default" },
  ...CARD_BACKGROUNDS.map((bg) => ({ key: bg.key, label: bg.label })),
];

/** Match portrait / stage picker tiles. */
const TILE_GRID = "grid grid-cols-3 gap-2.5 sm:grid-cols-4";
const TILE_PREVIEW = "relative h-16 w-full sm:h-18";
const TILE_LABEL =
  "flex h-7 min-w-0 w-full items-center justify-center truncate px-1 text-center text-[11px] font-semibold leading-tight";
const TILE_SELECTED =
  "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_35%,transparent)]";
const TILE_IDLE = "border-frame/70 hover:border-interactive/55";
const TILE_BASE =
  "pressable relative flex flex-col items-stretch overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60";

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <path
        d="M3.5 8.2 6.2 11l6.3-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImportIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 7 8 9.5 10.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CardBackgroundPicker({
  value,
  onChange,
  savedCustomBackground,
  onSavedCustomBackgroundChange,
  disabled = false,
}: CardBackgroundPickerProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [localSavedCustom, setLocalSavedCustom] = useState<string | null>(() =>
    value && !isCardBackgroundKey(value) ? value : null,
  );
  const savedCustom =
    savedCustomBackground !== undefined
      ? savedCustomBackground
      : localSavedCustom;
  const rememberCustom = (key: string) => {
    onSavedCustomBackgroundChange?.(key);
    if (savedCustomBackground === undefined) {
      setLocalSavedCustom(key);
    }
  };
  const activeCustom =
    value && !isCardBackgroundKey(value) ? value : savedCustom;
  const customUrl = cardBackgroundCustomUrl(activeCustom);
  const customSelected =
    value != null && !isCardBackgroundKey(value) && Boolean(customUrl);

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <div role="radiogroup" aria-label="Card art" className={TILE_GRID}>
        {CURATED.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key ?? "default"}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              disabled={disabled}
              className={`card-bg-swatch ${TILE_BASE} ${
                selected ? TILE_SELECTED : TILE_IDLE
              }`}
              data-card-bg={option.key ?? undefined}
              data-card-bg-default={option.key == null ? "" : undefined}
              onClick={() => onChange(option.key)}
            >
              <span className={`card-bg-swatch-preview ${TILE_PREVIEW} block`}>
                {selected && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 right-1.5 z-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-interactive text-white shadow-sm"
                  >
                    <CheckIcon />
                  </span>
                )}
              </span>
              <span
                className={`${TILE_LABEL} ${
                  selected
                    ? "bg-interactive text-white"
                    : "bg-surface-2/95 text-ink"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
        {customUrl && activeCustom && (
          <button
            type="button"
            role="radio"
            aria-checked={customSelected}
            aria-label="Custom card art"
            disabled={disabled}
            className={`card-bg-swatch ${TILE_BASE} ${
              customSelected ? TILE_SELECTED : TILE_IDLE
            }`}
            data-card-bg="custom"
            style={
              {
                ["--card-bg-custom" as string]: cssTextureUrl(customUrl),
              } as CSSProperties
            }
            onClick={() => onChange(activeCustom)}
          >
            <span className={`card-bg-swatch-preview ${TILE_PREVIEW} block`}>
              {customSelected && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 z-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-interactive text-white shadow-sm"
                >
                  <CheckIcon />
                </span>
              )}
            </span>
            <span
              className={`${TILE_LABEL} ${
                customSelected
                  ? "bg-interactive text-white"
                  : "bg-surface-2/95 text-ink"
              }`}
            >
              Custom
            </span>
          </button>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        className="pressable mt-3 inline-flex items-center gap-2 rounded-lg border border-frame bg-surface-2 px-3 py-2 text-left text-xs font-semibold tracking-tight text-muted disabled:opacity-60"
        onClick={() => setImportOpen(true)}
      >
        <ImportIcon className="h-3.5 w-3.5 shrink-0" />
        {customUrl ? "Replace your card art" : "Add your own"}
      </button>
      <CustomTextureModal
        open={importOpen}
        kind="card-bg"
        onClose={() => setImportOpen(false)}
        onSelect={(key) => {
          rememberCustom(key);
          onChange(key);
          setImportOpen(false);
        }}
      />
    </fieldset>
  );
}
