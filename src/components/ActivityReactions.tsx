"use client";

import { useOptimistic, useState, useTransition } from "react";
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";
import type { ActivityReactionSummary } from "@/lib/challenge-types";

const QUICK_EMOJIS = ["🔥", "💀", "👏", "😮", "❤️", "🎉"] as const;

type ReactionResult = { ok: true } | { ok: false; error?: string };

export async function postActivityReaction(
  activityId: string,
  emoji: string,
): Promise<ReactionResult> {
  const res = await fetch(
    `/api/activities/${encodeURIComponent(activityId)}/reactions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
      cache: "no-store",
    },
  );
  try {
    return (await res.json()) as ReactionResult;
  } catch {
    return { ok: false, error: "Reaction failed" };
  }
}

export function mergeReaction(
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

function reactionsKey(reactions: ActivityReactionSummary[]) {
  return reactions
    .map((r) => `${r.emoji}${r.count}${r.reactedByMe ? 1 : 0}`)
    .join(",");
}

type ActivityReactionsProps = {
  activityId: string;
  reactions: ActivityReactionSummary[];
  canReact?: boolean;
  className?: string;
};

/** Compact Pack emoji reactions for Headline Moments (rail carousel). */
export function ActivityReactions({
  activityId,
  reactions: propReactions,
  canReact = false,
  className = "",
}: ActivityReactionsProps) {
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const reactionKey = reactionsKey(propReactions);
  const [seenReactionKey, setSeenReactionKey] = useState(reactionKey);
  const [override, setOverride] = useState<ActivityReactionSummary[] | null>(
    null,
  );

  if (reactionKey !== seenReactionKey) {
    setSeenReactionKey(reactionKey);
    setOverride(null);
  }

  const baseReactions = override ?? propReactions ?? [];
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
      const result = await postActivityReaction(activityId, emoji);
      if (!result.ok) {
        setOverride(previous);
      }
    });
  }

  function onEmojiClick(data: EmojiClickData) {
    react(data.emoji);
  }

  if (!canReact && visibleReactions.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 ${className || "mt-2"}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
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

      {canReact && (
        <div className="relative ml-auto shrink-0">
          <button
            type="button"
            disabled={pending}
            aria-label="Add reaction"
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            title="Add reaction"
            className="rounded-lg border border-frame/40 bg-surface-2 p-1 text-muted pressable hover:bg-accent/10 hover:text-ink"
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
                className="absolute right-0 bottom-full z-20 mb-1 max-w-[min(100vw-2rem,20rem)] rounded-lg border border-frame bg-surface p-1.5 shadow-lg"
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
                      height={320}
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
