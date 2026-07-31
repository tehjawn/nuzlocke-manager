"use client";

import { useMediaQuery } from "@/lib/use-media-query";

/** The media query that identifies touch / non-hovering pointers. */
const COARSE_QUERY = "(hover: none), (pointer: coarse)";

/**
 * True when the primary pointer can't hover (phones, most tablets). Use it to
 * swap hover-only affordances (zoom previews, hover-open menus) for tap-driven
 * equivalents. SSR-safe: returns false until hydrated, then reflects the device
 * and updates if the environment changes (e.g. a 2-in-1 toggling modes).
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_QUERY, false);
}
