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
  /** Snapshot for rejecting badge writes that race a wipe. */
  wipeCount?: number;
  compact?: boolean;
  layout?: "grid" | "column";
  disabled?: boolean;
  onEarnedKeysChange?: (keys: string[]) => void;
};

/** Debounce server writes; keep UI optimistic from a local keys ref. */
const DEBOUNCE_MS = 450;

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
  wipeCount = 0,
  compact,
  layout,
  disabled = false,
  onEarnedKeysChange,
}: BadgeCaseEditorProps) {
  const [, startTransition] = useTransition();
  const { status, markSaving, markSaved, markError } = useSaveStatus();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Latest keys including optimistic toggles — avoids stale-prop rubber banding. */
  const latestKeysRef = useRef(earnedKeys);
  const inFlightRef = useRef(0);

  const [optimisticKeys, setOptimistic] = useOptimistic(
    earnedKeys,
    (current, update: { badgeKey: string; earned: boolean }) =>
      toggleKey(current, update.badgeKey, update.earned),
  );

  useEffect(() => {
    latestKeysRef.current = earnedKeys;
  }, [earnedKeys]);

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      for (const timer of timersMap.values()) clearTimeout(timer);
      timersMap.clear();
    };
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function onToggle(badgeKey: string, earned: boolean) {
    if (disabled) return;
    const next = toggleKey(latestKeysRef.current, badgeKey, earned);
    latestKeysRef.current = next;

    startTransition(() => {
      setOptimistic({ badgeKey, earned });
    });
    onEarnedKeysChange?.(next);

    const existing = timers.current.get(badgeKey);
    if (existing) clearTimeout(existing);

    const wipeSnapshot = wipeCount;
    markSaving("Updating badges…");
    timers.current.set(
      badgeKey,
      setTimeout(() => {
        timers.current.delete(badgeKey);
        inFlightRef.current += 1;
        void (async () => {
          const result = await setBadgeProgressAction({
            trainerId,
            badgeKey,
            earned,
            expectedWipeCount: wipeSnapshot,
          });
          inFlightRef.current -= 1;
          if (!mountedRef.current) return;
          if (!result.ok) {
            const rolled = toggleKey(latestKeysRef.current, badgeKey, !earned);
            latestKeysRef.current = rolled;
            onEarnedKeysChange?.(rolled);
            markError(result.error);
            return;
          }
          if (timers.current.size === 0 && inFlightRef.current === 0) {
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
        onToggle={disabled ? undefined : onToggle}
      />
      <SaveStatus status={status} />
    </div>
  );
}
