"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  fetchChallengeActivitiesAction,
  toggleActivityReactionAction,
} from "@/app/actions/challenge";
import { Frame } from "@/components/Frame";
import { coalesceActivityItems } from "@/lib/activity-messages";
import type {
  ActivityItem,
  ActivityReactionSummary,
} from "@/lib/challenge-types";

const APP_MARK = "/nuzlocke-mark.png";

const QUICK_EMOJIS = ["🔥", "💀", "👏", "😮", "❤️", "🎉"] as const;
const POLL_MS = 12_000;
const POLL_IDLE_MS = 30_000;
const PAGE_SIZE = 30;

type ActivityFeedProps = {
  slug: string;
  activities: ActivityItem[];
  canReact?: boolean;
  /** When set, show this many rows with a link to the full activity page. */
  previewCount?: number;
};

function mergeReaction(
  reactions: ActivityReactionSummary[],
  emoji: string,
): ActivityReactionSummary[] {
  const next = reactions.map((r) => ({ ...r }));
  const hit = next.find((r) => r.emoji === emoji);
  if (hit) {
    if (hit.reactedByMe) {
      hit.count -= 1;
      hit.reactedByMe = false;
      return next.filter((r) => r.count > 0);
    }
    hit.count += 1;
    hit.reactedByMe = true;
    return next;
  }
  return [...next, { emoji, count: 1, reactedByMe: true }];
}

function activitiesKey(items: ActivityItem[]) {
  return items
    .map(
      (item) =>
        `${item.id}:${item.reactions.map((r) => `${r.emoji}${r.count}${r.reactedByMe ? 1 : 0}`).join(",")}`,
    )
    .join("|");
}

export function ActivityFeed({
  slug,
  activities: activitiesProp,
  canReact = false,
  previewCount,
}: ActivityFeedProps) {
  const pathname = usePathname() ?? "";
  const onFullPage = pathname === `/challenges/${slug}/activity`;
  const propKey = activitiesKey(activitiesProp);
  const [seenPropKey, setSeenPropKey] = useState(propKey);
  const [polled, setPolled] = useState<ActivityItem[] | null>(null);
  const headRef = useRef<string | null>(null);
  const lastChangeAtRef = useRef<number>(Date.now());

  if (propKey !== seenPropKey) {
    setSeenPropKey(propKey);
    setPolled(null);
    headRef.current = null;
    lastChangeAtRef.current = Date.now();
  }

  const activities = coalesceActivityItems(polled ?? activitiesProp);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await fetchChallengeActivitiesAction({
          slug,
          limit: previewCount != null ? Math.max(previewCount * 4, 20) : 20,
          head: headRef.current,
        });
        if (cancelled) return;
        if (next.head) headRef.current = next.head;
        if (!next.unchanged) {
          lastChangeAtRef.current = Date.now();
          setPolled(next.items);
        }
      } catch {
        // ignore transient poll failures
      }
    }

    function schedule() {
      if (cancelled) return;
      const idle =
        Date.now() - lastChangeAtRef.current > POLL_IDLE_MS * 2
          ? POLL_IDLE_MS
          : POLL_MS;
      timeoutId = setTimeout(async () => {
        await poll();
        schedule();
      }, idle);
    }

    void poll().then(schedule);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, previewCount]);

  const visible =
    typeof previewCount === "number"
      ? activities.slice(0, previewCount)
      : activities;
  const showAllLink =
    typeof previewCount === "number" && !onFullPage && activities.length > 0;

  return (
    <Frame title="Pack feed">
      {activities.length === 0 ? (
        <p className="text-sm text-muted">No activity yet. Updates show here.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {visible.map((item) => (
              <ActivityRow key={item.id} item={item} canReact={canReact} />
            ))}
          </ul>
          {showAllLink ? (
            <Link
              href={`/challenges/${slug}/activity`}
              className="pressable mt-3 flex w-full items-center justify-center rounded-lg bg-surface px-3 py-2 text-sm font-bold hover:bg-accent/10"
            >
              View all activity
            </Link>
          ) : null}
        </>
      )}
    </Frame>
  );
}

type ActivityFeedInfiniteProps = {
  slug: string;
  initialItems: ActivityItem[];
  initialCursor: string | null;
  canReact?: boolean;
};

