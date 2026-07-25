"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  registerSeason: (ctx: JumpSeasonContext | null) => void;
};

const JumpContext = createContext<JumpContextValue | null>(null);

export function JumpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState<JumpSeasonContext | null>(null);

  const results = useMemo(() => {
    const global = buildGlobalResults();
    if (!season) return global;
    return [...buildSeasonResults(season), ...global];
  }, [season]);

  const index = useMemo(() => createJumpIndex(results), [results]);

  const registerSeason = useCallback((ctx: JumpSeasonContext | null) => {
    setSeason(ctx);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      // Allow ⌘K even in inputs — universal jump shortcut.
      if (e.isComposing) return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, toggle, results, index, registerSeason }),
    [open, toggle, results, index, registerSeason],
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
