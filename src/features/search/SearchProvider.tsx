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
  createSearchIndex,
} from "@/features/search/search-index";
import type {
  BoardJumpAction,
  SearchResult,
  SearchSeasonContext,
} from "@/features/search/search-types";

type SearchContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Fuse-facing results (living party Pokémon only — no memorial). */
  results: SearchResult[];
  index: Fuse<SearchResult>;
  /** Resolved season behind the index — source for Ask mode's snapshot (#184). */
  season: SearchSeasonContext | null;
  /** Route-level season overlay; returns an owner id for safe unregister. */
  registerSeason: (ctx: SearchSeasonContext) => number;
  /** Clear route overlay only if this owner still owns it. */
  unregisterSeason: (ownerId: number) => void;
  /** Ask drawer open (#300) — independent of Jump palette. */
  askOpen: boolean;
  /** Seed / last handed-off question for Ask (null = open empty composer). */
  askQuery: string | null;
  /** Open Ask drawer; optional seed question submits once on open. */
  openAsk: (query?: string) => void;
  closeAsk: () => void;
  /** Server-evaluated `ai-drawer` flag (Vercel Flags). */
  aiDrawer: boolean;
  /** Set by AiDrawerFlagSync once the Suspense-deferred flag resolves (#313). */
  setAiDrawer: (enabled: boolean) => void;
  /**
   * Queue a board modal (import / export) and close Jump. Soft-nav to My
   * Trainer first when the board isn't already showing (#308).
   */
  requestBoardAction: (action: BoardJumpAction) => void;
  /** Pending Jump → board modal; TrainerBoard opens then clears. */
  pendingBoardAction: BoardJumpAction | null;
  /** Clear after the target board opens the matching modal. */
  clearBoardAction: () => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

/** Skip Fuse rebuilds when RSC soft-refreshes with the same season payload. */
function seasonSearchFingerprint(season: SearchSeasonContext): string {
  let monCount = 0;
  let badgeBits = 0;
  for (const t of season.trainers) {
    monCount += t.pokemon?.length ?? 0;
    badgeBits += t.earnedBadgeKeys?.length ?? 0;
  }
  return [
    season.slug,
    season.myTrainerId ?? "",
    season.showGm ? "1" : "0",
    season.firstRun ? "1" : "0",
    String(season.trainers.length),
    String(monCount),
    String(badgeBits),
    String(season.rules.length),
    String(season.faqs.length),
    String(season.badges.length),
  ].join("|");
}

export function SearchProvider({
  children,
  defaultSeason = null,
}: {
  children: ReactNode;
  /** Active season index for global pages (home, about, login, …). */
  defaultSeason?: SearchSeasonContext | null;
}) {
  // `ai-drawer` starts off and is switched on by AiDrawerFlagSync when the
  // Suspense-deferred server evaluation streams in. Awaiting the flag in the
  // root layout instead made every route non-prerenderable (#313).
  const [aiDrawer, setAiDrawer] = useState(false);
  const [open, setOpenState] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuery, setAskQuery] = useState<string | null>(null);
  const [routeSeason, setRouteSeason] = useState<SearchSeasonContext | null>(
    null,
  );
  const generationRef = useRef(0);
  const activeOwnerRef = useRef<number | null>(null);
  const routeFingerprintRef = useRef("");
  /** Pending Jump → board modal; state (not ref) so Strict Mode remounts retry. */
  const [pendingBoardAction, setPendingBoardAction] =
    useState<BoardJumpAction | null>(null);

  // In-season pages overlay richer context (GM / my board); elsewhere fall back
  // to the active season so Search still finds trainers from the homepage.
  const season = routeSeason ?? defaultSeason;

  const results = useMemo(() => {
    const global = buildGlobalResults();
    const merged = season ? [...buildSeasonResults(season), ...global] : global;
    // Hide Ask when the flag is off so Jump never advertises a dead path (#308).
    if (aiDrawer) return merged;
    return merged.filter((r) => r.action !== "open-ask");
  }, [season, aiDrawer]);

  const index = useMemo(() => createSearchIndex(results), [results]);

  const registerSeason = useCallback((ctx: SearchSeasonContext) => {
    const ownerId = ++generationRef.current;
    activeOwnerRef.current = ownerId;
    const fingerprint = seasonSearchFingerprint(ctx);
    // Identical payload (common after soft navigation / RSC refresh) — keep the
    // existing Fuse index instead of rebuilding mid-typing.
    if (fingerprint === routeFingerprintRef.current) {
      return ownerId;
    }
    routeFingerprintRef.current = fingerprint;
    setRouteSeason(ctx);
    return ownerId;
  }, []);

  const unregisterSeason = useCallback((ownerId: number) => {
    if (activeOwnerRef.current !== ownerId) return;
    activeOwnerRef.current = null;
    // Defer clear so a same-tick re-register (RSC soft refresh) can reclaim the
    // index without tearing it down and rebuilding Fuse.
    queueMicrotask(() => {
      if (activeOwnerRef.current != null) return;
      routeFingerprintRef.current = "";
      setRouteSeason(null);
    });
  }, []);

  const closeAsk = useCallback(() => {
    setAskOpen(false);
    setAskQuery(null);
  }, []);

  const openAsk = useCallback((query?: string) => {
    const trimmed = query?.trim() ?? "";
    setOpenState(false);
    setAskQuery(trimmed.length ? trimmed : null);
    setAskOpen(true);
  }, []);

  const requestBoardAction = useCallback((action: BoardJumpAction) => {
    setPendingBoardAction(action);
    setOpenState(false);
    setAskOpen(false);
    setAskQuery(null);
  }, []);

  const clearBoardAction = useCallback(() => {
    setPendingBoardAction(null);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    // Jump and Ask are mutually exclusive shells — opening Jump dismisses Ask.
    if (next) {
      setAskOpen(false);
      setAskQuery(null);
    }
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      if (next) {
        setAskOpen(false);
        setAskQuery(null);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      if (e.isComposing) return;
      e.preventDefault();
      setOpenState((prev) => {
        const next = !prev;
        if (next) {
          setAskOpen(false);
          setAskQuery(null);
        }
        return next;
      });
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
      season,
      registerSeason,
      unregisterSeason,
      askOpen,
      askQuery,
      openAsk,
      closeAsk,
      aiDrawer,
      setAiDrawer,
      requestBoardAction,
      pendingBoardAction,
      clearBoardAction,
    }),
    [
      open,
      setOpen,
      toggle,
      results,
      index,
      season,
      registerSeason,
      unregisterSeason,
      askOpen,
      askQuery,
      openAsk,
      closeAsk,
      aiDrawer,
      requestBoardAction,
      pendingBoardAction,
      clearBoardAction,
    ],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within SearchProvider");
  }
  return ctx;
}

/** Safe for optional header triggers outside the provider during SSR edge cases. */
export function useSearchOptional() {
  return useContext(SearchContext);
}
