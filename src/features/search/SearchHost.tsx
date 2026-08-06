"use client";

import type { ReactNode } from "react";
import { AskChrome } from "@/features/search/AskDrawer";
import { SearchPalette } from "@/features/search/SearchPalette";
import { SearchProvider } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Root mount: provider + Jump palette + Ask chrome.
 *
 * `flagGate` carries the Suspense-wrapped server evaluation of `ai-drawer` as a
 * slot, so a client component can host it without the root layout awaiting the
 * flag itself (#313).
 */
export function SearchHost({
  children,
  defaultSeason = null,
  flagGate = null,
}: {
  children: ReactNode;
  defaultSeason?: SearchSeasonContext | null;
  /** <Suspense><AiDrawerFlagGate /></Suspense> from the root layout. */
  flagGate?: ReactNode;
}) {
  return (
    <SearchProvider defaultSeason={defaultSeason}>
      {flagGate}
      <AskChrome>{children}</AskChrome>
      <SearchPalette />
    </SearchProvider>
  );
}
