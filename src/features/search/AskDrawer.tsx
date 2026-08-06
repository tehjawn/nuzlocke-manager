"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AskAnswerView } from "@/features/search/AskAnswerView";
import { askEntityHints } from "@/features/search/ask-hints";
import { matchCannedAskIntent } from "@/features/search/ask-canned";
import {
  buildPageContext,
  prependPageContext,
  readIncludePageContextPref,
  writeIncludePageContextPref,
} from "@/features/search/ask-page-context";
import { wantsPokemonRanking } from "@/features/search/ask-ranking";
import {
  buildSeasonDigestFromPlan,
  detectAskPlan,
} from "@/features/search/search-digest";
import {
  buildSeasonMemorialResults,
  MAX_SEARCH_QUERY_CHARS,
  recordSearchUse,
  saveRecentSearch,
} from "@/features/search/search-index";
import { pickRelatedSearchResults } from "@/features/search/search-related";
import { useSearch } from "@/features/search/SearchProvider";
import type { SearchResult } from "@/features/search/search-types";
import { useJumpAssist } from "@/features/search/use-jump-assist";
import { evaluateAskQuery } from "@/lib/ai/ask-guard";

/** Desktop Ask rail width — page gets matching right padding. */
export const ASK_RAIL_WIDTH = "min(26rem, 38vw)";

/**
 * App chrome for Ask (#300).
 *
 * Desktop: full-viewport-height right rail (`| page | drawer |`); the page
 * column gets right padding so content shifts left. Mobile: full-screen sheet.
 */
export function AskChrome({ children }: { children: ReactNode }) {
  const { askOpen } = useSearch();

  useEffect(() => {
    if (!askOpen) {
      document.body.removeAttribute("data-ask-rail");
      return;
    }
    document.body.setAttribute("data-ask-rail", "");
    return () => document.body.removeAttribute("data-ask-rail");
  }, [askOpen]);

  return (
    <>
      <div
        data-ask-page=""
        className="flex w-full min-w-0 flex-1 flex-col"
      >
        {children}
      </div>
      <AskHost />
    </>
  );
}

