"use client";

import { useLayoutEffect } from "react";
import { useSearch } from "@/features/search/SearchProvider";
import type { SearchSeasonContext } from "@/features/search/search-types";

type SeasonSearchRegistrarProps = {
  season: SearchSeasonContext;
};

/**
 * Registers the slim season Search index while mounted.
 * Uses layout effect + owner-token unregister so a previous page's cleanup
 * cannot wipe a newer registration after soft-navigation.
 */
export function SeasonSearchRegistrar({ season }: SeasonSearchRegistrarProps) {
  const { registerSeason, unregisterSeason } = useSearch();

  useLayoutEffect(() => {
    const ownerId = registerSeason(season);
    return () => unregisterSeason(ownerId);
  }, [season, registerSeason, unregisterSeason]);

  return null;
}
