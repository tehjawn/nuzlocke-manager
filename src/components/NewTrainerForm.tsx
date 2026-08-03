"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTrainerIntroAction } from "@/app/actions/challenge";
import { AvatarPicker } from "@/components/AvatarPicker";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { CTA_PRIMARY_LG } from "@/lib/cta";
import {
  writeOnboardingActive,
  writeOnboardingStep,
} from "@/lib/onboarding";

type NewTrainerFormProps = {
  trainerId: string;
  challengeSlug: string;
  initialHandle: string;
  initialRealName: string;
  initialAvatarSpriteKey: string;
  discordUsername: string | null;
};

export function NewTrainerForm({
  trainerId,
  challengeSlug,
  initialHandle,
  initialRealName,
  initialAvatarSpriteKey,
  discordUsername,
}: NewTrainerFormProps) {
  const router = useRouter();
  const handleId = useId();
  const realNameId = useId();
  const [pending, startTransition] = useTransition();
  const [handle, setHandle] = useState(initialHandle);
  const [realName, setRealName] = useState(initialRealName);
  const [avatarSpriteKey, setAvatarSpriteKey] = useState(
    initialAvatarSpriteKey,
  );
  const [error, setError] = useState<string | null>(null);

  function onReady() {
    const trimmed = handle.trim();
    if (!trimmed) {
      setError("Pick a nickname for your trainer.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await completeTrainerIntroAction({
        trainerId,
        handle: trimmed,
        realName: realName.trim() || null,
        avatarSpriteKey,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      writeOnboardingStep(0);
      writeOnboardingActive(true);
      router.replace(
        `/challenges/${challengeSlug}/trainers/${trainerId}?tour=1`,
      );
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold tracking-[0.14em] text-accent-deep uppercase">
          Create your trainer
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          This is you in Season 2026
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Pick a nickname, optional real name, and a portrait. You can tweak
          stage, card art, and status anytime from your board.
        </p>
      </header>

      <div className="gba-frame overflow-hidden bg-surface-2/60 p-4 sm:p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <AvatarPortrait
              avatarSpriteKey={avatarSpriteKey}
              sizeClass="h-28 w-28"
              width={112}
              height={112}
              alt={handle.trim() || "Your trainer"}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
            <p className="text-xl font-bold tracking-tight">
              {handle.trim() || "Your nickname"}
            </p>
            {realName.trim() ? (
              <p className="text-sm text-muted">{realName.trim()}</p>
            ) : null}
            {discordUsername ? (
              <p className="text-xs text-muted">@{discordUsername}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5" htmlFor={handleId}>
          <span className="text-sm font-semibold tracking-tight">Nickname</span>
          <input
            id={handleId}
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            maxLength={32}
            disabled={pending}
            className="w-full rounded-lg border border-frame bg-surface px-3 py-2.5 text-base font-semibold tracking-tight outline-none focus-visible:border-interactive"
            autoComplete="nickname"
            autoFocus
          />
        </label>

        <label className="block space-y-1.5" htmlFor={realNameId}>
          <span className="text-sm font-semibold tracking-tight">
            Real name{" "}
            <span className="font-medium text-muted">(optional)</span>
          </span>
          <input
            id={realNameId}
            value={realName}
            onChange={(event) => setRealName(event.target.value)}
            maxLength={64}
            disabled={pending}
            placeholder="e.g. John"
            className="w-full rounded-lg border border-frame bg-surface px-3 py-2.5 text-base tracking-tight outline-none focus-visible:border-interactive"
            autoComplete="name"
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-tight">Portrait</p>
          <p className="text-xs text-muted">
            Trainer sprite, a Pokémon, or your own image.
          </p>
          <AvatarPicker
            panel="portrait"
            value={avatarSpriteKey}
            onChange={setAvatarSpriteKey}
            disabled={pending}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={`${CTA_PRIMARY_LG} w-full sm:w-auto`}
        disabled={pending}
        onClick={onReady}
      >
        {pending ? "Saving…" : "I’m ready!"}
      </button>
    </div>
  );
}
