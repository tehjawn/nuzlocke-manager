"use client";

import type { ReactNode } from "react";
import { SearchPalette } from "@/features/search/SearchPalette";
import { SearchProvider } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";

/** Root mount: provider + portal palette above the whole app. */
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
    </SearchProvider>
  );
}
