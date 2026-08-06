"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ActivityReactions } from "@/components/ActivityReactions";
import { Frame } from "@/components/Frame";
import type { ActivityItem } from "@/lib/challenge-types";

const APP_MARK = "/nuzlocke-mark.png";
const AUTO_ADVANCE_MS = 7000;

type HeadlineMomentsProps = {
  slug: string;
  items: ActivityItem[];
  canReact?: boolean;
};

/**
 * Left-rail highlight reel — latest big Pack moments only (#322).
 * Full feed stays on `/activity`.
 */
export function HeadlineMoments({
  slug,
  items,
  canReact = false,
}: HeadlineMomentsProps) {
  const labelId = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const count = items.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const active = count > 0 ? items[safeIndex]! : null;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reduceMotion]);

  const activityHref = `/challenges/${slug}/activity`;

  if (count === 0) {
    return (
      <Frame
        title="Headlines"
        dense
        actions={
          <Link
            href={activityHref}
            className="text-xs font-semibold text-accent-deep underline-offset-2 hover:underline"
          >
            Activity
          </Link>
        }
      >
        <p className="text-xs leading-relaxed text-muted">
          No big moments yet. Badges, championships, and wipes show up here.
        </p>
      </Frame>
    );
  }

  function go(delta: number) {
    setIndex((i) => {
      const base = Math.min(i, count - 1);
      return (base + delta + count) % count;
    });
  }

  return (
    <Frame
      title="Headlines"
      dense
      actions={
        <Link
          href={activityHref}
          className="text-xs font-semibold text-accent-deep underline-offset-2 hover:underline"
        >
          View all
        </Link>
      }
    >
      <div
        role="region"
        aria-roledescription="carousel"
        aria-labelledby={labelId}
        className="outline-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setPaused(false);
          }
        }}
      >
        <p id={labelId} className="sr-only">
          Season headline moments
        </p>
        <p className="sr-only" aria-live="polite">
          {active
            ? `Headline ${safeIndex + 1} of ${count}: ${active.message}`
            : null}
        </p>

        {active ? (
          <HeadlineSlide
            key={active.id}
            slug={slug}
            item={active}
            canReact={canReact}
          />
        ) : null}

        {count > 1 ? (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous headline"
              className="rounded-lg border border-frame/40 bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted pressable hover:bg-accent/10 hover:text-ink"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <div
              className="flex items-center gap-1.5"
              role="tablist"
              aria-label="Headlines"
            >
              {items.map((item, i) => {
                const selected = i === safeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`Headline ${i + 1}`}
                    className={`h-1.5 rounded-full transition-[width,background-color] ${
                      selected
                        ? "w-4 bg-accent-deep"
                        : "w-1.5 bg-frame/50 hover:bg-frame"
                    }`}
                    onClick={() => setIndex(i)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Next headline"
              className="rounded-lg border border-frame/40 bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted pressable hover:bg-accent/10 hover:text-ink"
              onClick={() => go(1)}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
    </Frame>
  );
}

function HeadlineSlide({
  slug,
  item,
  canReact,
}: {
  slug: string;
  item: ActivityItem;
  canReact: boolean;
}) {
  const avatarSrc = item.avatarSrc ?? APP_MARK;
  const avatarLabel = item.trainerHandle
    ? `${item.trainerHandle}'s avatar`
    : "Nuzlocke Manager";
  const isSpriteAvatar = Boolean(
    item.avatarSrc &&
      !item.avatarSrc.includes("discord") &&
      !item.avatarSrc.includes("blob.vercel-storage.com") &&
      item.avatarSrc !== APP_MARK,
  );
  const trainerHref =
    item.trainerId != null
      ? `/challenges/${slug}/trainers/${item.trainerId}`
      : null;

  const avatar = (
    <span
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface-2 ${
        trainerHref
          ? "border-frame group-hover/avatar:border-accent-deep"
          : "border-frame"
      }`}
      title={avatarLabel}
    >
      <Image
        src={avatarSrc}
        alt=""
        width={36}
        height={36}
        className={
          isSpriteAvatar
            ? "pixelated h-full w-full object-cover object-[center_15%]"
            : "h-full w-full object-cover"
        }
        unoptimized
      />
    </span>
  );

  return (
    <div>
      <div className="flex items-start gap-2.5">
        {trainerHref ? (
          <Link
            href={trainerHref}
            className="group/avatar inline-flex shrink-0 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-interactive"
            aria-label={`${item.trainerHandle ?? "Trainer"} profile`}
          >
            {avatar}
          </Link>
        ) : (
          avatar
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            <HeadlineMessage
              message={item.message}
              trainerHandle={item.trainerHandle}
              trainerHref={trainerHref}
            />
          </p>
          <p className="mt-1 text-[11px] tracking-tight text-muted">
            {formatHeadlineWhen(item.createdAt)}
            {item.trainerHandle ? (
              <>
                {" · "}
                {trainerHref ? (
                  <Link
                    href={trainerHref}
                    className="underline-offset-2 hover:text-accent-deep hover:underline"
                  >
                    {item.trainerHandle}
                  </Link>
                ) : (
                  item.trainerHandle
                )}
              </>
            ) : null}
          </p>
        </div>
      </div>
      <ActivityReactions
        activityId={item.id}
        reactions={item.reactions}
        canReact={canReact}
      />
    </div>
  );
}

function HeadlineMessage({
  message,
  trainerHandle,
  trainerHref,
}: {
  message: string;
  trainerHandle: string | null;
  trainerHref: string | null;
}) {
  if (!trainerHref || !trainerHandle) return message;

  const parts = message.split(trainerHandle);
  if (parts.length < 2) return message;

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${index}-${part.slice(0, 12)}`}>
          {index > 0 ? (
            <Link
              href={trainerHref}
              className="underline-offset-2 hover:text-accent-deep hover:underline"
            >
              {trainerHandle}
            </Link>
          ) : null}
          {part}
        </span>
      ))}
    </>
  );
}

function formatHeadlineWhen(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.round((now - then) / 1000);
    if (sec < 45) return "just now";
    if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`;
    if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`;
    if (sec < 86400 * 7) return `${Math.max(1, Math.round(sec / 86400))}d ago`;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
