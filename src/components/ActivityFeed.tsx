"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import {
  mergeReaction,
  postActivityReaction,
} from "@/components/ActivityReactions";
import { Frame } from "@/components/Frame";
import { coalesceActivityItems } from "@/lib/activity-messages";
import type {
  ActivityItem,
  ActivityPage,
  ActivityReactionSummary,
} from "@/lib/challenge-types";

const APP_MARK = "/nuzlocke-mark.png";
const QUICK_EMOJIS = ["🔥", "💀", "👏", "😮", "❤️", "🎉"] as const;
const PAGE_SIZE = 30;

async function fetchActivityPage(
  slug: string,
  cursor: string,
): Promise<ActivityPage> {
  const params = new URLSearchParams({
    cursor,
    limit: String(PAGE_SIZE),
  });
  const res = await fetch(
    `/api/challenges/${encodeURIComponent(slug)}/activities?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Activity page failed (${res.status})`);
  }
  return (await res.json()) as ActivityPage;
}

function activitiesKey(items: ActivityItem[]) {
  return items
    .map(
      (item) =>
        `${item.id}:${item.reactions.map((r) => `${r.emoji}${r.count}${r.reactedByMe ? 1 : 0}`).join(",")}`,
    )
    .join("|");
}

type ActivityFeedInfiniteProps = {
  slug: string;
  initialItems: ActivityItem[];
  initialCursor: string | null;
  canReact?: boolean;
};

