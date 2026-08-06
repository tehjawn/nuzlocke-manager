"use client";

import type { ReactNode } from "react";
import { AskDrawer } from "@/features/search/AskDrawer";
import { SearchPalette } from "@/features/search/SearchPalette";
import { SearchProvider } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";

/** Root mount: provider + Jump palette + Ask drawer above the whole app. */
export function SearchHost({
  children,
  defaultSeason = null,
}: {
  children: ReactNode;
  defaultSeason?: SearchSeasonContext | null;
}) {
  return (
    <SearchProvider defaultSeason={defaultSeason}>
      {children}
      <SearchPalette />
      <AskDrawer />
    </SearchProvider>
  );
}
