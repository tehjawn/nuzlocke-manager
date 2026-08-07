"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ActivityReactions } from "@/components/ActivityReactions";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { Frame } from "@/components/Frame";
import type { HeadlineItem } from "@/lib/activity-headlines";

const AUTO_ADVANCE_MS = 6500;

type HeadlineMomentsProps = {
  slug: string;
  items: HeadlineItem[];
  canReact?: boolean;
};

/**
 * Left-rail highlight reel — trainer-card chrome + shouty blurbs (#322).
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
  const activityHref = `/challenges/${slug}/activity`;

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

  if (count === 0) {
    return (
      <div className="space-y-2">
        <HeadlineRailHeader href={activityHref} />
        <Frame dense>
          <p className="text-xs leading-relaxed text-muted">
            No big moments yet. Badges, championships, and wipes land here.
          </p>
        </Frame>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      className="space-y-2 outline-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <HeadlineRailHeader href={activityHref} />
      <p id={labelId} className="sr-only">
        Season headline moments
      </p>
      <p className="sr-only" aria-live="polite">
        {active && `Headline ${safeIndex + 1} of ${count}: ${active.blurb}`}
      </p>

      {active && (
        <HeadlineSlide
          key={active.id}
          slug={slug}
          item={active}
          canReact={canReact}
        />
      )}

      {count > 1 && (
        <div
          className="flex items-center justify-center gap-2"
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
                aria-label={`Show: ${item.blurb}`}
                className={`h-2 rounded-full transition-[width,background-color,opacity] pressable ${
                  selected
                    ? "w-5 bg-accent-deep"
                    : "w-2 bg-frame/60 opacity-80 hover:bg-frame hover:opacity-100"
                }`}
                onClick={() => setIndex(i)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function HeadlineRailHeader({ href }: { href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-0.5">
      <h2 className="text-xs font-bold tracking-tight text-muted uppercase">
        Headlines
      </h2>
      <Link
        href={href}
        className="text-[11px] font-semibold text-accent-deep underline-offset-2 hover:underline"
      >
        View all
      </Link>
    </div>
  );
}

function HeadlineSlide({
  slug,
  item,
  canReact,
}: {
  slug: string;
  item: HeadlineItem;
  canReact: boolean;
}) {
  const trainerHref =
    item.trainerId != null
      ? `/challenges/${slug}/trainers/${item.trainerId}`
      : null;
  const spriteKey = item.avatarSpriteKey?.trim() || "brendan";
  const isChampion = item.type === "RUN_COMPLETED";
  const isWipe = item.type === "WIPE";

  const body = (
    <div className="headline-moment-body relative z-[2] grid min-h-[7.5rem] grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-2.5">
      <div className="relative flex h-[7.25rem] items-end justify-center overflow-visible">
        <AvatarPortrait
          avatarSpriteKey={spriteKey}
          backgroundKey={item.avatarBackgroundKey}
          sizeClass="relative z-1 h-[6.5rem] w-[5.25rem]"
          width={96}
          height={112}
          imgClassName={`drop-shadow-[0_8px_16px_var(--shadow-md)] ${
            isChampion
              ? "headline-portrait--champ"
              : isWipe
                ? "headline-portrait--wipe"
                : ""
          }`}
          alt=""
        />
      </div>
      <div className="headline-moment-copy relative flex min-w-0 flex-col justify-center pr-0.5">
        <p
          className={`font-display text-[0.95rem] font-bold leading-snug tracking-tight text-balance line-clamp-3 ${
            isChampion
              ? "text-accent-deep"
              : isWipe
                ? "text-danger"
                : "text-ink"
          }`}
        >
          {item.blurb}
        </p>
        <p className="mt-1.5 text-[11px] font-medium tracking-tight text-muted">
          {formatHeadlineWhen(item.createdAt)}
          {item.trainerHandle && (
            <>
              {" · "}
              <span className="text-ink/80">{item.trainerHandle}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <Frame
      cardBackgroundKey={item.cardBackgroundKey}
      dense
      className="headline-moment-card overflow-hidden shadow-[0_10px_28px_var(--shadow-md)]"
      overlay={<div className="headline-moment-wash" aria-hidden />}
    >
      {trainerHref ? (
        <Link
          href={trainerHref}
          className="relative z-[2] block rounded-[calc(var(--radius)-2px)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-interactive"
          aria-label={`${item.trainerHandle ?? "Trainer"} — ${item.blurb}`}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {(canReact || item.reactions.some((r) => r.count > 0)) && (
        <div className="relative z-[2] mt-1.5">
          <ActivityReactions
            activityId={item.id}
            reactions={item.reactions}
            canReact={canReact}
            className="mt-0"
          />
        </div>
      )}
    </Frame>
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
