"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isCannedAskQuestion, matchCannedAskIntent } from "@/features/search/ask-canned";
import { matchDeterministicAsk } from "@/features/search/ask-deterministic";
import { askEntityHints } from "@/features/search/ask-hints";
import {
  buildSeasonDigestFromPlan,
  detectAskPlan,
} from "@/features/search/search-digest";
import { pickRelatedSearchResults } from "@/features/search/search-related";
import {
  buildSeasonMemorialResults,
  clearRecentSearches,
  ACTION_SCOPE_PREFIX,
  defaultActionSuggestions,
  defaultSuggestions,
  fuseDebounceMs,
  getRecentSearches,
  MAX_SEARCH_QUERY_CHARS,
  parseActionScopeQuery,
  recordSearchUse,
  saveRecentSearch,
  listActionResults,
  querySearchIndex,
  shouldSkipFuzzySearch,
} from "@/features/search/search-index";
import { evaluateAskQuery } from "@/lib/ai/ask-guard";
import { useSearch } from "@/features/search/SearchProvider";
import type {
  SearchCategory,
  SearchFuseHit,
  SearchResult,
} from "@/features/search/search-types";
import {
  isAssistUnavailable,
  useJumpAssist,
  type AssistState,
} from "@/features/search/use-jump-assist";
import { pushSnackbar } from "@/components/Snackbar";
import { copyText } from "@/lib/copy-text";
import { pokemonSpriteUrl } from "@/lib/sprites";
import { trainerBoardPath } from "@/lib/team-export";
import { getAppliedTheme, toggleTheme } from "@/lib/theme";

const CATEGORY_ORDER: SearchCategory[] = [
  "action",
  "navigate",
  "trainer",
  "pokemon",
  "item",
  "badge",
  "rules",
  "guide",
];

const CATEGORY_LABEL: Record<SearchCategory, string> = {
  navigate: "Navigate",
  trainer: "Trainers",
  pokemon: "Pokémon",
  item: "Items",
  badge: "Badges",
  rules: "Rules & FAQ",
  guide: "Game Guide",
  action: "Actions",
};

function ResultIcon({ item }: { item: SearchResult }) {
  // Always still PNGs here — animated GIFs in a keystroke-updating list stall
  // the tab after a few searches (decoder + frame cost stacks up).
  if (item.pokemonSprite) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="pixelated h-7 w-7 shrink-0 object-contain"
        decoding="async"
        height={28}
        loading="lazy"
        src={pokemonSpriteUrl(item.pokemonSprite.species, {
          pokedexId: item.pokemonSprite.pokedexId,
          shiny: item.pokemonSprite.shiny,
        })}
        width={28}
      />
    );
  }

  if (item.imageUrl) {
    // Plain img: Search icons come from Showdown / PokeAPI / Blob and must not
    // depend on next/image remotePatterns (custom avatars break search in prod).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        width={28}
        height={28}
        decoding="async"
        loading="lazy"
        className="pixelated h-7 w-7 shrink-0 object-contain"
      />
    );
  }

  const glyph =
    item.category === "action"
      ? "◐"
      : item.category === "badge"
        ? "◆"
        : item.category === "rules"
          ? "?"
          : item.category === "pokemon"
            ? "◆"
            : "→";

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-frame/70 bg-surface-2 text-xs font-semibold text-muted"
      aria-hidden
    >
      {glyph}
    </span>
  );
}

