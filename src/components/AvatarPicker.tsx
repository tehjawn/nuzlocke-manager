"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { AvatarBrowser } from "@/components/AvatarBrowser";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { CustomAvatarModal } from "@/components/CustomAvatarModal";
import { CustomTextureModal } from "@/components/CustomTextureModal";
import {
  AVATAR_BACKGROUNDS,
  avatarBackgroundCustomUrl,
  isAvatarBackgroundKey,
} from "@/data/avatar-backgrounds";
import { CURATED_PORTRAITS, isCuratedPortraitKey } from "@/data/curated-portraits";
import {
  avatarImageClassName,
  avatarImageUrl,
  parseAvatarKey,
} from "@/lib/sprites";

type AvatarPickerProps = {
  /** `portrait` picks the sprite; `stage` picks the plate behind it. */
  panel: "portrait" | "stage";
  value: string;
  onChange: (avatarSpriteKey: string) => void;
  backgroundKey?: string | null;
  onBackgroundChange?: (key: string | null) => void;
  /**
   * Last imported custom backdrop key, lifted by the parent so it survives
   * edit-mode remounts when the current selection is a curated preset.
   */
  savedCustomBackground?: string | null;
  onSavedCustomBackgroundChange?: (key: string | null) => void;
  disabled?: boolean;
};

const CURATED_BACKDROPS: Array<{ key: string | null; label: string }> = [
  { key: null, label: "None" },
  ...AVATAR_BACKGROUNDS.map((bg) => ({ key: bg.key, label: bg.label })),
];

/** Shared across portrait / stage / card art pickers. */
const TILE_GRID = "grid grid-cols-3 gap-2.5 sm:grid-cols-4";
const TILE_PREVIEW = "relative h-16 w-full sm:h-18";
const TILE_LABEL =
  "flex h-7 min-w-0 w-full items-center justify-center truncate px-1 text-center text-[11px] font-semibold leading-tight";
const TILE_SELECTED =
  "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_35%,transparent)]";
const TILE_IDLE = "border-frame/70 hover:border-interactive/55";
const TILE_BASE =
  "pressable relative flex flex-col items-stretch overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60";
const TILE_SPRITE = "relative z-1 aspect-square h-full w-auto";
/** Stage tiles render the real portrait box so they scale like the board. */
const STAGE_PORTRAIT = "aspect-square h-full";

function BrowseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="2.5"
        y="9"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="9"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
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

