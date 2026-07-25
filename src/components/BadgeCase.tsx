"use client";

import Image from "next/image";
import type { BadgeDefinition } from "@/lib/challenge-types";
import { getEmeraldBadgeMeta } from "@/lib/emerald-badges";
import { trainerSpriteUrl } from "@/lib/sprites";

type BadgeCaseProps = {
  badges: BadgeDefinition[];
  earnedKeys: string[];
  compact?: boolean;
  /** League-card density: count + icon strip (no labels). */
  strip?: boolean;
  /** With strip: only show earned badge icons (no count / unearned slots). */
  earnedOnly?: boolean;
  /** With earnedOnly strip: lay icons out in N columns. */
  earnedColumns?: 2 | 3;
  /** Smaller badge icons + tighter gaps (grid card left rail). */
  dense?: boolean;
  /** Full layout: two columns from sm up, or a single column for sidebar. */
  layout?: "grid" | "column";
  /** When set, badges become toggle buttons (edit mode). */
  onToggle?: (badgeKey: string, nextEarned: boolean) => void;
  pending?: boolean;
};

export function BadgeCase({
  badges,
  earnedKeys,
  compact = false,
  strip = false,
  earnedOnly = false,
  earnedColumns,
  dense = false,
  layout = "grid",
  onToggle,
  pending = false,
}: BadgeCaseProps) {
  const earned = new Set(earnedKeys);
  const interactive = Boolean(onToggle);
  const earnedCount = badges.filter((b) => earned.has(b.key)).length;
  const stripBadges = earnedOnly
    ? badges.filter((b) => earned.has(b.key))
    : badges;

  if (strip) {
    if (earnedOnly) {
      if (stripBadges.length === 0) {
        return (
          <p
            className={`font-semibold tracking-tight text-muted ${
              dense ? "text-[10px] leading-tight" : "text-[11px]"
            }`}
          >
            No badges yet
          </p>
        );
      }
      const iconPx = dense ? 16 : 22;
      return (
        <ul
          className={
            earnedColumns === 2
              ? `grid grid-cols-2 ${dense ? "gap-0.5" : "gap-1"}`
              : earnedColumns === 3
                ? `grid grid-cols-3 ${dense ? "gap-0.5" : "gap-1"}`
                : `flex flex-wrap ${dense ? "gap-px" : "gap-0.5"}`
          }
          aria-label={`${stripBadges.length} badges earned`}
        >
          {stripBadges.map((badge) => {
            const meta = getEmeraldBadgeMeta(badge.key);
            const title = `${meta?.badgeName ?? badge.label}${
              badge.leaderName ? ` — ${badge.leaderName}` : ""
            }`;
            return (
              <li key={badge.key} title={title} className="flex justify-center">
                {meta ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.badgeSprite}
                    alt=""
                    width={iconPx}
                    height={iconPx}
                    className="object-contain"
                    style={{ width: iconPx, height: iconPx }}
                  />
                ) : (
                  <span
                    className="inline-block rounded border border-frame bg-accent-2/40"
                    style={{ width: iconPx, height: iconPx }}
                  />
                )}
                <span className="sr-only">{title}</span>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-xs font-semibold tracking-tight text-muted">
          {earnedCount}/{badges.length} badges
        </p>
        <ul className="flex flex-wrap gap-1" aria-label="Badge case">
          {badges.map((badge) => {
            const on = earned.has(badge.key);
            const meta = getEmeraldBadgeMeta(badge.key);
            const title = `${meta?.badgeName ?? badge.label}${
              badge.leaderName ? ` — ${badge.leaderName}` : ""
            }${on ? " · Earned" : ""}`;
            return (
              <li key={badge.key} title={title}>
                {meta ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.badgeSprite}
                    alt=""
                    width={22}
                    height={22}
                    className={`h-[22px] w-[22px] object-contain ${
                      on ? "" : "pixelated blur-[1px] grayscale opacity-45"
                    }`}
                  />
                ) : (
                  <span
                    className={`inline-block h-[22px] w-[22px] rounded-lg border border-frame ${
                      on ? "bg-accent-2/40" : "bg-surface-2"
                    }`}
                  />
                )}
                <span className="sr-only">
                  {title}
                  {on ? " earned" : " not earned"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

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
                  className={`h-7 w-7 object-contain ${
                    on ? "" : "pixelated blur-[1px] grayscale opacity-50"
                  }`}
                />
              ) : null}
              <span
                className={`mt-0.5 font-display text-[9px] font-bold tracking-wide ${
                  on ? "text-ink" : "text-muted"
                }`}
              >
                {label}
              </span>
              <span className="sr-only">{on ? "earned" : "not earned"}</span>
            </>
          );
          const className = `flex flex-col items-center justify-center rounded-lg border border-frame px-0.5 py-1.5 ${
            on
              ? "bg-accent-2/30 ring-2 ring-accent-2/50"
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
      className={`grid grid-cols-1 gap-2 ${
        layout === "grid" ? "sm:grid-cols-2" : ""
      }`}
      aria-label="Badge case"
    >
      {badges.map((badge) => {
        const on = earned.has(badge.key);
        const meta = getEmeraldBadgeMeta(badge.key);
        const title = meta?.badgeName ?? badge.label;
        const preview = meta?.previewLabel ?? badge.label;
        const leader = badge.leaderName ?? meta?.previewLabel;
        const className = `flex w-full items-center gap-3 rounded-lg border border-frame p-2 text-left ${
          on
            ? "bg-accent-2/30 ring-2 ring-accent-2/50"
            : "bg-surface-2 opacity-70"
        }`;
        const mysterySprite = on
          ? ""
          : "pixelated blur-[1.5px] grayscale opacity-55";
        const body = (
          <>
            {meta ? (
              <Image
                src={trainerSpriteUrl(meta.leaderSpriteKey)}
                alt=""
                width={56}
                height={56}
                className={`pixelated h-14 w-14 shrink-0 object-contain ${mysterySprite}`}
                unoptimized
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta?.badgeSprite ?? "/badges/gym-1.png"}
              alt=""
              width={40}
              height={40}
              className={`h-10 w-10 shrink-0 object-contain ${
                on ? "" : mysterySprite
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xs font-semibold tracking-tight">
                {preview}
              </span>
              <span className="mt-0.5 block truncate text-sm font-bold">
                {title}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {leader}
                {meta?.city ? ` · ${meta.city}` : ""}
                {on ? " · Earned" : ""}
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
