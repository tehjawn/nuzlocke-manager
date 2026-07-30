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
  /** With strip: omit the `x/n badges` text (icons + aria-label only). */
  hideCount?: boolean;
  /** With strip: only show earned badge icons (no count / unearned slots). */
  earnedOnly?: boolean;
  /**
   * With strip: lay icons in N columns. When set without earnedOnly, shows every
   * badge (unearned blurred) so card heights stay consistent.
   */
  earnedColumns?: 2 | 3;
  /** Smaller badge icons + tighter gaps (grid card left rail). */
  dense?: boolean;
  /** Full layout: two columns from sm up, or a single column for sidebar. */
  layout?: "grid" | "column";
  /** When set, badges become toggle buttons (edit mode). */
  onToggle?: (badgeKey: string, nextEarned: boolean) => void;
  pending?: boolean;
  className?: string;
};

function CompleteBanner({ dense = false }: { dense?: boolean }) {
  return (
    <p
      className={`badge-case__banner ${
        dense ? "badge-case__banner--dense" : ""
      }`}
      role="status"
    >
      <span className="badge-case__banner-mark" aria-hidden>
        ★
      </span>
      <span>All badges earned!</span>
    </p>
  );
}

export function BadgeCase({
  badges,
  earnedKeys,
  compact = false,
  strip = false,
  hideCount = false,
  earnedOnly = false,
  earnedColumns,
  dense = false,
  layout = "grid",
  onToggle,
  pending = false,
  className = "",
}: BadgeCaseProps) {
  const earned = new Set(earnedKeys);
  const interactive = Boolean(onToggle);
  const earnedCount = badges.filter((b) => earned.has(b.key)).length;
  const complete = badges.length > 0 && earnedCount === badges.length;
  const stripBadges = earnedOnly
    ? badges.filter((b) => earned.has(b.key))
    : badges;
  const completeClass = complete ? "badge-case--complete" : "";
  const ariaProgress = complete
    ? `All ${badges.length} badges earned`
    : `${earnedCount} of ${badges.length} badges earned`;

  if (strip) {
    // Narrow left-rail layout (grid cards): fixed columns of every badge,
    // unearned blurred — keeps card heights consistent.
    if (earnedColumns && !earnedOnly) {
      const iconPx = dense ? 16 : 20;
      return (
        <div
          className={`badge-case badge-case--strip badge-case--strip-rail rounded-md bg-surface/70 p-1 shadow-sm backdrop-blur-sm ${completeClass}`}
        >
          <ul
            className={
              earnedColumns === 2
                ? `grid grid-cols-2 ${dense ? "gap-0.5" : "gap-1"}`
                : `grid grid-cols-3 ${dense ? "gap-0.5" : "gap-1"}`
            }
            aria-label={ariaProgress}
          >
            {badges.map((badge) => {
              const on = earned.has(badge.key);
              const meta = getEmeraldBadgeMeta(badge.key);
              const title = `${meta?.badgeName ?? badge.label}${
                badge.leaderName ? ` — ${badge.leaderName}` : ""
              }${on ? " · Earned" : ""}`;
              return (
                <li key={badge.key} title={title} className="flex justify-center">
                  {meta ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meta.badgeSprite}
                      alt=""
                      width={iconPx}
                      height={iconPx}
                      className={`badge-case__icon object-contain ${
                        on ? "badge-case__icon--earned" : "grayscale opacity-35"
                      }`}
                      style={{ width: iconPx, height: iconPx }}
                    />
                  ) : (
                    <span
                      className={`inline-block rounded border border-frame/60 ${
                        on ? "bg-accent-2/40" : "bg-surface-2/80"
                      }`}
                      style={{ width: iconPx, height: iconPx }}
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
        <div className={`badge-case badge-case--strip ${completeClass}`}>
          <ul
            className={`flex flex-wrap ${dense ? "gap-px" : "gap-0.5"}`}
            aria-label={ariaProgress}
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
                      className="badge-case__icon badge-case__icon--earned object-contain"
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
        </div>
      );
    }

    return (
      <div
        className={`badge-case badge-case--strip flex flex-wrap items-center gap-2 ${
          hideCount ? "justify-center" : ""
        } ${completeClass} ${className}`}
      >
        {hideCount ? null : (
          <p
            className={`font-display text-xs font-semibold tracking-tight ${
              complete ? "text-accent-2" : "text-muted"
            }`}
          >
            {complete
              ? "All Badges Earned"
              : `${earnedCount}/${badges.length} badges`}
          </p>
        )}
        {/* Frosted chip lifts badges off the card background so they stay
            legible regardless of which preset wash is active. */}
        <div className="badge-case__shell rounded-lg bg-surface/70 px-2 py-1.5 shadow-sm backdrop-blur-sm">
          <ul className="flex flex-wrap gap-1" aria-label={ariaProgress}>
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
                      className={`badge-case__icon h-[22px] w-[22px] object-contain ${
                        on
                          ? "badge-case__icon--earned"
                          : "grayscale opacity-35"
                      }`}
                    />
                  ) : (
                    <span
                      className={`inline-block h-[22px] w-[22px] rounded border border-frame/60 ${
                        on ? "bg-accent-2/40" : "bg-surface-2/80"
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
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`badge-case space-y-2 ${completeClass}`}>
        {complete ? <CompleteBanner dense /> : null}
        <ul className="grid grid-cols-7 gap-1.5" aria-label={ariaProgress}>
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
                    className={`badge-case__icon h-7 w-7 object-contain ${
                      on
                        ? "badge-case__icon--earned"
                        : "pixelated blur-[1px] grayscale opacity-50"
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
            const cellClass = `badge-case__cell flex flex-col items-center justify-center rounded-lg border border-frame px-0.5 py-1.5 ${
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
                    className={`w-full ${cellClass}`}
                    onClick={() => onToggle?.(badge.key, !on)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={cellClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className={`badge-case space-y-2 ${completeClass} ${className}`}>
      {complete ? <CompleteBanner /> : null}
      <ul
        className={`grid grid-cols-1 gap-2 ${
          layout === "grid" ? "sm:grid-cols-2" : ""
        }`}
        aria-label={ariaProgress}
      >
        {badges.map((badge) => {
          const on = earned.has(badge.key);
          const meta = getEmeraldBadgeMeta(badge.key);
          const title = meta?.badgeName ?? badge.label;
          const preview = meta?.previewLabel ?? badge.label;
          const leader = badge.leaderName ?? meta?.previewLabel;
          const cellClass = `badge-case__cell flex w-full items-center gap-3 rounded-lg border border-frame p-2 text-left ${
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
                className={`badge-case__icon h-10 w-10 shrink-0 object-contain ${
                  on ? "badge-case__icon--earned" : mysterySprite
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
                  className={cellClass}
                  onClick={() => onToggle?.(badge.key, !on)}
                >
                  {body}
                </button>
              ) : (
                <div className={cellClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