function AskHost() {
  const {
    askOpen,
    askQuery,
    closeAsk,
    results,
    season,
    open: jumpOpen,
  } = useSearch();
  const router = useRouter();
  const { state: assist, reset, answerLocal, askRemote, fail } =
    useJumpAssist();
  const [draft, setDraft] = useState("");
  const [seenOpen, setSeenOpen] = useState(askOpen);
  const [desktop, setDesktop] = useState(false);
  const [includePageContext, setIncludePageContext] = useState(true);
  const [seenPagePref, setSeenPagePref] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  if (askOpen !== seenOpen) {
    setSeenOpen(askOpen);
    if (askOpen) setDraft(askQuery ?? "");
  }

  // Hydrate page-context pref once on the client (avoid SSR mismatch).
  if (!seenPagePref && typeof window !== "undefined") {
    setSeenPagePref(true);
    setIncludePageContext(readIncludePageContextPref(true));
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const submitAsk = (raw: string) => {
    const trimmed = raw.trim().slice(0, MAX_SEARCH_QUERY_CHARS);
    if (!trimmed) return;

    const canned = matchCannedAskIntent(trimmed, season);
    if (canned) {
      answerLocal(trimmed, canned);
      return;
    }

    const guard = evaluateAskQuery(trimmed, {
      entityHints: askEntityHints(season),
      allowMultiWord: true,
    });
    if (!guard.ok) {
      fail(trimmed, guard.error);
      return;
    }

    let plan = detectAskPlan(trimmed, season);
    const preferRanking = wantsPokemonRanking(trimmed, season);
    if (preferRanking && season) {
      plan = {
        ...plan,
        focus: plan.focus === "meta" ? "roster" : plan.focus,
        includeMons: true,
        leanMons: true,
      };
    }

    const digest = season
      ? buildSeasonDigestFromPlan(season, plan)
      : null;
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "";
    const snapshot = includePageContext
      ? prependPageContext(digest, buildPageContext(pathname, season))
      : digest;

    void askRemote(trimmed, snapshot, { preferRanking });
  };

  const onSeedAsk = useEffectEvent((q: string) => {
    submitAsk(q);
    setDraft("");
  });

  useEffect(() => {
    if (!askOpen) {
      reset();
      lastSubmittedRef.current = null;
      return;
    }
    const q = (askQuery ?? "").trim();
    if (!q || lastSubmittedRef.current === q) return;
    lastSubmittedRef.current = q;
    onSeedAsk(q);
  }, [askOpen, askQuery, reset]);

  useEffect(() => {
    if (!askOpen) return;

    const focusId = requestAnimationFrame(() => inputRef.current?.focus());

    // Mobile sheet only — desktop rail leaves body scroll with the page.
    if (!desktop) {
      document.body.setAttribute("data-ask-scroll-lock", "");
    } else {
      document.body.removeAttribute("data-ask-scroll-lock");
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (jumpOpen) return;
      e.preventDefault();
      e.stopPropagation();
      closeAsk();
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      cancelAnimationFrame(focusId);
      document.body.removeAttribute("data-ask-scroll-lock");
      document.removeEventListener("keydown", onKey, true);
    };
  }, [askOpen, desktop, jumpOpen, closeAsk]);

  const relatedResults = useMemo(() => {
    if (assist.status !== "answered") return [];
    if (assist.answer.kind === "canned") return [];
    const pool = season
      ? [...results, ...buildSeasonMemorialResults(season)]
      : results;
    return pickRelatedSearchResults(pool, assist.text, assist.question);
  }, [assist, results, season]);

  const navigate = useCallback(
    (item: SearchResult | string) => {
      if (typeof item === "string") {
        router.push(item);
        return;
      }
      saveRecentSearch(item.title);
      recordSearchUse(item.id);
      if (item.href) router.push(item.href);
    },
    [router],
  );

  const questionLabel =
    assist.status === "idle"
      ? draft.trim() || null
      : assist.question.trim() || null;

  const panel = (
    <AskPanelFrame
      questionLabel={questionLabel}
      onClose={closeAsk}
      draft={draft}
      setDraft={setDraft}
      inputRef={inputRef}
      assistStatus={assist.status}
      includePageContext={includePageContext}
      onIncludePageContextChange={(next) => {
        setIncludePageContext(next);
        writeIncludePageContextPref(next);
      }}
      onSubmit={() => {
        const q = draft.trim();
        if (!q || assist.status === "loading") return;
        lastSubmittedRef.current = q;
        submitAsk(q);
        setDraft("");
      }}
      desktop={desktop}
    >
      <AskAnswerView
        state={assist}
        related={relatedResults}
        season={season}
        results={results}
        onRetry={() => {
          const q =
            assist.status === "idle" ? draft.trim() : assist.question;
          if (q) submitAsk(q);
        }}
        onNavigate={navigate}
      />
    </AskPanelFrame>
  );

  // Desktop: fixed full-viewport rail on the right; page padding via CSS.
  // Mobile: portal sheet — never mount both or the composer ref double-binds.
  return (
    <>
      {askOpen && desktop ? (
        <aside
          data-ask-rail-panel=""
          role="dialog"
          aria-modal="false"
          aria-label="Ask Gomi AI"
          className="fixed inset-y-0 right-0 z-30 hidden flex-col border-l border-frame bg-surface shadow-[-8px_0_24px_-12px_var(--shadow-md)] motion-safe:animate-[ask-rail-in_200ms_cubic-bezier(0.22,1,0.36,1)] md:flex"
          style={{ width: ASK_RAIL_WIDTH }}
        >
          {panel}
        </aside>
      ) : null}

      {askOpen && !desktop && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[180] md:hidden">
              <button
                type="button"
                aria-label="Close Ask"
                onClick={closeAsk}
                className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px] motion-safe:animate-[drawer-scrim-in_200ms_ease-out]"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Ask Gomi AI"
                className="absolute inset-0 flex flex-col overflow-hidden bg-surface motion-safe:animate-[ask-sheet-in_220ms_cubic-bezier(0.22,1,0.36,1)] gba-frame"
              >
                {panel}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function AskPanelFrame({
  questionLabel,
  onClose,
  draft,
  setDraft,
  inputRef,
  assistStatus,
  includePageContext,
  onIncludePageContextChange,
  onSubmit,
  desktop,
  children,
}: {
  questionLabel: string | null;
  onClose: () => void;
  draft: string;
  setDraft: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  assistStatus: string;
  includePageContext: boolean;
  onIncludePageContextChange: (next: boolean) => void;
  onSubmit: () => void;
  desktop: boolean;
  children: ReactNode;
}) {
  const pageContextId = "ask-include-page-context";

  return (
    <div className="flex h-full min-h-0 flex-col outline-none">
      <header className="flex shrink-0 items-start gap-2 border-b border-frame/70 px-3 py-2.5 sm:px-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-frame/70 bg-surface-2 text-ink">
          <SparkGlyph className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
            Ask Gomi AI
          </h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">
            {questionLabel ?? "League questions, tips, and jumps"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close Ask"
          onClick={onClose}
          className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-interactive/35 bg-interactive-soft text-ink"
        >
          <CloseIcon />
        </button>
      </header>

      {children}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="shrink-0 border-t border-frame/60 bg-surface-2/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <label
            htmlFor={pageContextId}
            className="min-w-0 cursor-pointer text-[11px] font-medium leading-snug text-muted"
          >
            Include current page context
          </label>
          <button
            id={pageContextId}
            type="button"
            role="switch"
            aria-checked={includePageContext}
            aria-label="Include current page context"
            onClick={() => onIncludePageContextChange(!includePageContext)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
              includePageContext
                ? "border-interactive/50 bg-interactive-soft"
                : "border-frame/80 bg-surface"
            }`}
          >
            <span
              aria-hidden
              className={`absolute h-3.5 w-3.5 rounded-full bg-ink shadow-sm transition-transform ${
                includePageContext ? "translate-x-[1.125rem]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-frame/70 bg-surface px-2.5 py-2 focus-within:border-interactive/45">
          <SparkGlyph className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) =>
              setDraft(e.target.value.slice(0, MAX_SEARCH_QUERY_CHARS))
            }
            maxLength={MAX_SEARCH_QUERY_CHARS}
            placeholder="Ask another question…"
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted/80"
          />
          <button
            type="submit"
            disabled={!draft.trim() || assistStatus === "loading"}
            className="pressable shrink-0 rounded-md border border-interactive/35 bg-interactive-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink disabled:opacity-40"
          >
            Ask
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          {desktop ? (
            <>
              <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5 font-mono">
                esc
              </kbd>{" "}
              closes · page stays usable · links keep Ask open
            </>
          ) : (
            <>Tap outside or ✕ to close</>
          )}
        </p>
      </form>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M5 5 15 15M15 5 5 15" />
    </svg>
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
