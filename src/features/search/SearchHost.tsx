"use client";

import type { ReactNode } from "react";
import { AskChrome } from "@/features/search/AskDrawer";
import { SearchPalette } from "@/features/search/SearchPalette";
import { SearchProvider } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";

/** Root mount: provider + Jump palette; Ask drawer only when `ai-drawer` is on. */
export function SearchHost({
  children,
  defaultSeason = null,
  aiDrawer = false,
}: {
  children: ReactNode;
  defaultSeason?: SearchSeasonContext | null;
  /** Server-evaluated Vercel Flags value for `ai-drawer`. */
  aiDrawer?: boolean;
}) {
  return (
    <SearchProvider defaultSeason={defaultSeason} aiDrawer={aiDrawer}>
      {aiDrawer ? <AskChrome>{children}</AskChrome> : children}
      <SearchPalette />
    </SearchProvider>
  );
}
