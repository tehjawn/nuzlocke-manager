"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { CardBackgroundPicker } from "@/components/CardBackgroundPicker";
import { StatusEmojiPicker } from "@/components/StatusEmojiPicker";
import { TrainerCard } from "@/components/TrainerCard";
import { avatarBackgroundLabel } from "@/data/avatar-backgrounds";
import {
  cardBackgroundCustomUrl,
  cardBackgroundLabel,
  isCardBackgroundKey,
} from "@/data/card-backgrounds";
import { formatTrainerSpriteLabel } from "@/data/trainer-sprites";
import { SPECIES_INDEX } from "@/data/species";
import type { BadgeDefinition, TrainerProfile } from "@/lib/challenge-types";
import { cssTextureUrl } from "@/lib/custom-texture";
import { parseAvatarKey } from "@/lib/sprites";

export type CustomizationTab = "portrait" | "stage" | "card" | "profile";

type LeaguePreview = {
  challengeSlug: string;
  badges: BadgeDefinition[];
  trainer: TrainerProfile;
};

type PlayerCustomizationEditorProps = {
  avatarSpriteKey: string;
  onAvatarChange: (key: string) => void;
  avatarBackgroundKey: string | null;
  onAvatarBackgroundChange: (key: string | null) => void;
  savedCustomAvatarBg: string | null;
  onSavedCustomAvatarBgChange: (key: string | null) => void;
  cardBackgroundKey: string | null;
  onCardBackgroundChange: (key: string | null) => void;
  savedCustomCardBg: string | null;
  onSavedCustomCardBgChange: (key: string | null) => void;
  handle: string;
  onHandleChange: (value: string) => void;
  realName: string;
  onRealNameChange: (value: string) => void;
  statusEmoji: string | null;
  onStatusEmojiChange: (value: string | null) => void;
  statusText: string;
  onStatusTextChange: (value: string) => void;
  discordUsername?: string | null;
  discordDisplayName?: string | null;
  disabled?: boolean;
  initialSection?: CustomizationTab;
  /** Live league-board card(s) so edits show up as they will on the roster. */
  leaguePreview?: LeaguePreview | null;
};

const SECTION_COPY: Record<CustomizationTab, { label: string; hint: string }> =
  {
    portrait: {
      label: "Portrait",
      hint: "Your trainer sprite, a Pokémon, or your own image.",
    },
    stage: {
      label: "Stage",
      hint: "The plate behind your portrait on the board and league cards.",
    },
    card: {
      label: "Card art",
      hint: "Chrome behind your league card — separate from the stage.",
    },
    profile: {
      label: "Profile",
      hint: "Nickname, real name, and the status shown on your board.",
    },
  };

const SECTION_ORDER: CustomizationTab[] = [
  "profile",
  "portrait",
  "stage",
  "card",
];

function portraitLabel(avatarSpriteKey: string): string {
  const parsed = parseAvatarKey(avatarSpriteKey);
  if (parsed.kind === "custom") return "Your image";
  if (parsed.kind === "trainer") return formatTrainerSpriteLabel(parsed.key);
  const named = parsed.pokedexId
    ? SPECIES_INDEX.find((s) => s.pokedexId === parsed.pokedexId)?.name
    : null;
  const base =
    named ??
    (parsed.pokedexId ? `Pokémon #${parsed.pokedexId}` : parsed.species);
  return parsed.kind === "pokemon-ani" ? `${base} · ani` : base;
}

