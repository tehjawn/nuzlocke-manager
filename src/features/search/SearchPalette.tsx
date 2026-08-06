"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { askEntityHints } from "@/features/search/ask-hints";
import {
  buildSeasonDigestFromPlan,
  detectAskPlan,
} from "@/features/search/search-digest";
import { pickRelatedSearchResults } from "@/features/search/search-related";
import {
  buildSeasonMemorialResults,
  clearRecentSearches,
  defaultSuggestions,
  getRecentSearches,
  recordSearchUse,
  saveRecentSearch,
  querySearchIndex,
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
import { pokemonSpriteUrl } from "@/lib/sprites";
import { getAppliedTheme, toggleTheme } from "@/lib/theme";

const CATEGORY_ORDER: SearchCategory[] = [
  "navigate",
  "trainer",
  "pokemon",
  "badge",
  "rules",
  "guide",
  "action",
];

const CATEGORY_LABEL: Record<SearchCategory, string> = {
  navigate: "Navigate",
  trainer: "Trainers",
  pokemon: "Pokémon",
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
  const { open, setOpen, results, index, season } = useSearch();
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
  /** Fuse runs against the deferred query so keystrokes stay responsive. */
  const deferredQuery = useDeferredValue(query);
  const searchPending = deferredQuery !== query;
  const [recents, setRecents] = useState<string[]>([]);
  const [seenOpen, setSeenOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state: assist, ask, reset: resetAssist } = useJumpAssist();

  // Reset ephemeral search state when the palette opens (render-time sync).
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setQuery("");
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

  // Closing mid-request should abort it, not leave an answer waiting behind.
  useEffect(() => {
    if (!open) resetAssist();
  }, [open, resetAssist]);

  const suggestions = useMemo(
    () => defaultSuggestions(results, pathname),
    [results, pathname],
  );

  // Derive from the live index so hits refresh when season registration lands
  // after hydration (stale hits were empty forever in prod until retyping).
  const hits = useMemo(() => {
    if (!deferredQuery.trim()) return [] as SearchFuseHit[];
    return querySearchIndex(index, deferredQuery);
  }, [index, deferredQuery]);

  const groupedHits = useMemo(() => {
    const groups = new Map<SearchCategory, SearchFuseHit[]>();
    for (const hit of hits) {
      const list = groups.get(hit.item.category) ?? [];
      list.push(hit);
      groups.set(hit.item.category, list);
    }
    return CATEGORY_ORDER.flatMap((cat) => {
      const list = groups.get(cat);
      if (!list?.length) return [];
      return [{ category: cat, items: list.slice(0, 8) }];
    });
  }, [hits]);

  const onQueryChange = useCallback(
    (value: string) => {
      // cmdk can emit a non-string in some clear/IME paths — coerce so the
      // controlled input never renders the literal "undefined".
      const next = typeof value === "string" ? value : "";
      setQuery(next);
      // A new query means the previous answer is stale — drop it immediately
      // so the palette never shows an answer to a question you edited away.
      if (assist.status !== "idle") resetAssist();
    },
    [assist.status, resetAssist],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setOpen]);

  const runResult = useCallback(
    (item: SearchResult) => {
      saveRecentSearch(item.title);
      recordSearchUse(item.id);
      setRecents(getRecentSearches());
      close();

      if (item.action === "toggle-theme") {
        toggleTheme(getAppliedTheme());
        return;
      }

      if (item.href) {
        router.push(item.href);
      }
    },
    [close, router],
  );

  const trimmedQuery = query.trim();
  const deferredTrimmed = deferredQuery.trim();

  const entityHints = useMemo(() => askEntityHints(season), [season]);
  // Guard against the deferred query so typing stays off the hot path — the
  // Ask row only appears once Fuse/deferred settle anyway.
  const askGuard = useMemo(
    () => evaluateAskQuery(deferredTrimmed, { entityHints }),
    [deferredTrimmed, entityHints],
  );

  /**
   * Ask is a fallback, never the default: only when the query clears the Ask
   * guard (question-like / season-anchored, not gibberish). Empty fuzzy hits
   * alone no longer unlock Ask — keyboard mash used to slip through.
   */
  const canAsk = !isAssistUnavailable() && askGuard.ok;

  const runAsk = useCallback(() => {
    if (!trimmedQuery) return;
    const guard = evaluateAskQuery(trimmedQuery, { entityHints });
    if (!guard.ok) return;
    // Pass 1 (instant): which slices the question needs.
    // Pass 2 (still sync): pack only those into ≤8k — then the network Ask.
    const snapshot = season
      ? buildSeasonDigestFromPlan(
          season,
          detectAskPlan(trimmedQuery, season),
        )
      : null;
    void ask(trimmedQuery, snapshot);
  }, [ask, entityHints, season, trimmedQuery]);

  // Trainers / Pokémon the answer names, matched client-side so the model never
  // chooses a destination. Memorial rows are built only after an answer so Fuse
  // stays living-party-only while typing.
  const relatedResults = useMemo(() => {
    if (assist.status !== "answered") return [];
    const pool = season
      ? [...results, ...buildSeasonMemorialResults(season)]
      : results;
    return pickRelatedSearchResults(pool, assist.answer, assist.question);
  }, [assist, results, season]);

  const showingAssist = assist.status !== "idle";
  /** Live query drives layout; deferred query drives Fuse — avoids stale hits
   *  stacking under Suggestions when the box is cleared mid-defer. */
  const hasLiveQuery = Boolean(trimmedQuery);
  const showHitList = hasLiveQuery && !showingAssist;
  const hitsSettled = showHitList && !searchPending;
  const showAskLeading = hitsSettled && canAsk && hits.length === 0;
  const showAskTrailing = hitsSettled && canAsk && hits.length > 0;
  const showEmpty = hitsSettled && hits.length === 0;
  const askSubtitle = season
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
          // Escape backs out of an answer first, so one stray Esc doesn't throw
          // away the query you just asked about.
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
            placeholder="Search trainers, Pokémon, pages…"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted/80"
          />
          <kbd className="hidden shrink-0 rounded border border-frame/80 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted sm:inline">
            esc
          </kbd>
        </div>

        <Command.List
          className={`relative z-[1] max-h-[min(52vh,420px)] overflow-y-auto p-2 transition-opacity duration-100 ${
            showHitList && searchPending ? "opacity-60" : "opacity-100"
          }`}
        >
          {showingAssist ? (
            <AssistPanel
              state={assist}
              related={relatedResults}
              onBack={resetAssist}
              onRetry={runAsk}
              onPickRelated={runResult}
            />
          ) : null}

          {/* Empty results: Ask first so Enter asks. With hits, Ask trails so
              fuzzy stays the default selection (cmdk picks DOM order). */}
          {showAskLeading ? (
            <AskCommandGroup
              query={trimmedQuery}
              subtitle={askSubtitle}
              onAsk={runAsk}
            />
          ) : null}

          {!showingAssist && !hasLiveQuery ? (
            <>
              {recents.length > 0 ? (
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
              ) : null}

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
          ) : null}

          {showEmpty ? (
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
              ) : (
                <>No matches for “{trimmedQuery}”</>
              )}
            </div>
          ) : null}

          {showHitList
            ? groupedHits.map((group) => (
                <Command.Group
                  key={group.category}
                  heading={CATEGORY_LABEL[group.category]}
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

          {showAskTrailing ? (
            <AskCommandGroup
              query={trimmedQuery}
              subtitle={askSubtitle}
              onAsk={runAsk}
            />
          ) : null}
        </Command.List>

        <footer className="relative z-[1] flex items-center justify-between gap-3 border-t border-frame/60 bg-surface-2/80 px-3 py-2 text-[11px] text-muted sm:px-4">
          <span className="font-medium tracking-tight">
            {showingAssist
              ? assist.status === "loading"
                ? "Asking…"
                : "Ask"
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
            ) : (
              <>
                <span>
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                    ↑
                  </kbd>{" "}
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                    ↓
                  </kbd>{" "}
                  move
                </span>
                <span
                  className={
                    canAsk && hitsSettled && hits.length === 0
                      ? "inline"
                      : "hidden sm:inline"
                  }
                >
                  <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">
                    ↵
                  </kbd>{" "}
                  {canAsk && hitsSettled && hits.length === 0
                    ? "ask"
                    : "open"}
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

      {state.status === "loading" ? (
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
      ) : null}

      {state.status === "answered" ? (
        <div className="rounded-md border border-frame/60 bg-surface-2/60 px-3 py-2.5 text-sm leading-relaxed text-ink motion-safe:animate-[search-panel-in_180ms_cubic-bezier(0.22,1,0.36,1)]">
          {state.answer.split(/\n+/).map((para, i) => (
            <p key={i} className={i > 0 ? "mt-2" : undefined}>
              {para}
            </p>
          ))}
        </div>
      ) : null}

      {state.status === "error" ? (
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
      ) : null}

      {state.status === "answered" && related.length ? (
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
      ) : null}

      {state.status === "answered" ? (
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Generated from this season’s board — double-check anything that matters.
        </p>
      ) : null}
    </div>
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
        {item.subtitle ? (
          <p className="truncate text-xs text-muted">{item.subtitle}</p>
        ) : null}
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
