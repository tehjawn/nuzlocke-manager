"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { setBadgeProgressAction } from "@/app/actions/challenge";
import { BadgeCase } from "@/components/BadgeCase";
import { SaveStatus, useSaveStatus } from "@/components/SaveStatus";
import type { BadgeDefinition } from "@/lib/challenge-types";

type BadgeCaseEditorProps = {
  trainerId: string;
  badges: BadgeDefinition[];
  earnedKeys: string[];
  compact?: boolean;
  layout?: "grid" | "column";
  onEarnedKeysChange?: (keys: string[]) => void;
};

const DEBOUNCE_MS = 280;

function toggleKey(keys: string[], badgeKey: string, earned: boolean) {
  const set = new Set(keys);
  if (earned) set.add(badgeKey);
  else set.delete(badgeKey);
  return [...set];
}

export function BadgeCaseEditor({
  trainerId,
  badges,
  earnedKeys,
  compact,
  layout,
  onEarnedKeysChange,
}: BadgeCaseEditorProps) {
  const [, startTransition] = useTransition();
  const { status, markSaving, markSaved, markError } = useSaveStatus();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [optimisticKeys, setOptimistic] = useOptimistic(
    earnedKeys,
    (current, update: { badgeKey: string; earned: boolean }) =>
      toggleKey(current, update.badgeKey, update.earned),
  );

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      for (const timer of timersMap.values()) clearTimeout(timer);
      timersMap.clear();
    };
  }, []);

  function onToggle(badgeKey: string, earned: boolean) {
    startTransition(() => {
      setOptimistic({ badgeKey, earned });
    });
    const next = toggleKey(earnedKeys, badgeKey, earned);
    onEarnedKeysChange?.(next);

    const existing = timers.current.get(badgeKey);
    if (existing) clearTimeout(existing);

    markSaving("Updating badges…");
    timers.current.set(
      badgeKey,
      setTimeout(() => {
        timers.current.delete(badgeKey);
        void (async () => {
          const result = await setBadgeProgressAction({
            trainerId,
            badgeKey,
            earned,
          });
          if (!result.ok) {
            onEarnedKeysChange?.(toggleKey(next, badgeKey, !earned));
            markError(result.error);
            return;
          }
          if (timers.current.size === 0) {
            markSaved("Badges saved");
          }
        })();
      }, DEBOUNCE_MS),
    );
  }

  return (
    <div className="space-y-2">
      <BadgeCase
        badges={badges}
        earnedKeys={optimisticKeys}
        compact={compact}
        layout={layout}
        onToggle={onToggle}
      />
      <SaveStatus status={status} />
    </div>
  );
}