function PortraitOptionButton({
  label,
  ariaLabel,
  selected,
  disabled,
  onClick,
  children,
}: {
  label: string;
  ariaLabel?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={`${TILE_BASE} bg-surface ${selected ? TILE_SELECTED : TILE_IDLE}`}
      onClick={onClick}
    >
      <span
        className={`${TILE_PREVIEW} flex items-end justify-center bg-surface-2/60 p-0.5`}
      >
        {children}
        {selected ? (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 z-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-interactive text-white shadow-sm"
          >
            <CheckIcon />
          </span>
        ) : null}
      </span>
      <span
        className={`${TILE_LABEL} ${
          selected ? "bg-interactive text-white" : "bg-surface-2/95 text-ink"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function AvatarPicker({
  panel,
  value,
  onChange,
  backgroundKey = null,
  onBackgroundChange,
  savedCustomBackground,
  onSavedCustomBackgroundChange,
  disabled = false,
}: AvatarPickerProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [backdropImportOpen, setBackdropImportOpen] = useState(false);
  const [localSavedCustom, setLocalSavedCustom] = useState<string | null>(() =>
    backgroundKey && !isAvatarBackgroundKey(backgroundKey)
      ? backgroundKey
      : null,
  );
  const savedCustomBackdrop =
    savedCustomBackground !== undefined
      ? savedCustomBackground
      : localSavedCustom;
  const rememberCustomBackdrop = (key: string) => {
    onSavedCustomBackgroundChange?.(key);
    if (savedCustomBackground === undefined) {
      setLocalSavedCustom(key);
    }
  };
  const activeCustomBackdrop =
    backgroundKey && !isAvatarBackgroundKey(backgroundKey)
      ? backgroundKey
      : savedCustomBackdrop;
  const customBackdropUrl = avatarBackgroundCustomUrl(activeCustomBackdrop);
  const customBackdropSelected =
    backgroundKey != null && !isAvatarBackgroundKey(backgroundKey);

  if (panel === "portrait") {
    const parsed = parseAvatarKey(value);
    const customSelected = parsed.kind === "custom";
    const curatedSelected = isCuratedPortraitKey(value);

    return (
      <div className="space-y-3">
        <div
          role="radiogroup"
          aria-label="Suggested portraits"
          className={TILE_GRID}
        >
          {CURATED_PORTRAITS.map((option) => {
            const selected = value === option.key;
            return (
              <PortraitOptionButton
                key={option.key}
                label={option.label}
                selected={selected}
                disabled={disabled}
                onClick={() => onChange(option.key)}
              >
                <Image
                  src={avatarImageUrl(option.key)}
                  alt=""
                  width={56}
                  height={56}
                  className={avatarImageClassName(option.key, TILE_SPRITE)}
                  unoptimized
                />
              </PortraitOptionButton>
            );
          })}
          {customSelected ? (
            <PortraitOptionButton
              label="Custom"
              selected
              disabled={disabled}
              onClick={() => onChange(value)}
            >
              <Image
                src={avatarImageUrl(value)}
                alt=""
                width={56}
                height={56}
                className={avatarImageClassName(value, TILE_SPRITE)}
                unoptimized
              />
            </PortraitOptionButton>
          ) : null}
          {!curatedSelected && !customSelected ? (
            <PortraitOptionButton
              label="Current"
              selected
              disabled={disabled}
              onClick={() => onChange(value)}
            >
              <Image
                src={avatarImageUrl(value)}
                alt=""
                width={56}
                height={56}
                className={avatarImageClassName(value, TILE_SPRITE)}
                unoptimized
              />
            </PortraitOptionButton>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface px-3 py-2 text-left text-xs font-semibold tracking-tight disabled:opacity-60"
            onClick={() => setBrowseOpen(true)}
          >
            <BrowseIcon className="h-3.5 w-3.5 shrink-0 text-ink/70" />
            Browse trainers &amp; Pokémon
          </button>
          <button
            type="button"
            disabled={disabled}
            className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface-2 px-3 py-2 text-left text-xs font-semibold tracking-tight text-muted disabled:opacity-60"
            onClick={() => setImportOpen(true)}
          >
            <ImportIcon className="h-3.5 w-3.5 shrink-0" />
            Add your own
          </button>
        </div>

        <AvatarBrowser
          open={browseOpen}
          value={value}
          onClose={() => setBrowseOpen(false)}
          onSelect={(key) => {
            onChange(key);
            setBrowseOpen(false);
          }}
        />
        <CustomAvatarModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSelect={(key) => {
            onChange(key);
            setImportOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <div
        role="radiogroup"
        aria-label="Portrait stage"
        className={TILE_GRID}
      >
        {CURATED_BACKDROPS.map((option) => (
          <PortraitOptionButton
            key={option.key ?? "none"}
            label={option.label}
            selected={backgroundKey === option.key}
            disabled={disabled}
            onClick={() => onBackgroundChange?.(option.key)}
          >
            <AvatarPortrait
              avatarSpriteKey={value}
              backgroundKey={option.key}
              sizeClass={STAGE_PORTRAIT}
              width={72}
              height={72}
              imgClassName={option.key == null ? "opacity-80" : ""}
            />
          </PortraitOptionButton>
        ))}
        {customBackdropUrl && activeCustomBackdrop ? (
          <PortraitOptionButton
            label="Custom"
            ariaLabel="Custom stage"
            selected={customBackdropSelected}
            disabled={disabled}
            onClick={() => onBackgroundChange?.(activeCustomBackdrop)}
          >
            <AvatarPortrait
              avatarSpriteKey={value}
              backgroundKey={activeCustomBackdrop}
              sizeClass={STAGE_PORTRAIT}
              width={72}
              height={72}
            />
          </PortraitOptionButton>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface-2 px-3 py-2 text-left text-xs font-semibold tracking-tight text-muted disabled:opacity-60"
        onClick={() => setBackdropImportOpen(true)}
      >
        <ImportIcon className="h-3.5 w-3.5 shrink-0" />
        {customBackdropUrl ? "Replace your stage" : "Add your own"}
      </button>

      <CustomTextureModal
        open={backdropImportOpen}
        kind="avatar-bg"
        onClose={() => setBackdropImportOpen(false)}
        onSelect={(key) => {
          rememberCustomBackdrop(key);
          onBackgroundChange?.(key);
          setBackdropImportOpen(false);
        }}
      />
    </fieldset>
  );
}
