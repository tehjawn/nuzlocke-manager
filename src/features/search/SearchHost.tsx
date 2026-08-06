"use client";

import type { ReactNode } from "react";
import { AskChrome } from "@/features/search/AskDrawer";
import { SearchPalette } from "@/features/search/SearchPalette";
import { SearchProvider } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";

/** Root mount: provider + push-layout Ask chrome + Jump palette. */
export function SearchHost({
  children,
  defaultSeason = null,
}: {
  children: ReactNode;
  defaultSeason?: SearchSeasonContext | null;
}) {
  return (
    <SearchProvider defaultSeason={defaultSeason}>
      <AskChrome>{children}</AskChrome>
      <SearchPalette />
    </SearchProvider>
  );
}
