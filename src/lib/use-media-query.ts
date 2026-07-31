"use client";

import { useSyncExternalStore } from "react";

type MediaQueryStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => boolean;
};

const stores = new Map<string, MediaQueryStore>();

function getMediaQueryStore(query: string): MediaQueryStore {
  const existing = stores.get(query);
  if (existing) return existing;

  let snapshot =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  const listeners = new Set<() => void>();
  let mql: MediaQueryList | null = null;

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const onChange = () => {
    if (!mql) return;
    snapshot = mql.matches;
    emit();
  };

  const store: MediaQueryStore = {
    subscribe(onStoreChange) {
      if (
        listeners.size === 0 &&
        typeof window !== "undefined" &&
        window.matchMedia
      ) {
        mql = window.matchMedia(query);
        snapshot = mql.matches;
        mql.addEventListener("change", onChange);
      }
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0 && mql) {
          mql.removeEventListener("change", onChange);
          mql = null;
        }
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };

  stores.set(query, store);
  return store;
}

/**
 * Subscribe to a CSS media query without useEffect.
 * SSR / first paint uses `serverFallback` (default false).
 */
export function useMediaQuery(
  query: string,
  serverFallback = false,
): boolean {
  const store = getMediaQueryStore(query);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => serverFallback,
  );
}
