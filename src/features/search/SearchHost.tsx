"use client";

import type { ReactNode } from "react";
import { AskChrome } from "@/features/search/AskDrawer";
import { SearchPalette } from "@/features/search/SearchPalette";
import { SearchProvider } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";
import { useFeatureFlag } from "@/lib/use-feature-flag";

/** Root mount: provider + Jump palette; Ask drawer only when `ai-drawer` is on. */
export function SearchHost({
  children,
  defaultSeason = null,
}: {
  children: ReactNode;
  defaultSeason?: SearchSeasonContext | null;
}) {
  return (
    <SearchProvider defaultSeason={defaultSeason}>
      <SearchHostBody>{children}</SearchHostBody>
      <SearchPalette />
    </SearchProvider>
  );
}

function SearchHostBody({ children }: { children: ReactNode }) {
  const aiDrawer = useFeatureFlag("ai-drawer");
  if (aiDrawer) return <AskChrome>{children}</AskChrome>;
  return <>{children}</>;
}
