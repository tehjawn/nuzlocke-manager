"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type Fuse from "fuse.js";
import {
  buildGlobalResults,
  buildSeasonResults,
  createJumpIndex,
} from "@/features/jump/jump-index";
import type { JumpResult, JumpSeasonContext } from "@/features/jump/jump-types";

type JumpContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  results: JumpResult[];
  index: Fuse<JumpResult>;
  /** Route-level season overlay; returns an owner id for safe unregister. */
  registerSeason: (ctx: JumpSeasonContext) => number;
  /** Clear route overlay only if this owner still owns it. */
  unregisterSeason: (ownerId: number) => void;
};

const JumpContext = createContext<JumpContextValue | null>(null);

export function JumpProvider({
  children,
  defaultSeason = null,
}: {
  children: ReactNode;
  /** Active season index for global pages (home, about, login, …). */
  defaultSeason?: JumpSeasonContext | null;
}) {
  const [open, setOpen] = useState(false);
  const [routeSeason, setRouteSeason] = useState<JumpSeasonContext | null>(
    null,
  );
  const generationRef = useRef(0);
  const activeOwnerRef = useRef<number | null>(null);

  // In-season pages overlay richer context (GM / my board); elsewhere fall back
  // to the active season so Jump still finds trainers from the homepage.
  const season = routeSeason ?? defaultSeason;

  const results = useMemo(() => {
    const global = buildGlobalResults();
    if (!season) return global;
    return [...buildSeasonResults(season), ...global];
  }, [season]);

  const index = useMemo(() => createJumpIndex(results), [results]);

  const registerSeason = useCallback((ctx: JumpSeasonContext) => {
    const ownerId = ++generationRef.current;
    activeOwnerRef.current = ownerId;
    setRouteSeason(ctx);
    return ownerId;
  }, []);

  const unregisterSeason = useCallback((ownerId: number) => {
    if (activeOwnerRef.current !== ownerId) return;
    activeOwnerRef.current = null;
    setRouteSeason(null);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      if (e.isComposing) return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      results,
      index,
      registerSeason,
      unregisterSeason,
    }),
    [open, toggle, results, index, registerSeason, unregisterSeason],
  );

  return <JumpContext.Provider value={value}>{children}</JumpContext.Provider>;
}

export function useJump() {
  const ctx = useContext(JumpContext);
  if (!ctx) {
    throw new Error("useJump must be used within JumpProvider");
  }
  return ctx;
}

/** Safe for optional header triggers outside the provider during SSR edge cases. */
export function useJumpOptional() {
  return useContext(JumpContext);
}
