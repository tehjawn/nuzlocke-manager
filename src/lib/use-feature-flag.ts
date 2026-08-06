"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  isFeatureEnabled,
  persistFeatureFlagFromUrl,
  resolveFeatureFlag,
  type FeatureFlag,
} from "@/lib/feature-flags";

/**
 * Client feature-flag hook. Env default is SSR-safe; URL/cookie overrides
 * apply on the client via `useSyncExternalStore`.
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  useEffect(() => {
    persistFeatureFlagFromUrl(flag);
  }, [flag]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    const onChange = () => onStoreChange();
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  const getSnapshot = useCallback(() => resolveFeatureFlag(flag), [flag]);
  const getServerSnapshot = useCallback(() => isFeatureEnabled(flag), [flag]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