export function SearchPalette() {
  const {
    open,
    setOpen,
    results,
    index,
    season,
    openAsk,
    aiDrawer,
    requestBoardAction,
  } = useSearch();
  const router = useRouter();
  /**
   * Captured on open rather than via `usePathname`: under cacheComponents that
   * hook needs a Suspense boundary on any route with a dynamic param, and this
   * palette sits in the root layout above every /challenges/[slug] route. We
   * only need the path at the moment the palette opens, so an effect avoids
   * touching prerender at all.
   */
  const [pathname, setPathname] = useState("");
  const [query, setQuery] = useState("");
  /**
   * Fuse input — length-scaled debounce so short lookups stay snappy and longer
   * strings don't schedule Bitap on every keystroke. Ask-shaped queries sync
   * immediately (Fuse is skipped anyway).
   */
  const [fuseQuery, setFuseQuery] = useState("");
  const fuseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [seenOpen, setSeenOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    state: assist,
    askRemote,
    answerLocal,
    reset: resetAssist,
  } = useJumpAssist();

  // Reset ephemeral search state when the palette opens (render-time sync).
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setQuery("");
      setFuseQuery("");
      setRecents(getRecentSearches());
      // Only reached when `open` flips true, which is always a client
      // interaction — prerender never runs this branch.
      setPathname(window.location.pathname);
    }
  }

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // In-palette Ask only — drawer mode owns its own assist lifecycle.
  useEffect(() => {
    if (!aiDrawer && !open) resetAssist();
  }, [aiDrawer, open, resetAssist]);

  useEffect(() => {
    if (fuseTimerRef.current) {
      clearTimeout(fuseTimerRef.current);
      fuseTimerRef.current = null;
    }
    const ms = fuseDebounceMs(query);
    fuseTimerRef.current = setTimeout(() => {
      fuseTimerRef.current = null;
      setFuseQuery(query);
    }, ms);
    return () => {
      if (fuseTimerRef.current) {
        clearTimeout(fuseTimerRef.current);
        fuseTimerRef.current = null;
      }
    };
  }, [query]);

  const suggestions = useMemo(
    () => defaultSuggestions(results, pathname),
    [results, pathname],
  );

  const actionSuggestions = useMemo(
    () => defaultActionSuggestions(results),
    [results],
  );

  const trimmedQuery = query.trim();
  const fuseTrimmed = fuseQuery.trim();
  const liveScope = useMemo(
    () => parseActionScopeQuery(trimmedQuery),
    [trimmedQuery],
  );
  const fuseScope = useMemo(
    () => parseActionScopeQuery(fuseTrimmed),
    [fuseTrimmed],
  );
  /** Live Ask-shaped / long queries drop fuzzy immediately (use scoped text). */
  const skipFuzzyLive =
    !liveScope.actionsOnly && shouldSkipFuzzySearch(liveScope.searchText);
  const searchPending = !skipFuzzyLive && fuseQuery !== query;

  // Derive from the live index so hits refresh when season registration lands
  // after hydration (stale hits were empty forever in prod until retyping).
  // Skip when live OR fuse query looks Ask/long so Bitap never runs there.
  // `>` / `action:` scopes to verbs only — empty rest lists every action.
  const hits = useMemo(() => {
    if (fuseScope.actionsOnly) {
      if (!fuseScope.searchText) {
        return listActionResults(results).map((item) => ({ item }));
      }
      if (shouldSkipFuzzySearch(fuseScope.searchText)) {
        return [] as SearchFuseHit[];
      }
      return querySearchIndex(index, fuseScope.searchText).filter(
        (hit) => hit.item.category === "action",
      );
    }
    if (!fuseTrimmed) return [] as SearchFuseHit[];
    if (skipFuzzyLive || shouldSkipFuzzySearch(fuseTrimmed)) {
      return [] as SearchFuseHit[];
    }
    return querySearchIndex(index, fuseQuery);
  }, [
    fuseScope,
    fuseTrimmed,
    fuseQuery,
    index,
    results,
    skipFuzzyLive,
  ]);

  const groupedHits = useMemo(() => {
    const groups = new Map<SearchCategory, SearchFuseHit[]>();
    for (const hit of hits) {
      const list = groups.get(hit.item.category) ?? [];
      list.push(hit);
      groups.set(hit.item.category, list);
    }
    const order = fuseScope.actionsOnly
      ? (["action"] as SearchCategory[])
      : CATEGORY_ORDER;
    return order.flatMap((cat) => {
      const list = groups.get(cat);
      if (!list?.length) return [];
      // Command mode: show the full action list (small curated set).
      const limit = fuseScope.actionsOnly ? 12 : 8;
      return [{ category: cat, items: list.slice(0, limit) }];
    });
  }, [hits, fuseScope.actionsOnly]);

  const onQueryChange = useCallback(
    (value: string) => {
      // cmdk can emit a non-string in some clear/IME paths — coerce so the
      // controlled input never renders the literal "undefined".
      const raw = typeof value === "string" ? value : "";
      setQuery(raw.slice(0, MAX_SEARCH_QUERY_CHARS));
      if (!aiDrawer && assist.status !== "idle") resetAssist();
    },
    [aiDrawer, assist.status, resetAssist],
  );

  const enterActionScope = useCallback(() => {
    onQueryChange(ACTION_SCOPE_PREFIX);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onQueryChange]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFuseQuery("");
  }, [setOpen]);

  const runResult = useCallback(
    (item: SearchResult) => {
      saveRecentSearch(item.title);
      recordSearchUse(item.id);
      setRecents(getRecentSearches());

      if (item.action === "toggle-theme") {
        close();
        toggleTheme(getAppliedTheme());
        return;
      }

      if (item.action === "open-ask") {
        // openAsk closes Jump itself.
        openAsk();
        return;
      }

      if (item.action === "copy-board-link") {
        close();
        const trainerId = season?.myTrainerId;
        if (!season || !trainerId) return;
        const path = trainerBoardPath(season.slug, trainerId);
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}${path}`
            : path;
        void copyText(url).then((ok) => {
          if (ok) {
            pushSnackbar("Board link copied", "success", 2200);
          } else {
            pushSnackbar("Couldn’t copy board link", "error");
          }
        });
        return;
      }

      if (item.action === "import-save" || item.action === "export-team") {
        if (!season?.myTrainerId) {
          close();
          return;
        }
        const ownPath = trainerBoardPath(season.slug, season.myTrainerId);
        const onTrainerBoard = /\/trainers\/[^/]+\/?$/.test(pathname);
        const onOwnBoard = pathname === ownPath || pathname.startsWith(`${ownPath}/`);
        // Prefer the board already under the player's eyes when they can edit
        // it (own board, or GM lens on another trainer). Otherwise soft-nav to
        // My Trainer so the modal has a home (#308).
        const stayOnCurrent =
          onOwnBoard || (onTrainerBoard && season.showGm);
        requestBoardAction(item.action);
        if (!stayOnCurrent) {
          router.push(ownPath);
        }
        return;
      }

      close();
      if (item.href) {
        router.push(item.href);
      }
    },
    [
      close,
      openAsk,
      pathname,
      requestBoardAction,
      router,
      season,
    ],
  );

  const entityHints = useMemo(() => askEntityHints(season), [season]);
  // Guard against the debounced fuse query for fuzzy typing; NL asks use the
  // live query (isQuestionLike short-circuits — no hint scan) so the Ask row
  // doesn't wait on the debounce timer. `action:` never hands off to Ask.
  const askGuard = useMemo(() => {
    if (liveScope.actionsOnly) {
      return {
        ok: false as const,
        code: "NOT_QUESTION" as const,
        error: "",
      };
    }
    const q = skipFuzzyLive ? liveScope.searchText : fuseScope.searchText;
    return evaluateAskQuery(q, { entityHints });
  }, [
    liveScope.actionsOnly,
    liveScope.searchText,
    skipFuzzyLive,
    fuseScope.searchText,
    entityHints,
  ]);

  const cannedAsk =
    !liveScope.actionsOnly &&
    aiDrawer &&
    isCannedAskQuestion(trimmedQuery);

  /**
   * Ask is a fallback, never the default: only when the query clears the Ask
   * guard (question-like / season-anchored, not gibberish). Empty fuzzy hits
   * alone no longer unlock Ask — keyboard mash used to slip through.
   * Canned orientation (drawer flag only) stays available when Gemini is down.
   */
  const canAsk =
    !liveScope.actionsOnly &&
    (cannedAsk || (!isAssistUnavailable() && askGuard.ok));

  const runAsk = useCallback(() => {
    if (!trimmedQuery || !canAsk) return;

    // Feature flag `ai-drawer`: hand off to the side rail and close Jump.
    if (aiDrawer) {
      openAsk(trimmedQuery);
      return;
    }

    // Legacy: answer inside the centered Jump modal.
    const canned = matchCannedAskIntent(trimmedQuery, season);
    if (canned) {
      answerLocal(trimmedQuery, canned);
      return;
    }
    const deterministic = matchDeterministicAsk(trimmedQuery, season);
    if (deterministic) {
      answerLocal(trimmedQuery, deterministic);
      return;
    }
    const guard = evaluateAskQuery(trimmedQuery, { entityHints });
    if (!guard.ok) return;
    const snapshot = season
      ? buildSeasonDigestFromPlan(season, detectAskPlan(trimmedQuery, season))
      : null;
    void askRemote(trimmedQuery, snapshot, { preferRanking: false });
  }, [
    aiDrawer,
    answerLocal,
    askRemote,
    canAsk,
    entityHints,
    openAsk,
    season,
    trimmedQuery,
  ]);

  const relatedResults = useMemo(() => {
    if (aiDrawer || assist.status !== "answered") return [];
    const pool = season
      ? [...results, ...buildSeasonMemorialResults(season)]
      : results;
    return pickRelatedSearchResults(pool, assist.text, assist.question);
  }, [aiDrawer, assist, results, season]);

  const showingAssist = !aiDrawer && assist.status !== "idle";
  /** Live query drives layout; deferred query drives Fuse — avoids stale hits
   *  stacking under Suggestions when the box is cleared mid-defer. */
  const hasLiveQuery = Boolean(trimmedQuery);
  const showHitList = hasLiveQuery && !showingAssist;
  // NL / long asks: ignore deferred Fuse leftovers. Short fuzzy typing shows
  // skeletons while deferred Fuse catches up ( steadier than remounting hits).
  const displayHits = skipFuzzyLive ? ([] as SearchFuseHit[]) : hits;
  const displayGroupedHits = skipFuzzyLive ? [] : groupedHits;
  const showSearchPending = showHitList && searchPending && !skipFuzzyLive;
  const showAskLeading =
    showHitList && !showSearchPending && canAsk && displayHits.length === 0;
  const showAskTrailing =
    showHitList && !showSearchPending && canAsk && displayHits.length > 0;
  const showEmpty =
    showHitList && !showSearchPending && displayHits.length === 0;
  const askIsPrimary = showAskLeading;
  const askSubtitle = cannedAsk
    ? "Quick guide to this app"
    : season
      ? "Answered from this season’s board"
      : "Open a challenge for season context";

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-modal-open=""
      className="fixed inset-0 z-[200] flex items-start justify-center px-3 pt-[12vh] sm:px-4 sm:pt-[14vh]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          // Escape backs out of an in-palette answer first (legacy modal path).
          if (showingAssist) {
            resetAssist();
            return;
          }
          close();
        }
      }}
    >
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px] motion-safe:animate-[search-scrim-in_140ms_ease-out]"
        onClick={close}
      />

      <Command
        shouldFilter={false}
        label="Search"
        className="gba-frame relative z-10 w-full max-w-xl overflow-hidden shadow-[0_16px_48px_var(--shadow-md)] outline-none motion-safe:animate-[search-panel-in_160ms_cubic-bezier(0.22,1,0.36,1)] sm:rounded-xl"
      >
        <div className="relative z-[1] flex items-center gap-2 border-b border-frame/70 px-3 py-2.5 sm:px-4">
          <SearchGlyph className="h-4 w-4 shrink-0 text-muted" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={onQueryChange}
            maxLength={MAX_SEARCH_QUERY_CHARS}
            placeholder={
              liveScope.actionsOnly
                ? "Filter actions…"
                : "Search trainers, Pokémon, pages…"
            }
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted/80"
          />
          {query.length >= 240 && (
            <span
              className={`shrink-0 font-mono text-[10px] tabular-nums ${
                query.length >= MAX_SEARCH_QUERY_CHARS
                  ? "font-semibold text-ink"
                  : "text-muted"
              }`}
              aria-live="polite"
            >
              {query.length}/{MAX_SEARCH_QUERY_CHARS}
            </span>
          )}
          <kbd className="hidden shrink-0 rounded border border-frame/80 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted sm:inline">
            esc
          </kbd>
        </div>

        <Command.List className="relative z-[1] min-h-[min(40vh,280px)] max-h-[min(52vh,420px)] overflow-y-auto p-2">
          {showingAssist && (
            <AssistPanel
              state={assist}
              related={relatedResults}
              onBack={resetAssist}
              onRetry={runAsk}
              onPickRelated={runResult}
            />
          )}

          {showSearchPending && <SearchPendingPlaceholder />}

          {/* Empty results: Ask first so Enter asks. With hits, Ask trails so
              fuzzy stays the default selection (cmdk picks DOM order). */}
          {showAskLeading && (
            <AskCommandGroup
              query={trimmedQuery}
              subtitle={askSubtitle}
              onAsk={runAsk}
            />
          )}

          {!showingAssist && !hasLiveQuery && (
            <>
              {actionSuggestions.length > 0 && (
                <Command.Group
                  heading={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>Actions</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          enterActionScope();
                        }}
                        className="inline-flex items-center gap-1 rounded border border-frame/70 bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold normal-case tracking-normal text-muted hover:border-interactive/45 hover:text-ink"
                        title="Show actions only"
                        aria-label="Filter to actions only"
                      >
                        <kbd className="font-mono">{ACTION_SCOPE_PREFIX}</kbd>
                        <span className="font-sans font-medium">only</span>
                      </button>
                    </span>
                  }
                  className="[&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted"
                >
                  {actionSuggestions.map((item) => (
                    <SearchItem
                      key={item.id}
                      item={item}
                      onSelect={() => runResult(item)}
                    />
                  ))}
                </Command.Group>
              )}

              {recents.length > 0 && (
                <div className="mb-2 px-1.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Recent
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches();
                        setRecents([]);
                      }}
                      className="text-[11px] font-medium text-muted hover:text-ink"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recents.map((recent) => (
                      <button
                        key={recent}
                        type="button"
                        onClick={() => onQueryChange(recent)}
                        className="pressable rounded-md border border-frame/70 bg-surface-2 px-2 py-1 text-xs font-medium text-ink hover:border-interactive/45"
                      >
                        {recent}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Command.Group
                heading="Suggested"
                className="[&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted"
              >
                {suggestions.map((item) => (
                  <SearchItem
                    key={item.id}
                    item={item}
                    onSelect={() => runResult(item)}
                  />
                ))}
              </Command.Group>
            </>
          )}

          {showEmpty && (
            <div
              className={`px-3 text-center text-sm text-muted ${
                showAskLeading ? "pb-3 pt-1 text-xs" : "py-8"
              }`}
            >
              {showAskLeading ? (
                <>
                  No fuzzy matches — press{" "}
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5 font-mono">
                    ↵
                  </kbd>{" "}
                  to ask
                </>
              ) : liveScope.actionsOnly ? (
                liveScope.searchText ? (
                  <>No actions match “{liveScope.searchText}”</>
                ) : (
                  <>No actions available</>
                )
              ) : (
                <>No matches for “{trimmedQuery}”</>
              )}
            </div>
          )}

          {showHitList && !showSearchPending
            ? displayGroupedHits.map((group) => (
                <Command.Group
                  key={group.category}
                  heading={
                    fuseScope.actionsOnly && group.category === "action"
                      ? "Actions"
                      : CATEGORY_LABEL[group.category]
                  }
                  className="[&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted"
                >
                  {group.items.map((hit) => (
                    <SearchItem
                      key={hit.item.id}
                      item={hit.item}
                      onSelect={() => runResult(hit.item)}
                    />
                  ))}
                </Command.Group>
              ))
            : null}

          {showAskTrailing && (
            <AskCommandGroup
              query={trimmedQuery}
              subtitle={askSubtitle}
              onAsk={runAsk}
            />
          )}
        </Command.List>

        <footer className="relative z-[1] flex items-center justify-between gap-3 border-t border-frame/60 bg-surface-2/80 px-3 py-2 text-[11px] text-muted sm:px-4">
          <span className="font-medium tracking-tight">
            {showingAssist
              ? assist.status === "loading"
                ? "Asking…"
                : "Ask"
              : showSearchPending
                ? "Searching…"
                : liveScope.actionsOnly
                  ? "Actions"
                  : "Search"}
          </span>
          <span className="flex items-center gap-2 font-mono">
            {showingAssist ? (
              <span>
                <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                  esc
                </kbd>{" "}
                {assist.status === "loading" ? "cancel" : "back to results"}
              </span>
            ) : liveScope.actionsOnly ? (
              <span className="hidden sm:inline">
                <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                  {ACTION_SCOPE_PREFIX}
                </kbd>{" "}
                actions only
              </span>
            ) : (
              <>
                {!hasLiveQuery && actionSuggestions.length > 0 ? (
                  <span className="hidden sm:inline">
                    <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                      {ACTION_SCOPE_PREFIX}
                    </kbd>{" "}
                    actions
                  </span>
                ) : null}
                <span>
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                    ↑
                  </kbd>{" "}
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                    ↓
                  </kbd>{" "}
                  move
                </span>
                <span className={askIsPrimary ? "inline" : "hidden sm:inline"}>
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                    ↵
                  </kbd>{" "}
                  {askIsPrimary ? "ask" : "open"}
                </span>
              </>
            )}
          </span>
        </footer>
      </Command>
    </div>,
    document.body,
  );
}

/** In-palette Ask answers (legacy path when `ai-drawer` is off). */
function AssistPanel({
  state,
  related,
  onBack,
  onRetry,
  onPickRelated,
}: {
  state: AssistState;
  related: SearchResult[];
  onBack: () => void;
  onRetry: () => void;
  onPickRelated: (item: SearchResult) => void;
}) {
  if (state.status === "idle") return null;

  return (
    <div className="px-1.5 py-1" aria-live="polite">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {state.question}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-[11px] font-medium text-muted hover:text-ink"
        >
          Back
        </button>
      </div>

      {state.status === "loading" && (
        <div
          className="flex items-center gap-2 rounded-md border border-frame/60 bg-surface-2/60 px-3 py-3 text-sm text-muted"
          role="status"
        >
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-muted motion-safe:animate-[assist-dot_1s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 0.16}s` }}
              />
            ))}
          </span>
          Reading the season board…
        </div>
      )}

      {state.status === "answered" && (
        <div className="rounded-md border border-frame/60 bg-surface-2/60 px-3 py-2.5 text-sm leading-relaxed text-ink motion-safe:animate-[search-panel-in_180ms_cubic-bezier(0.22,1,0.36,1)]">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            {state.route === "local" ? "Local" : "Gemini"}
          </p>
          {state.text.split(/\n+/).map((para, i) => (
            <p key={i} className={i > 0 ? "mt-2" : undefined}>
              {para}
            </p>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div
          className="rounded-md border border-frame/60 bg-surface-2/60 px-3 py-2.5 text-sm text-ink"
          role="alert"
        >
          <p>{state.error}</p>
          {state.signIn ? (
            <a
              href="/login"
              className="mt-1.5 inline-block text-xs font-semibold text-interactive hover:underline"
            >
              Go to sign in →
            </a>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 text-xs font-semibold text-interactive hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {state.status === "answered" && related.length > 0 && (
        <div className="mt-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Jump to
          </p>
          <div className="flex flex-wrap gap-1.5">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPickRelated(item)}
                className="pressable rounded-md border border-frame/70 bg-surface-2 px-2 py-1 text-xs font-medium text-ink hover:border-interactive/45"
                title={item.subtitle || undefined}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.status === "answered" && (
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Generated from this season’s board — double-check anything that
          matters.
        </p>
      )}
    </div>
  );
}

function SearchPendingPlaceholder() {
  return (
    <div className="px-1.5 py-1" aria-live="polite" aria-busy="true">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Searching…
      </p>
      <ul className="space-y-1.5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 rounded-[calc(var(--radius-sm)-1px)] px-2 py-2"
          >
            <span className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-frame/20" />
            <span className="min-w-0 flex-1 space-y-1.5">
              <span
                className="block h-3.5 animate-pulse rounded bg-frame/20"
                style={{ width: `${58 - i * 6}%` }}
              />
              <span
                className="block h-2.5 animate-pulse rounded bg-frame/10"
                style={{ width: `${42 - i * 4}%` }}
              />
            </span>
            <span className="h-2.5 w-10 shrink-0 animate-pulse rounded bg-frame/10" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AskCommandGroup({
  query,
  subtitle,
  onAsk,
}: {
  query: string;
  subtitle: string;
  onAsk: () => void;
}) {
  return (
    <Command.Group
      heading="Ask"
      className="[&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted"
    >
      <Command.Item
        value="__ask__"
        onSelect={onAsk}
        className="flex cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius-sm)-1px)] border border-transparent px-2 py-2 text-sm aria-selected:border-interactive/35 aria-selected:bg-interactive-soft"
      >
        <SparkGlyph className="h-7 w-7 shrink-0 rounded-md border border-frame/70 bg-surface-2 p-1.5 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-tight text-ink">
            Ask about “{query}”
          </p>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Ask
        </span>
      </Command.Item>
    </Command.Group>
  );
}

function SparkGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2.5 11.6 7.4 16.5 9 11.6 10.6 10 15.5 8.4 10.6 3.5 9 8.4 7.4Z" />
      <path d="M15.5 13.5 16.2 15.3 18 16 16.2 16.7 15.5 18.5 14.8 16.7 13 16 14.8 15.3Z" />
    </svg>
  );
}

function SearchItem({
  item,
  onSelect,
}: {
  item: SearchResult;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={`${item.id} ${item.title} ${item.subtitle}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius-sm)-1px)] border border-transparent px-2 py-2 text-sm aria-selected:border-interactive/35 aria-selected:bg-interactive-soft"
    >
      <ResultIcon item={item} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold tracking-tight text-ink">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="truncate text-xs text-muted">{item.subtitle}</p>
        )}
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {CATEGORY_LABEL[item.category]}
      </span>
    </Command.Item>
  );
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="M12.5 12.5 16.5 16.5" strokeLinecap="round" />
    </svg>
  );
}
