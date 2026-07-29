"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { AvatarBrowser } from "@/components/AvatarBrowser";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { CustomAvatarModal } from "@/components/CustomAvatarModal";
import { CustomTextureModal } from "@/components/CustomTextureModal";
import {
  AVATAR_BACKGROUNDS,
  avatarBackgroundCustomUrl,
  isAvatarBackgroundKey,
} from "@/data/avatar-backgrounds";
import { cssTextureUrl } from "@/lib/custom-texture";
import { avatarImageClassName, avatarImageUrl } from "@/lib/sprites";

type AvatarPickerProps = {
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

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.5 1.5 14.5 4.5 5.75 13.25 2.5 13.5l.25-3.25L11.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 3 13 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function backdropLabel(value: string | null | undefined): string {
  if (!value) return "None";
  if (isAvatarBackgroundKey(value)) {
    return (
      AVATAR_BACKGROUNDS.find((bg) => bg.key === value)?.label ?? value
    );
  }
  if (avatarBackgroundCustomUrl(value)) return "Custom";
  return "None";
}

export function AvatarPicker({
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
  const showBackdrops = typeof onBackgroundChange === "function";
  const activeCustomBackdrop =
    backgroundKey && !isAvatarBackgroundKey(backgroundKey)
      ? backgroundKey
      : savedCustomBackdrop;
  const customBackdropUrl = avatarBackgroundCustomUrl(activeCustomBackdrop);
  const customBackdropSelected =
    backgroundKey != null && !isAvatarBackgroundKey(backgroundKey);
  const selectedBackdrop = backdropLabel(backgroundKey);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label="Browse avatars"
          title="Browse avatars"
          disabled={disabled}
          className="group relative shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={() => setBrowseOpen(true)}
        >
          <AvatarPortrait
            avatarSpriteKey={value}
            backgroundKey={backgroundKey}
            sizeClass="h-[72px] w-[72px]"
            width={72}
            height={72}
            className="rounded-lg border border-frame bg-surface-2/50"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-2 flex items-center justify-center rounded-lg bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <PencilIcon />
          </span>
        </button>

        <div className="flex min-w-0 flex-col gap-2">
          <button
            type="button"
            disabled={disabled}
            className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface px-3 py-2 text-left text-xs font-semibold tracking-tight disabled:opacity-60"
            onClick={() => setBrowseOpen(true)}
          >
            <BrowseIcon className="h-3.5 w-3.5 shrink-0 text-ink/70" />
            Browse Avatars
          </button>
          <button
            type="button"
            disabled={disabled}
            className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface-2 px-3 py-2 text-left text-xs font-semibold tracking-tight text-muted disabled:opacity-60"
            onClick={() => setImportOpen(true)}
          >
            <ImportIcon className="h-3.5 w-3.5 shrink-0" />
            Import Custom Avatar
          </button>
        </div>
      </div>

      {showBackdrops ? (
        <fieldset disabled={disabled} className="min-w-0">
          <legend className="mb-2 block text-sm font-bold text-muted">
            Avatar backdrop
          </legend>
          <div
            role="radiogroup"
            aria-label="Avatar backdrop"
            className="grid grid-cols-4 gap-2 sm:grid-cols-7"
          >
            {CURATED_BACKDROPS.map((option) => {
              const selected = backgroundKey === option.key;
              return (
                <button
                  key={option.key ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  disabled={disabled}
                  className={`avatar-bg-swatch pressable relative flex flex-col items-stretch overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${
                    selected
                      ? "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_35%,transparent)]"
                      : "border-frame/70 hover:border-interactive/55"
                  }`}
                  data-avatar-bg={option.key ?? undefined}
                  data-avatar-bg-none={option.key == null ? "" : undefined}
                  onClick={() => onBackgroundChange?.(option.key)}
                >
                  <span className="avatar-bg-swatch-preview relative flex h-12 w-full items-end justify-center pb-0.5">
                    <Image
                      src={avatarImageUrl(value)}
                      alt=""
                      width={36}
                      height={36}
                      className={`${avatarImageClassName(value, "relative z-1 h-9 w-9")}${
                        option.key == null ? " opacity-80" : ""
                      }`}
                      unoptimized
                    />
                    {selected ? (
                      <span
                        aria-hidden
                        className="absolute top-1 right-1 z-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-interactive text-white shadow-sm"
                      >
                        <CheckIcon />
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`truncate px-1 py-1 text-center text-[10px] font-semibold leading-tight ${
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
            {customBackdropUrl && activeCustomBackdrop ? (
              <button
                type="button"
                role="radio"
                aria-checked={customBackdropSelected}
                aria-label="Custom backdrop"
                disabled={disabled}
                className={`avatar-bg-swatch pressable relative flex flex-col items-stretch overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${
                  customBackdropSelected
                    ? "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_35%,transparent)]"
                    : "border-frame/70 hover:border-interactive/55"
                }`}
                data-avatar-bg="custom"
                style={
                  {
                    ["--avatar-bg-custom" as string]: cssTextureUrl(
                      customBackdropUrl,
                    ),
                  } as CSSProperties
                }
                onClick={() => onBackgroundChange?.(activeCustomBackdrop)}
              >
                <span className="avatar-bg-swatch-preview relative flex h-12 w-full items-end justify-center pb-0.5">
                  <Image
                    src={avatarImageUrl(value)}
                    alt=""
                    width={36}
                    height={36}
                    className={avatarImageClassName(
                      value,
                      "relative z-1 h-9 w-9",
                    )}
                    unoptimized
                  />
                  {customBackdropSelected ? (
                    <span
                      aria-hidden
                      className="absolute top-1 right-1 z-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-interactive text-white shadow-sm"
                    >
                      <CheckIcon />
                    </span>
                  ) : null}
                </span>
                <span
                  className={`truncate px-1 py-1 text-center text-[10px] font-semibold leading-tight ${
                    customBackdropSelected
                      ? "bg-interactive text-white"
                      : "bg-surface-2/95 text-ink"
                  }`}
                >
                  Custom
                </span>
              </button>
            ) : null}
          </div>
          <button
            type="button"
            disabled={disabled}
            className="pressable mt-2 inline-flex items-center gap-2 rounded-lg border border-frame bg-surface-2 px-3 py-2 text-left text-xs font-semibold tracking-tight text-muted disabled:opacity-60"
            onClick={() => setBackdropImportOpen(true)}
          >
            <ImportIcon className="h-3.5 w-3.5 shrink-0" />
            {customBackdropUrl
              ? "Replace custom backdrop"
              : "Import custom backdrop"}
          </button>
          <p className="mt-2 text-xs text-muted" aria-live="polite">
            Backdrop:{" "}
            <span className="font-semibold text-ink">{selectedBackdrop}</span>
            {" · "}
            Sits behind your avatar on cards and your board.
          </p>
        </fieldset>
      ) : null}

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
      {showBackdrops ? (
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
      ) : null}
    </div>
  );
}
