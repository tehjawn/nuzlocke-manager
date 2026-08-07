"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export const INFINITE_REVEAL_PAGE_SIZE = 96;

type UseInfiniteRevealOptions = {
  /** Rows revealed per step. Defaults to {@link INFINITE_REVEAL_PAGE_SIZE}. */
  pageSize?: number;
  /**
   * IntersectionObserver root. `viewport` (default) for page scroll; `element`
   * for a nested scroll container (SpriteBrowser).
   */
  root?: "viewport" | "element";
  rootMargin?: string;
};

/**
 * Progressive DOM reveal for lists already in memory (SpriteBrowser pattern).
 * Does not fetch — only mounts `items.slice(0, visibleCount)`.
 */
export function useInfiniteReveal<T>(
  items: T[],
  resetKey: string,
  opts?: UseInfiniteRevealOptions,
) {
  const pageSize = opts?.pageSize ?? INFINITE_REVEAL_PAGE_SIZE;
  const rootMode = opts?.root ?? "viewport";
  const rootMargin = opts?.rootMargin ?? "160px";

  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [prevKey, setPrevKey] = useState(resetKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setVisibleCount(pageSize);
  }

  const total = items.length;
  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < total;

  const loadMore = () => {
    setVisibleCount((count) => Math.min(count + pageSize, total));
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const root =
      rootMode === "element" ? scrollRef.current : null;
    if (rootMode === "element" && !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + pageSize, total));
        }
      },
      { root, rootMargin },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, total, visibleCount, resetKey, pageSize, rootMode, rootMargin]);

  return {
    visible,
    total,
    hasMore,
    remaining: Math.max(0, total - visible.length),
    scrollRef,
    sentinelRef,
    loadMore,
  };
}

/** Explicit Load more + optional auto-reveal sentinel (Activity / SpriteBrowser). */
export function InfiniteRevealFooter({
  hasMore,
  remaining,
  sentinelRef,
  onLoadMore,
  className,
  label,
}: {
  hasMore: boolean;
  remaining: number;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  className?: string;
  /** Override the “Scroll for N more…” hint. */
  label?: ReactNode;
}) {
  if (!hasMore) return null;
  return (
    <div
      ref={sentinelRef}
      className={
        className ??
        "col-span-full flex flex-col items-center gap-2 py-2"
      }
    >
      <span className="text-[10px] text-muted">
        {label ?? `Scroll for ${remaining} more…`}
      </span>
      <button
        type="button"
        className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-[11px] font-semibold tracking-tight"
        onClick={onLoadMore}
      >
        Load more
      </button>
    </div>
  );
}
