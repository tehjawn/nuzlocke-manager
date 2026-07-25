"use client";

import { useLayoutEffect } from "react";
import { useJump } from "@/features/jump/JumpProvider";
import type { JumpSeasonContext } from "@/features/jump/jump-types";

type SeasonJumpRegistrarProps = {
  season: JumpSeasonContext;
};

/**
 * Registers the slim season Jump index while mounted.
 * Uses layout effect + owner-token unregister so a previous page's cleanup
 * cannot wipe a newer registration after soft-navigation.
 */
export function SeasonJumpRegistrar({ season }: SeasonJumpRegistrarProps) {
  const { registerSeason, unregisterSeason } = useJump();

  useLayoutEffect(() => {
    const ownerId = registerSeason(season);
    return () => unregisterSeason(ownerId);
  }, [season, registerSeason, unregisterSeason]);

  return null;
}
