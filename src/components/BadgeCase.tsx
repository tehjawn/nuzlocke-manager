"use client";

import Image from "next/image";
import type { BadgeDefinition } from "@/lib/challenge-types";
import { getEmeraldBadgeMeta } from "@/lib/emerald-badges";
import { trainerSpriteUrl } from "@/lib/sprites";

type BadgeCaseProps = {
  badges: BadgeDefinition[];
  earnedKeys: string[];
  compact?: boolean;
  /** When set, badges become toggle buttons (edit mode). */
  onToggle?: (badgeKey: string, nextEarned: boolean) => void;
  pending?: boolean;
};

export function BadgeCase({
  badges,
  earnedKeys,
  compact = false,
  onToggle,
  pending = false,
}: BadgeCaseProps) {
  const earned = new Set(earnedKeys);
  const interactive = Boolean(onToggle);

  if (compact) {
    return (
      <ul className="grid grid-cols-7 gap-1.5" aria-label="Badge case">
        {badges.map((badge) => {
          const on = earned.has(badge.key);
          const meta = getEmeraldBadgeMeta(badge.key);
          const label = meta?.previewLabel ?? badge.label;
          const title = `${meta?.badgeName ?? badge.label}${
            badge.leaderName ? ` — ${badge.leaderName}` : ""
          }`;
          const body = (
            <>
              {meta ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meta.badgeSprite}
                  alt=""
                  width={28}
                  height={28}
                  className={`h-7 w-7 object-contain ${on ? "" : "grayscale opacity-50"}`}
                />
              ) : null}
              <span
                className={`mt-0.5 font-display text-[8px] font-bold tracking-wide ${
                  on ? "text-ink" : "text-muted"
                }`}
              >
                {label}
              </span>
              <span className="sr-only">{on ? "earned" : "not earned"}</span>
            </>
          );
          const className = `flex flex-col items-center justify-center rounded-sm border-2 border-frame px-0.5 py-1.5 ${
            on
              ? "bg-accent-2/30 shadow-[inset_0_0_0_2px_#e8c56a]"
              : "bg-surface-2 opacity-70"
          }`;
          return (
            <li key={badge.key} title={title}>
              {interactive ? (
                <button
                  type="button"
                  disabled={pending}
                  className={`w-full ${className}`}
                  onClick={() => onToggle?.(badge.key, !on)}
                >
                  {body}
                </button>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      aria-label="Badge case"
    >
      {badges.map((badge) => {
        const on = earned.has(badge.key);
        const meta = getEmeraldBadgeMeta(badge.key);
        const title = meta?.badgeName ?? badge.label;
        const preview = meta?.previewLabel ?? badge.label;
        const leader = badge.leaderName ?? meta?.previewLabel;
        const className = `flex w-full items-center gap-3 rounded-sm border-2 border-frame p-2 text-left ${
          on
            ? "bg-accent-2/30 shadow-[inset_0_0_0_2px_#e8c56a]"
            : "bg-surface-2 opacity-70"
        }`;
        const body = (
          <>
            {meta ? (
              <Image
                src={trainerSpriteUrl(meta.leaderSpriteKey)}
                alt=""
                width={56}
                height={56}
                className="pixelated h-14 w-14 shrink-0 object-contain"
                unoptimized
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta?.badgeSprite ?? "/badges/gym-1.svg"}
              alt=""
              width={40}
              height={40}
              className={`h-10 w-10 shrink-0 object-contain ${on ? "" : "grayscale opacity-50"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xs font-bold tracking-wide uppercase">
                {preview}
              </span>
              <span className="mt-0.5 block truncate text-sm font-bold">
                {title}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {leader}
                {meta?.city ? ` · ${meta.city}` : ""}
                {interactive
                  ? on
                    ? " · Earned — tap to revoke"
                    : " · Tap to earn"
                  : on
                    ? " · Earned"
                    : ""}
              </span>
            </span>
            <span className="sr-only">{on ? "earned" : "not earned"}</span>
          </>
        );

        return (
          <li key={badge.key}>
            {interactive ? (
              <button
                type="button"
                disabled={pending}
                className={className}
                onClick={() => onToggle?.(badge.key, !on)}
              >
                {body}
              </button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
