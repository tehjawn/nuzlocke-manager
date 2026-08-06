"use client";

import { useEffect } from "react";
import { useSearch } from "@/features/search/SearchProvider";

/**
 * Pushes the server-evaluated `ai-drawer` flag into SearchProvider (#313).
 *
 * Ask chrome is invisible until the user opens it, so arriving a tick after
 * hydration costs nothing — and it keeps the request-time flag read out of the
 * root layout's render path, where it was forcing every route dynamic.
 */
export function AiDrawerFlagSync({ enabled }: { enabled: boolean }) {
  const { setAiDrawer } = useSearch();

  useEffect(() => {
    setAiDrawer(enabled);
  }, [enabled, setAiDrawer]);

  return null;
}
