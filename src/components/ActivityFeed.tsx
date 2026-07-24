"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
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
import type {
  ActivityItem,
  ActivityReactionSummary,
} from "@/lib/challenge-types";

const QUICK_EMOJIS = ["🔥", "💀", "👏", "😮", "❤️", "🎉"] as const;
const POLL_MS = 12_000;

type ActivityFeedProps = {
  slug: string;
  activities: ActivityItem[];
  canReact?: boolean;
  /** When set, show this many rows first with a Show more control. */
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
  const propKey = activitiesKey(activitiesProp);
  const [seenPropKey, setSeenPropKey] = useState(propKey);
  const [polled, setPolled] = useState<ActivityItem[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (propKey !== seenPropKey) {
    setSeenPropKey(propKey);
    setPolled(null);
  }

  const activities = polled ?? activitiesProp;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await fetchChallengeActivitiesAction({ slug });
        if (!cancelled) setPolled(next);
      } catch {
        // ignore transient poll failures
      }
    }

    const id = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug]);

  const collapsible =
    typeof previewCount === "number" && activities.length > previewCount;
  const visible =
    collapsible && !expanded
      ? activities.slice(0, previewCount)
      : activities;

  return (
    <Frame title="Pack feed">
      {activities.length === 0 ? (
        <p className="text-sm text-muted">No activity yet. Updates show here.</p>
      ) : (
        <>
          <div
            className={
              expanded && collapsible
                ? "max-h-[28rem] overflow-y-auto pr-2 [scrollbar-gutter:stable]"
                : undefined
            }
          >
            <ul className="space-y-3">
              {visible.map((item) => (
                <ActivityRow key={item.id} item={item} canReact={canReact} />
              ))}
            </ul>
          </div>
          {collapsible ? (
            <button
              type="button"
              className="pressable mt-3 w-full rounded-sm bg-surface px-3 py-2 text-sm font-bold"
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded
                ? "Show less"
                : `Show more (${activities.length - previewCount} more)`}
            </button>
          ) : null}
        </>
      )}
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

  return (
    <li className="group relative border-b border-frame/20 pb-3 last:border-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{item.message}</p>
          <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">
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
              className={`rounded-sm border border-frame/40 bg-surface-2 p-1 text-muted transition-opacity pressable hover:bg-accent/10 hover:text-ink ${
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
                  className="absolute top-full right-0 z-20 mt-1 max-w-[min(100vw-2rem,20rem)] rounded-sm border-2 border-frame bg-surface p-1.5 shadow-[3px_3px_0_var(--shadow)]"
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
                          className={`rounded-sm px-1.5 py-1 text-base leading-none hover:bg-accent/15 ${
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
                      className={`ml-0.5 shrink-0 rounded-sm border border-frame/40 px-2 py-1 font-display text-sm font-bold leading-none hover:bg-accent/15 ${
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
                    <div className="emoji-picker-shell mt-1.5 overflow-hidden rounded-sm border border-frame/30">
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme={Theme.LIGHT}
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
              className={`rounded-sm border px-1.5 py-0.5 text-sm ${
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
