"use client";

import { useOptimistic, useTransition } from "react";
import { toggleActivityReactionAction } from "@/app/actions/challenge";
import { Frame } from "@/components/Frame";
import type {
  ActivityItem,
  ActivityReactionSummary,
} from "@/lib/challenge-types";

const FEED_EMOJIS = ["🔥", "💀", "👏", "😮", "❤️", "🎉"] as const;

type ActivityFeedProps = {
  activities: ActivityItem[];
  canReact?: boolean;
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

export function ActivityFeed({
  activities,
  canReact = false,
}: ActivityFeedProps) {
  return (
    <Frame title="Clubhouse feed">
      {activities.length === 0 ? (
        <p className="text-sm text-muted">No activity yet. Updates show here.</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((item) => (
            <ActivityRow key={item.id} item={item} canReact={canReact} />
          ))}
        </ul>
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
  const [reactions, setOptimistic] = useOptimistic(
    item.reactions ?? [],
    (current, emoji: string) => mergeReaction(current, emoji),
  );

  return (
    <li className="border-b border-frame/20 pb-3 last:border-0">
      <p className="text-sm leading-snug">{item.message}</p>
      <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">
        {item.type.replaceAll("_", " ")}
        {" · "}
        {new Date(item.createdAt).toLocaleString()}
        {item.trainerHandle ? ` · ${item.trainerHandle}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FEED_EMOJIS.map((emoji) => {
          const summary = reactions.find((r) => r.emoji === emoji);
          const active = Boolean(summary?.reactedByMe);
          const count = summary?.count ?? 0;
          if (!canReact && count === 0) return null;
          return (
            <button
              key={emoji}
              type="button"
              disabled={!canReact || pending}
              title={canReact ? "Toggle reaction" : undefined}
              className={`rounded-sm border px-1.5 py-0.5 text-sm ${
                active
                  ? "border-accent bg-accent/15"
                  : "border-frame/40 bg-surface-2"
              } ${canReact ? "pressable hover:bg-accent/10" : "cursor-default"}`}
              onClick={() => {
                if (!canReact) return;
                startTransition(async () => {
                  setOptimistic(emoji);
                  await toggleActivityReactionAction({
                    activityId: item.id,
                    emoji,
                  });
                });
              }}
            >
              <span aria-hidden>{emoji}</span>
              {count > 0 ? (
                <span className="ml-1 text-[11px] font-bold text-muted">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </li>
  );
}