/** Full Pack feed page — cursor pages loaded via IntersectionObserver. */
export function ActivityFeedInfinite({
  slug,
  initialItems,
  initialCursor,
  canReact = false,
}: ActivityFeedInfiniteProps) {
  const [items, setItems] = useState(() =>
    coalesceActivityItems(initialItems),
  );
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(initialCursor);
  const paginatedRef = useRef(false);
  const headRef = useRef<string | null>(null);
  const lastChangeAtRef = useRef<number>(Date.now());

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  // Fresh first page while the tab is visible (same cadence as the rail).
  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await fetchChallengeActivitiesAction({
          slug,
          limit: PAGE_SIZE,
          head: headRef.current,
        });
        if (cancelled) return;
        if (next.head) headRef.current = next.head;
        if (next.unchanged) return;
        lastChangeAtRef.current = Date.now();
        if (!paginatedRef.current) {
          setItems(coalesceActivityItems(next.items));
          setCursor(next.nextCursor);
          return;
        }
        setItems((prev) => {
          const ids = new Set(next.items.map((item) => item.id));
          const older = prev.filter((item) => !ids.has(item.id));
          return coalesceActivityItems([...next.items, ...older]);
        });
      } catch {
        // ignore
      }
    }

    function schedule() {
      if (cancelled) return;
      const idle =
        Date.now() - lastChangeAtRef.current > POLL_IDLE_MS * 2
          ? POLL_IDLE_MS
          : POLL_MS;
      timeoutId = setTimeout(async () => {
        await poll();
        schedule();
      }, idle);
    }

    void poll().then(schedule);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const pageCursor = cursorRef.current;
        if (loadingRef.current || !pageCursor) return;
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        void (async () => {
          try {
            const page = await fetchChallengeActivitiesAction({
              slug,
              cursor: pageCursor,
              limit: PAGE_SIZE,
            });
            paginatedRef.current = true;
            setItems((prev) =>
              coalesceActivityItems([...prev, ...page.items]),
            );
            setCursor(page.nextCursor);
          } catch {
            setError("Couldn’t load more activity");
          } finally {
            loadingRef.current = false;
            setLoading(false);
          }
        })();
      },
      { rootMargin: "240px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [slug, cursor]);

  return (
    <Frame title="Pack feed">
      {items.length === 0 ? (
        <p className="text-sm text-muted">No activity yet. Updates show here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} canReact={canReact} />
          ))}
        </ul>
      )}
      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loading ? (
        <p className="mt-2 text-center text-sm text-muted">Loading…</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-center text-sm text-danger">{error}</p>
      ) : null}
      {!cursor && items.length > 0 ? (
        <p className="mt-3 text-center text-xs text-muted">End of feed</p>
      ) : null}
    </Frame>
  );
}

function ActivityRow({
  item,
  canReact,
}: {
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
      const result = await toggleActivityReactionAction({
        activityId: item.id,
        emoji,
      });
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
  const isSpriteAvatar = Boolean(
    item.avatarSrc &&
      !item.avatarSrc.startsWith("/") &&
      !item.avatarSrc.includes("discord") &&
      !item.avatarSrc.includes("blob.vercel-storage.com"),
  );

  return (
    <li className="group relative border-b border-frame/20 pb-3 last:border-0">
      <div className="flex items-start gap-2.5">
        <span
          className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-frame bg-surface-2"
          title={avatarLabel}
        >
          <Image
            src={avatarSrc}
            alt=""
            width={32}
            height={32}
            className={
              isSpriteAvatar
                ? "pixelated h-full w-full object-contain p-0.5"
                : "h-full w-full object-cover"
            }
            unoptimized
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{item.message}</p>
          <p className="mt-1 text-[11px] tracking-tight text-muted">
            {item.type.replaceAll("_", " ")}
            {" · "}
            {new Date(item.createdAt).toLocaleString()}
            {item.trainerHandle ? ` · ${item.trainerHandle}` : ""}
          </p>
        </div>

        {canReact ? (
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

            {pickerOpen ? (
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

                  {moreOpen ? (
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
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {visibleReactions.length > 0 ? (
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
      ) : null}
    </li>
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