/** Activity page — load more on scroll only (no background polling). */
export function ActivityFeedInfinite({
  slug,
  initialItems,
  initialCursor,
  canReact = false,
}: ActivityFeedInfiniteProps) {
  const [items, setItems] = useState(() => coalesceActivityItems(initialItems));
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(initialCursor);
  const errorRef = useRef(false);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  async function loadMore(pageCursor: string) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    errorRef.current = false;
    try {
      const page = await fetchActivityPage(slug, pageCursor);
      setItems((prev) => coalesceActivityItems([...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch {
      errorRef.current = true;
      setError("Couldn’t load more activity");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    // Pause auto-fetch after a failure so we don't hammer the function.
    if (!sentinel || !cursor || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const pageCursor = cursorRef.current;
        if (loadingRef.current || errorRef.current || !pageCursor) return;
        void loadMore(pageCursor);
      },
      { rootMargin: "240px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [slug, cursor, error]);

  return (
    <Frame title="Activity">
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          No activity yet. Updates show here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ActivityRow
              key={item.id}
              slug={slug}
              item={item}
              canReact={canReact}
            />
          ))}
        </ul>
      )}
      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loading && (
        <p className="mt-2 text-center text-sm text-muted">Loading…</p>
      )}
      {error && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <p className="text-center text-sm text-danger">{error}</p>
          {cursor && (
            <button
              type="button"
              className="text-sm text-accent-deep underline-offset-2 hover:underline"
              onClick={() => {
                const pageCursor = cursorRef.current;
                if (pageCursor) void loadMore(pageCursor);
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {!cursor && items.length > 0 && (
        <p className="mt-3 text-center text-xs text-muted">End of activity</p>
      )}
    </Frame>
  );
}
function ActivityRow({
  slug,
  item,
  canReact,
}: {
  slug: string;
  item: ActivityItem;
  canReact: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const reactionKey = activitiesKey([item]);
  const [seenReactionKey, setSeenReactionKey] = useState(reactionKey);
  const [override, setOverride] = useState<ActivityReactionSummary[] | null>(
    null,
  );

  if (reactionKey !== seenReactionKey) {
    setSeenReactionKey(reactionKey);
    setOverride(null);
  }

  const baseReactions = override ?? item.reactions ?? [];
  const [reactions, setOptimistic] = useOptimistic(
    baseReactions,
    (current, emoji: string) => mergeReaction(current, emoji),
  );

  const visibleReactions = reactions.filter((r) => r.count > 0);

  function closePicker() {
    setPickerOpen(false);
    setMoreOpen(false);
  }

  function react(emoji: string) {
    if (!canReact) return;
    closePicker();
    const previous = baseReactions;
    startTransition(async () => {
      setOptimistic(emoji);
      setOverride(mergeReaction(previous, emoji));
      const result = await postActivityReaction(item.id, emoji);
      if (!result.ok) {
        setOverride(previous);
      }
    });
  }

  function onEmojiClick(data: EmojiClickData) {
    react(data.emoji);
  }

  const avatarSrc = item.avatarSrc ?? APP_MARK;
  const avatarLabel = item.trainerHandle
    ? `${item.trainerHandle}'s avatar`
    : "Nuzlocke Manager";
  // Showdown trainer sprites are full-body; bias crop toward the head.
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
      className={`relative mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface-2 transition-colors ${
        trainerHref
          ? "border-frame group-hover/avatar:border-accent-deep group-focus-visible/avatar:border-accent-deep"
          : "border-frame"
      }`}
      title={avatarLabel}
    >
      <Image
        src={avatarSrc}
        alt=""
        width={32}
        height={32}
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
    <li className="group relative border-b border-frame/20 pb-3 last:border-0">
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
          <p className="text-sm leading-snug">
            <ActivityMessageText
              message={item.message}
              trainerHandle={item.trainerHandle}
              trainerHref={trainerHref}
            />
          </p>
          <p className="mt-1 text-[11px] tracking-tight text-muted">
            {item.type.replaceAll("_", " ")}
            {" · "}
            {formatActivityWhen(item.createdAt)}
            {item.trainerHandle && (
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
            )}
          </p>
        </div>

        {canReact && (
          <div className="relative shrink-0">
            <button
              type="button"
              disabled={pending}
              aria-label="Add reaction"
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
              title="Add reaction"
              className={`rounded-lg border border-frame/40 bg-surface-2 p-1 text-muted transition-opacity pressable hover:bg-accent/10 hover:text-ink ${
                pickerOpen
                  ? "opacity-100"
                  : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              }`}
              onClick={() => {
                setPickerOpen((open) => !open);
                setMoreOpen(false);
              }}
            >
              <AddReactionIcon />
            </button>

            {pickerOpen && (
              <>
                <button
                  type="button"
                  aria-label="Dismiss emoji picker"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={closePicker}
                />
                <div
                  role="dialog"
                  aria-label="Emoji reactions"
                  className="absolute top-full right-0 z-20 mt-1 max-w-[min(100vw-2rem,20rem)] rounded-lg border border-frame bg-surface p-1.5 shadow-lg"
                >
                  <div className="flex flex-wrap items-center gap-0.5 pr-0.5">
                    {QUICK_EMOJIS.map((emoji) => {
                      const active = Boolean(
                        reactions.find((r) => r.emoji === emoji)?.reactedByMe,
                      );
                      return (
                        <button
                          key={emoji}
                          type="button"
                          disabled={pending}
                          title={emoji}
                          className={`rounded-lg px-1.5 py-1 text-base leading-none hover:bg-accent/15 ${
                            active ? "bg-accent/20" : ""
                          }`}
                          onClick={() => react(emoji)}
                        >
                          <span aria-hidden>{emoji}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={pending}
                      aria-label="More emojis"
                      aria-expanded={moreOpen}
                      title="More emojis"
                      className={`ml-0.5 shrink-0 rounded-lg border border-frame/40 px-2 py-1 font-display text-sm font-bold leading-none hover:bg-accent/15 ${
                        moreOpen
                          ? "border-accent bg-accent/20 text-accent-deep"
                          : "bg-surface-2 text-muted"
                      }`}
                      onClick={() => setMoreOpen((open) => !open)}
                    >
                      +
                    </button>
                  </div>

                  {moreOpen && (
                    <div className="emoji-picker-shell mt-1.5 overflow-hidden rounded-lg border border-frame/30">
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme={Theme.AUTO}
                        emojiStyle={EmojiStyle.NATIVE}
                        width="100%"
                        height={360}
                        searchPlaceHolder="Search emoji…"
                        previewConfig={{ showPreview: false }}
                        skinTonesDisabled
                        lazyLoadEmojis
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {visibleReactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visibleReactions.map((summary) => (
            <button
              key={summary.emoji}
              type="button"
              disabled={!canReact || pending}
              title={canReact ? "Toggle reaction" : undefined}
              className={`rounded-lg border px-1.5 py-0.5 text-sm ${
                summary.reactedByMe
                  ? "border-accent bg-accent/15"
                  : "border-frame/40 bg-surface-2"
              } ${canReact ? "pressable hover:bg-accent/10" : "cursor-default"}`}
              onClick={() => react(summary.emoji)}
            >
              <span aria-hidden>{summary.emoji}</span>
              <span className="ml-1 text-[11px] font-bold text-muted">
                {summary.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function formatActivityWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/New_York",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ActivityMessageText({
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
          {index > 0 && (
            <Link
              href={trainerHref}
              className="underline-offset-2 hover:text-accent-deep hover:underline"
            >
              {trainerHandle}
            </Link>
          )}
          {part}
        </span>
      ))}
    </>
  );
}

function AddReactionIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="block"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.75" cy="6.75" r="0.9" fill="currentColor" />
      <circle cx="10.25" cy="6.75" r="0.9" fill="currentColor" />
      <path
        d="M5.5 9.75c.7 1 1.55 1.5 2.5 1.5s1.8-.5 2.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12.75 2.5v3M11.25 4h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
