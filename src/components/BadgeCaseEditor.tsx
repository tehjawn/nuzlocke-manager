"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { setBadgesProgressAction } from "@/app/actions/challenge";
import { BadgeCase } from "@/components/BadgeCase";
import { SaveStatus, useSaveStatus } from "@/components/SaveStatus";
import { triggerFx } from "@/features/fx";
import type { BadgeDefinition } from "@/lib/challenge-types";

type BadgeCaseEditorProps = {
  trainerId: string;
  badges: BadgeDefinition[];
  earnedKeys: string[];
  /** Snapshot for rejecting badge writes that race a wipe. */
  wipeCount?: number;
  compact?: boolean;
  dense?: boolean;
  layout?: "grid" | "column" | "tray";
  disabled?: boolean;
  onEarnedKeysChange?: (keys: string[]) => void;
};

/** Quiet window across the whole case — flush as one condensed feed entry. */
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
  dense,
  layout,
  disabled = false,
  onEarnedKeysChange,
}: BadgeCaseEditorProps) {
  const [, startTransition] = useTransition();
  const { status, markSaving, markSaved, markError } = useSaveStatus();
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest intended earned state per key since last flush. */
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  /** Last successfully saved (or prop-synced) keys — used to drop no-op toggles. */
  const baselineRef = useRef(new Set(earnedKeys));
  const wipeSnapshotRef = useRef(wipeCount);
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
    if (
      pendingRef.current.size === 0 &&
      flushTimerRef.current == null &&
      inFlightRef.current === 0
    ) {
      baselineRef.current = new Set(earnedKeys);
    }
  }, [earnedKeys]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current != null) clearTimeout(flushTimerRef.current);
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

    if (pendingRef.current.size === 0) {
      wipeSnapshotRef.current = wipeCount;
    }
    pendingRef.current.set(badgeKey, earned);

    if (flushTimerRef.current != null) clearTimeout(flushTimerRef.current);
    markSaving("Updating badges…");
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = new Map();

      const changes = [...pending.entries()]
        .filter(([key, wantEarned]) => baselineRef.current.has(key) !== wantEarned)
        .map(([key, wantEarned]) => ({ badgeKey: key, earned: wantEarned }));

      if (changes.length === 0) {
        if (inFlightRef.current === 0) markSaved("Badges saved");
        return;
      }

      const wipeSnapshot = wipeSnapshotRef.current;
      inFlightRef.current += 1;
      void (async () => {
        const result = await setBadgesProgressAction({
          trainerId,
          changes,
          expectedWipeCount: wipeSnapshot,
        });
        inFlightRef.current -= 1;
        if (!mountedRef.current) return;
        if (!result.ok) {
          let rolled = latestKeysRef.current;
          for (const change of changes) {
            rolled = toggleKey(rolled, change.badgeKey, !change.earned);
          }
          latestKeysRef.current = rolled;
          onEarnedKeysChange?.(rolled);
          markError(result.error);
          return;
        }
        for (const change of changes) {
          if (change.earned) {
            baselineRef.current.add(change.badgeKey);
            triggerFx("badge_earned", { badgeKey: change.badgeKey });
          } else {
            baselineRef.current.delete(change.badgeKey);
          }
        }
        if (
          pendingRef.current.size === 0 &&
          flushTimerRef.current == null &&
          inFlightRef.current === 0
        ) {
          markSaved("Badges saved");
        }
      })();
    }, DEBOUNCE_MS);
  }

  return (
    <div className="space-y-2">
      <BadgeCase
        badges={badges}
        earnedKeys={optimisticKeys}
        compact={compact}
        dense={dense}
        layout={layout}
        onToggle={disabled ? undefined : onToggle}
      />
      <SaveStatus status={status} />
    </div>
  );
}
