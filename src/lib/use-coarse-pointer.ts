"use client";

import { useEffect, useState } from "react";

/** The media query that identifies touch / non-hovering pointers. */
const COARSE_QUERY = "(hover: none), (pointer: coarse)";

/**
 * True when the primary pointer can't hover (phones, most tablets). Use it to
 * swap hover-only affordances (zoom previews, hover-open menus) for tap-driven
 * equivalents. SSR-safe: returns false until mounted, then reflects the device
 * and updates if the environment changes (e.g. a 2-in-1 toggling modes).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(COARSE_QUERY);
    const update = () => setCoarse(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return coarse;
}