export function PlayerCustomizationEditor({
  avatarSpriteKey,
  onAvatarChange,
  avatarBackgroundKey,
  onAvatarBackgroundChange,
  savedCustomAvatarBg,
  onSavedCustomAvatarBgChange,
  cardBackgroundKey,
  onCardBackgroundChange,
  savedCustomCardBg,
  onSavedCustomCardBgChange,
  handle,
  onHandleChange,
  realName,
  onRealNameChange,
  statusEmoji,
  onStatusEmojiChange,
  statusText,
  onStatusTextChange,
  discordUsername,
  discordDisplayName,
  disabled = false,
  initialSection = "profile",
  leaguePreview = null,
}: PlayerCustomizationEditorProps) {
  const [section, setSection] = useState<CustomizationTab>(initialSection);
  const baseId = useId();

  const customCardUrl = cardBackgroundCustomUrl(cardBackgroundKey);
  const cardDataAttr = isCardBackgroundKey(cardBackgroundKey)
    ? cardBackgroundKey
    : customCardUrl
      ? "custom"
      : undefined;

  const previewTrainer = leaguePreview
    ? {
        ...leaguePreview.trainer,
        handle: handle.trim() || leaguePreview.trainer.handle || "Nickname",
        realName: realName.trim() || null,
        avatarSpriteKey,
        avatarBackgroundKey,
        cardBackgroundKey,
        statusEmoji,
        statusText: statusText.trim() || null,
      }
    : null;

  const thumbs: Record<CustomizationTab, ReactNode> = {
    portrait: (
      <span className="flex h-10 w-10 items-end justify-center overflow-hidden rounded-md border border-frame/70 bg-surface-2/80 p-0.5">
        <AvatarPortrait
          avatarSpriteKey={avatarSpriteKey}
          sizeClass="h-full w-full"
          width={40}
          height={40}
        />
      </span>
    ),
    stage: (
      <span className="flex h-10 w-10 items-end justify-center overflow-hidden rounded-md border border-frame/70 bg-surface-2/80 p-0.5">
        <AvatarPortrait
          avatarSpriteKey={avatarSpriteKey}
          backgroundKey={avatarBackgroundKey}
          sizeClass="h-full w-full"
          width={40}
          height={40}
        />
      </span>
    ),
    card: (
      <span
        aria-hidden
        className="card-bg-swatch block h-10 w-10 overflow-hidden rounded-md border border-frame/70"
        data-card-bg={cardDataAttr}
        data-card-bg-default={cardDataAttr ? undefined : ""}
        style={
          customCardUrl
            ? ({
                ["--card-bg-custom" as string]: cssTextureUrl(customCardUrl),
              } as CSSProperties)
            : undefined
        }
      >
        <span className="card-bg-swatch-preview block h-full w-full" />
      </span>
    ),
    profile: (
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-md border border-frame/70 bg-surface-2 text-lg leading-none"
      >
        {statusEmoji ?? (handle.trim().charAt(0).toUpperCase() || "?")}
      </span>
    ),
  };

  const values: Record<CustomizationTab, string> = {
    portrait: portraitLabel(avatarSpriteKey),
    stage: avatarBackgroundLabel(avatarBackgroundKey),
    card: cardBackgroundLabel(cardBackgroundKey),
    profile: handle.trim() || "Add a nickname",
  };

  return (
    <div className="space-y-4">
      {previewTrainer && leaguePreview && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            List Preview
          </p>
          <div
            inert
            className="select-none"
            role="img"
            aria-label="League board list preview"
          >
            <TrainerCard
              challenge={{
                slug: leaguePreview.challengeSlug,
                badges: leaguePreview.badges,
              }}
              trainer={previewTrainer}
              variant="list"
              isYou
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)] sm:items-start">
        <div
          role="tablist"
          aria-label="Customization sections"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0 sm:pb-0"
        >
          {SECTION_ORDER.map((id) => {
            const selected = section === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${baseId}-tab-${id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${id}`}
                disabled={disabled}
                className={`pressable flex w-40 shrink-0 items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 text-left transition disabled:opacity-60 sm:w-full ${
                  selected
                    ? "border-interactive bg-interactive-soft"
                    : "border-frame/70 bg-surface hover:border-interactive/55"
                }`}
                onClick={() => setSection(id)}
              >
                <span className="shrink-0">{thumbs[id]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-xs font-semibold tracking-tight text-ink">
                    {SECTION_COPY[id].label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {values[id]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel-${section}`}
          aria-labelledby={`${baseId}-tab-${section}`}
          className="min-w-0 rounded-lg border border-frame bg-surface-2/40 p-3 sm:p-4"
        >
          <div className="mb-3">
            <h3 className="font-display text-sm font-semibold tracking-tight text-ink">
              {SECTION_COPY[section].label}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {SECTION_COPY[section].hint}
            </p>
          </div>

          {section === "portrait" && (
            <AvatarPicker
              panel="portrait"
              value={avatarSpriteKey}
              onChange={onAvatarChange}
              disabled={disabled}
            />
          )}
          {section === "stage" && (
            <AvatarPicker
              panel="stage"
              value={avatarSpriteKey}
              onChange={onAvatarChange}
              backgroundKey={avatarBackgroundKey}
              onBackgroundChange={onAvatarBackgroundChange}
              savedCustomBackground={savedCustomAvatarBg}
              onSavedCustomBackgroundChange={onSavedCustomAvatarBgChange}
              disabled={disabled}
            />
          )}
          {section === "card" && (
            <CardBackgroundPicker
              value={cardBackgroundKey}
              onChange={onCardBackgroundChange}
              savedCustomBackground={savedCustomCardBg}
              onSavedCustomBackgroundChange={onSavedCustomCardBgChange}
              disabled={disabled}
            />
          )}
          {section === "profile" && (
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-muted">
                  Nickname
                </span>
                <input
                  className="w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                  value={handle}
                  maxLength={24}
                  placeholder="Your league nickname"
                  disabled={disabled}
                  onChange={(e) => onHandleChange(e.target.value)}
                />
              </label>
              {(discordUsername || discordDisplayName) && (
                <p className="text-sm text-muted">
                  Discord{" "}
                  <span className="font-semibold text-ink">
                    {discordUsername
                      ? `@${discordUsername}`
                      : discordDisplayName}
                  </span>
                </p>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-muted">
                  Real name
                </span>
                <input
                  className="w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                  value={realName}
                  placeholder="Optional — e.g. John"
                  disabled={disabled}
                  onChange={(e) => onRealNameChange(e.target.value)}
                />
              </label>
              <StatusEmojiPicker
                value={statusEmoji}
                onChange={onStatusEmojiChange}
                disabled={disabled}
              />
              <label className="block text-sm">
                <span className="mb-1 block font-bold text-muted">Status</span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                  value={statusText}
                  placeholder="Where you are in the run…"
                  disabled={disabled}
                  onChange={(e) => onStatusTextChange(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
