"use client";

import {
  CARD_BACKGROUNDS,
  type CardBackgroundKey,
} from "@/data/card-backgrounds";

type CardBackgroundPickerProps = {
  value: CardBackgroundKey | null;
  onChange: (key: CardBackgroundKey | null) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ key: CardBackgroundKey | null; label: string }> = [
  { key: null, label: "Default" },
  ...CARD_BACKGROUNDS.map((bg) => ({ key: bg.key, label: bg.label })),
];

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      aria-hidden
    >
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

export function CardBackgroundPicker({
  value,
  onChange,
  disabled = false,
}: CardBackgroundPickerProps) {
  const selectedLabel =
    OPTIONS.find((option) => option.key === value)?.label ?? "Default";

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 block text-sm font-bold text-muted">
        Card background
      </legend>
      <div
        role="radiogroup"
        aria-label="Card background"
        className="grid grid-cols-3 gap-2 sm:grid-cols-6"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key ?? "default"}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              disabled={disabled}
              className={`card-bg-swatch pressable relative flex flex-col items-stretch overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${
                selected
                  ? "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_35%,transparent)]"
                  : "border-frame/70 hover:border-interactive/55"
              }`}
              data-card-bg={option.key ?? undefined}
              data-card-bg-default={option.key == null ? "" : undefined}
              onClick={() => onChange(option.key)}
            >
              <span className="card-bg-swatch-preview relative block h-11 w-full">
                {selected ? (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 z-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-interactive text-white shadow-sm"
                  >
                    <CheckIcon />
                  </span>
                ) : null}
              </span>
              <span
                className={`truncate px-1.5 py-1 text-[10px] font-semibold leading-tight ${
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
      </div>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        Selected:{" "}
        <span className="font-semibold text-ink">{selectedLabel}</span>
        {" · "}
        Shows on your league board card. Save to keep it.
      </p>
    </fieldset>
  );
}
