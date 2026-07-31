"use client";

import { useId, useState, type CSSProperties } from "react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { CardBackgroundPicker } from "@/components/CardBackgroundPicker";
import { StatusEmojiPicker } from "@/components/StatusEmojiPicker";
import {
  cardBackgroundCustomUrl,
  isCardBackgroundKey,
} from "@/data/card-backgrounds";
import { cssTextureUrl } from "@/lib/custom-texture";

export type CustomizationTab = "portrait" | "stage" | "card" | "profile";

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
  initialTab?: CustomizationTab;
};

const TABS: Array<{ id: CustomizationTab; label: string }> = [
  { id: "portrait", label: "Portrait" },
  { id: "stage", label: "Stage" },
  { id: "card", label: "Card art" },
  { id: "profile", label: "Profile" },
];

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
  initialTab = "portrait",
}: PlayerCustomizationEditorProps) {
  const [tab, setTab] = useState<CustomizationTab>(initialTab);
  const tabsId = useId();

  const customCardUrl = cardBackgroundCustomUrl(cardBackgroundKey);
  const cardDataAttr = isCardBackgroundKey(cardBackgroundKey)
    ? cardBackgroundKey
    : customCardUrl
      ? "custom"
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-stretch gap-3">
        <div
          className={`flex flex-col rounded-lg border-2 bg-surface-2/40 p-2 transition ${
            tab === "portrait" || tab === "stage"
              ? "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_30%,transparent)]"
              : "border-frame/70"
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            aria-label="Edit portrait"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
            onClick={() => setTab("portrait")}
          >
            <AvatarPortrait
              avatarSpriteKey={avatarSpriteKey}
              backgroundKey={avatarBackgroundKey}
              sizeClass="h-24 w-24"
              width={96}
              height={96}
            />
          </button>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              disabled={disabled}
              className={`pressable flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-tight disabled:opacity-60 ${
                tab === "portrait"
                  ? "bg-interactive text-white"
                  : "bg-surface text-muted hover:text-ink"
              }`}
              onClick={() => setTab("portrait")}
            >
              Portrait
            </button>
            <button
              type="button"
              disabled={disabled}
              className={`pressable flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-tight disabled:opacity-60 ${
                tab === "stage"
                  ? "bg-interactive text-white"
                  : "bg-surface text-muted hover:text-ink"
              }`}
              onClick={() => setTab("stage")}
            >
              Stage
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          aria-label="Edit card art"
          title="Edit card art"
          className={`card-bg-swatch pressable relative flex w-28 flex-col overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 sm:w-32 ${
            tab === "card"
              ? "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_30%,transparent)]"
              : "border-frame/70 hover:border-interactive/55"
          }`}
          data-card-bg={cardDataAttr}
          data-card-bg-default={cardDataAttr ? undefined : ""}
          style={
            customCardUrl
              ? ({
                  ["--card-bg-custom" as string]: cssTextureUrl(customCardUrl),
                } as CSSProperties)
              : undefined
          }
          onClick={() => setTab("card")}
        >
          <span className="card-bg-swatch-preview relative block min-h-16 w-full flex-1" />
          <span
            className={`px-1.5 py-1 text-center text-[10px] font-semibold tracking-tight ${
              tab === "card"
                ? "bg-interactive text-white"
                : "bg-surface-2/95 text-ink"
            }`}
          >
            Card art
          </span>
        </button>

        <button
          type="button"
          disabled={disabled}
          aria-label="Edit profile"
          title="Edit profile"
          className={`flex min-w-30 flex-1 flex-col justify-center rounded-lg border-2 px-3 py-2 text-left transition disabled:opacity-60 sm:max-w-xs ${
            tab === "profile"
              ? "border-interactive shadow-[0_0_0_2px_color-mix(in_srgb,var(--interactive)_30%,transparent)]"
              : "border-frame/70 hover:border-interactive/55"
          }`}
          onClick={() => setTab("profile")}
        >
          <span className="truncate font-display text-sm font-semibold tracking-tight text-ink">
            {handle.trim() || "Nickname"}
          </span>
          <span className="mt-0.5 line-clamp-2 text-xs text-muted">
            {statusEmoji ? `${statusEmoji} ` : ""}
            {statusText.trim() || "Status & name"}
          </span>
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Customization sections"
        className="flex flex-wrap gap-1 rounded-lg border border-frame bg-surface-2/50 p-1"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabsId}-${item.id}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel-${item.id}`}
              disabled={disabled}
              className={`pressable min-h-9 flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-tight transition disabled:opacity-60 sm:flex-none ${
                selected
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-${tab}`}
        aria-labelledby={`${tabsId}-${tab}`}
        className="min-h-28"
      >
        {tab === "portrait" ? (
          <AvatarPicker
            panel="portrait"
            value={avatarSpriteKey}
            onChange={onAvatarChange}
            backgroundKey={avatarBackgroundKey}
            disabled={disabled}
          />
        ) : null}
        {tab === "stage" ? (
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
        ) : null}
        {tab === "card" ? (
          <CardBackgroundPicker
            value={cardBackgroundKey}
            onChange={onCardBackgroundChange}
            savedCustomBackground={savedCustomCardBg}
            onSavedCustomBackgroundChange={onSavedCustomCardBgChange}
            disabled={disabled}
          />
        ) : null}
        {tab === "profile" ? (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-muted">Nickname</span>
              <input
                className="w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                value={handle}
                maxLength={24}
                placeholder="Your league nickname"
                disabled={disabled}
                onChange={(e) => onHandleChange(e.target.value)}
              />
            </label>
            {discordUsername || discordDisplayName ? (
              <p className="text-sm text-muted">
                Discord{" "}
                <span className="font-semibold text-ink">
                  {discordUsername
                    ? `@${discordUsername}`
                    : discordDisplayName}
                </span>
              </p>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-muted">Real name</span>
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
        ) : null}
      </div>

      <p className="text-xs text-muted">
        Changes stay local until you hit{" "}
        <span className="font-semibold text-ink">Save</span>.
      </p>
    </div>
  );
}
