"use client";

import Image from "next/image";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/Modal";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import {
  formatTrainerSpriteLabel,
  searchTrainerSprites,
} from "@/data/trainer-sprites";
import {
  findPokemonById,
  POKEMON_GENERATIONS,
  searchPokemonIndex,
  type PokemonIndexEntry,
} from "@/data/pokemon-index";
import {
  pokemonSpriteUrl,
  SHOWDOWN_POKEMON_SPRITES_DIR,
  SHOWDOWN_TRAINER_SPRITES_DIR,
  trainerSpriteUrl,
} from "@/lib/sprites";

const PAGE_SIZE = 96;
const PREVIEW_SHOW_DELAY_MS = 100;
const PREVIEW_SIZE = 160;
const PREVIEW_PANEL_W = 176;
const PREVIEW_PANEL_H = 212;
const PREVIEW_GAP = 12;

type TrainerBrowserProps = {
  open: boolean;
  selectedKey: string;
  onClose: () => void;
  onSelect: (key: string) => void;
};

export function TrainerSpriteBrowser({
  open,
  selectedKey,
  onClose,
  onSelect,
}: TrainerBrowserProps) {
  // Remount when opened so draft/query reset from props without an effect.
  if (!open) return null;
  return (
    <TrainerSpriteBrowserInner
      key={selectedKey}
      selectedKey={selectedKey}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

function TrainerSpriteBrowserInner({
  selectedKey,
  onClose,
  onSelect,
}: Omit<TrainerBrowserProps, "open">) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const allResults = useMemo(() => searchTrainerSprites(deferred), [deferred]);
  const { visible, total, hasMore, scrollRef, sentinelRef, loadMore } =
    useInfiniteReveal(allResults, deferred);
  const preview = useSpriteHoverPreview(scrollRef);
  const coarse = useCoarsePointer();
  const [draft, setDraft] = useState(selectedKey);

  return (
    <Modal
      open
      title="Choose trainer sprite"
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Image
              src={trainerSpriteUrl(draft)}
              alt=""
              width={48}
              height={48}
              className="pixelated h-12 w-12 object-contain"
              unoptimized
            />
            <span className="font-bold">{formatTrainerSpriteLabel(draft)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="pressable rounded-lg bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)]"
              onClick={() => {
                onSelect(draft);
                onClose();
              }}
            >
              Use sprite
            </button>
          </div>
        </div>
      }
    >
      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-bold text-muted">
          Search Showdown trainers
        </span>
        <input
          autoFocus
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
          placeholder="brendan, may, roxanne…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ResultCount
        visible={visible.length}
        total={total}
        catalogHref={SHOWDOWN_TRAINER_SPRITES_DIR}
        catalogLabel="Showdown trainers"
      />
      <SpriteScrollGrid scrollRef={scrollRef}>
        {visible.map((key) => {
          const selected = draft === key;
          const src = trainerSpriteUrl(key);
          const label = formatTrainerSpriteLabel(key);
          return (
            <SpriteTile
              key={key}
              src={src}
              name={key}
              label={label}
              selected={selected}
              coarse={coarse}
              onSelect={() => setDraft(key)}
              onConfirm={() => {
                onSelect(key);
                onClose();
              }}
              onPreviewShow={preview.show}
              onPreviewHide={preview.hide}
            />
          );
        })}
        <LoadMoreSentinel
          hasMore={hasMore}
          sentinelRef={sentinelRef}
          onLoadMore={loadMore}
          remaining={total - visible.length}
        />
      </SpriteScrollGrid>
      <SpriteHoverPreview preview={preview.preview} />
    </Modal>
  );
}

type PokemonBrowserProps = {
  open: boolean;
  selectedId: number | null;
  onClose: () => void;
  onSelect: (entry: PokemonIndexEntry) => void;
};

function initialPokemonDraft(selectedId: number | null): PokemonIndexEntry | null {
  return selectedId ? (findPokemonById(selectedId) ?? null) : null;
}

export function PokemonSpriteBrowser({
  open,
  selectedId,
  onClose,
  onSelect,
}: PokemonBrowserProps) {
  // Remount when opened so draft/query/generation reset without an effect.
  if (!open) return null;
  return (
    <PokemonSpriteBrowserInner
      key={selectedId ?? "none"}
      selectedId={selectedId}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

function PokemonSpriteBrowserInner({
  selectedId,
  onClose,
  onSelect,
}: Omit<PokemonBrowserProps, "open">) {
  const selected = initialPokemonDraft(selectedId);
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<number | null>(
    selected?.generation ?? 3,
  );
  const [formesOnly, setFormesOnly] = useState(Boolean(selected?.isForme));
  const deferred = useDeferredValue(query);
  const resetKey = `${deferred}|${generation ?? "all"}|${formesOnly ? 1 : 0}`;
  const allResults = useMemo(
    () =>
      searchPokemonIndex(deferred, {
        generation,
        formesOnly: formesOnly ? true : null,
      }),
    [deferred, generation, formesOnly],
  );
  const { visible, total, hasMore, scrollRef, sentinelRef, loadMore } =
    useInfiniteReveal(allResults, resetKey);
  const preview = useSpriteHoverPreview(scrollRef);
  const coarse = useCoarsePointer();
  const [draft, setDraft] = useState<PokemonIndexEntry | null>(selected);

  return (
    <Modal
      open
      title="Choose Pokémon"
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            {draft ? (
              <>
                <Image
                  src={pokemonSpriteUrl(draft.name, {
                    pokedexId: draft.pokedexId,
                  })}
                  alt=""
                  width={48}
                  height={48}
                  className="pixelated h-12 w-12 object-contain"
                  unoptimized
                />
                <span className="font-bold">
                  #{draft.pokedexId} {draft.name}
                  <span className="ml-1 text-xs font-normal text-muted">
                    Gen {draft.generation}
                    {draft.isForme ? " · forme" : ""}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-muted">Pick a species</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="pressable rounded-lg bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!draft}
              className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-60"
              onClick={() => {
                if (!draft) return;
                onSelect(draft);
                onClose();
              }}
            >
              Use Pokémon
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="group"
          aria-label="Generation"
          className="flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            className={`pressable rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-tight ${
              generation == null
                ? "bg-accent text-[var(--on-accent)]"
                : "border border-frame bg-surface"
            }`}
            onClick={() => setGeneration(null)}
          >
            All
          </button>
          {POKEMON_GENERATIONS.map((g) => (
            <button
              key={g}
              type="button"
              className={`pressable rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-tight ${
                generation === g
                  ? "bg-accent text-[var(--on-accent)]"
                  : "border border-frame bg-surface"
              }`}
              onClick={() => setGeneration(g)}
            >
              Gen {g}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={formesOnly}
          className={`pressable inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold tracking-tight ${
            formesOnly
              ? "border-accent/50 bg-accent/15 text-accent-ink"
              : "border-dashed border-frame bg-surface text-muted"
          }`}
          onClick={() => setFormesOnly((v) => !v)}
        >
          <span
            aria-hidden
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
              formesOnly
                ? "border-accent bg-accent text-[var(--on-accent)]"
                : "border-frame bg-surface-2"
            }`}
          >
            {formesOnly ? (
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                <path
                  d="M2.5 6.2 5 8.5 9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
          Formes only
        </button>
      </div>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-bold text-muted">
          Search species & formes
        </span>
        <input
          autoFocus
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2"
          placeholder="Deoxys, Castform, Alola…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ResultCount
        visible={visible.length}
        total={total}
        suffix={`${generation != null ? ` in Gen ${generation}` : ""}${formesOnly ? " formes" : ""}`}
        catalogHref={SHOWDOWN_POKEMON_SPRITES_DIR}
        catalogLabel="Showdown sprites"
      />
      <SpriteScrollGrid scrollRef={scrollRef} maxHeightClass="max-h-[45vh]">
        {visible.map((mon) => {
          const selectedRow = draft?.pokedexId === mon.pokedexId;
          const src = pokemonSpriteUrl(mon.name, {
            pokedexId: mon.pokedexId,
          });
          const label = `#${mon.pokedexId} ${mon.name}`;
          return (
            <SpriteTile
              key={mon.pokedexId}
              src={src}
              name={mon.name}
              label={label}
              selected={selectedRow}
              coarse={coarse}
              onSelect={() => setDraft(mon)}
              onConfirm={() => {
                onSelect(mon);
                onClose();
              }}
              onPreviewShow={preview.show}
              onPreviewHide={preview.hide}
            />
          );
        })}
        <LoadMoreSentinel
          hasMore={hasMore}
          sentinelRef={sentinelRef}
          onLoadMore={loadMore}
          remaining={total - visible.length}
        />
      </SpriteScrollGrid>
      <SpriteHoverPreview preview={preview.preview} />
    </Modal>
  );
}

function ResultCount({
  visible,
  total,
  suffix = "",
  catalogHref,
  catalogLabel,
}: {
  visible: number;
  total: number;
  suffix?: string;
  catalogHref: string;
  catalogLabel: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
      <p className="text-muted">
        Showing {visible}
        {visible < total ? ` of ${total}` : ""}
        {suffix}
        {total === 0 ? " — no matches" : ""}
      </p>
      <a
        href={catalogHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent-deep underline-offset-2 hover:underline"
      >
        {catalogLabel} ↗
      </a>
    </div>
  );
}

type SpritePreview = {
  src: string;
  label: string;
  rect: DOMRect;
};

function SpriteTile({
  src,
  name,
  label,
  selected,
  coarse = false,
  onSelect,
  onConfirm,
  onPreviewShow,
  onPreviewHide,
}: {
  src: string;
  name: string;
  label: string;
  selected: boolean;
  coarse?: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onPreviewShow: (el: HTMLElement, src: string, label: string) => void;
  onPreviewHide: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${
        selected
          ? "border-accent bg-accent/15"
          : "border-frame bg-surface-2 hover:bg-accent/10"
      }`}
      // Touch has no reliable double-click: a tap on the already-selected tile
      // confirms, so it acts as a fast double-tap. Desktop keeps select + the
      // native double-click shortcut below.
      onClick={coarse && selected ? onConfirm : onSelect}
      onDoubleClick={onConfirm}
      onMouseEnter={(e) => onPreviewShow(e.currentTarget, src, label)}
      onMouseLeave={onPreviewHide}
      onFocus={(e) => onPreviewShow(e.currentTarget, src, label)}
      onBlur={onPreviewHide}
    >
      <Image
        src={src}
        alt=""
        width={40}
        height={40}
        className="pixelated h-10 w-10 object-contain"
        unoptimized
        loading="lazy"
      />
      <span className="w-full truncate text-[10px] font-bold text-muted">
        {name}
      </span>
    </button>
  );
}

function SpriteHoverPreview({ preview }: { preview: SpritePreview | null }) {
  if (!preview || typeof document === "undefined") return null;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const placeRight =
    viewportW - preview.rect.right >= PREVIEW_PANEL_W + PREVIEW_GAP;
  const left = placeRight
    ? preview.rect.right + PREVIEW_GAP
    : Math.max(8, preview.rect.left - PREVIEW_PANEL_W - PREVIEW_GAP);
  const top = Math.max(
    8,
    Math.min(
      preview.rect.top + preview.rect.height / 2 - PREVIEW_PANEL_H / 2,
      viewportH - PREVIEW_PANEL_H - 8,
    ),
  );

  return createPortal(
    <div
      role="presentation"
      className="pointer-events-none fixed z-[120]"
      style={{ top, left, width: PREVIEW_PANEL_W }}
    >
      <div className="gba-frame overflow-hidden rounded-xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.28)] motion-safe:animate-[sprite-preview-in_120ms_ease-out]">
        <div className="flex items-center justify-center bg-surface-2 p-3">
          <Image
            src={preview.src}
            alt=""
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            className="pixelated h-40 w-40 object-contain"
            unoptimized
          />
        </div>
        <p className="truncate border-t border-frame/60 px-3 py-2 text-center text-xs font-bold">
          {preview.label}
        </p>
      </div>
    </div>,
    document.body,
  );
}

function useSpriteHoverPreview(scrollRef: RefObject<HTMLDivElement | null>) {
  const [preview, setPreview] = useState<SpritePreview | null>(null);
  const showingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = () => {
    clearTimer();
    showingRef.current = false;
    setPreview(null);
  };

  const show = (el: HTMLElement, src: string, label: string) => {
    // Touch / coarse pointers don't get a useful hover zoom.
    if (window.matchMedia("(hover: none)").matches) return;

    clearTimer();
    const next: SpritePreview = {
      src,
      label,
      rect: el.getBoundingClientRect(),
    };
    if (showingRef.current) {
      setPreview(next);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      showingRef.current = true;
      setPreview(next);
      timerRef.current = null;
    }, PREVIEW_SHOW_DELAY_MS);
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      showingRef.current = false;
      setPreview(null);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  useEffect(() => () => clearTimer(), []);

  return { preview, show, hide };
}

function SpriteScrollGrid({
  scrollRef,
  children,
  maxHeightClass = "max-h-[50vh]",
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  maxHeightClass?: string;
}) {
  return (
    <div
      ref={scrollRef}
      className={`grid ${maxHeightClass} grid-cols-4 content-start gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8`}
    >
      {children}
    </div>
  );
}

function LoadMoreSentinel({
  hasMore,
  sentinelRef,
  onLoadMore,
  remaining,
}: {
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  remaining: number;
}) {
  if (!hasMore) return null;
  return (
    <div
      ref={sentinelRef}
      className="col-span-full flex flex-col items-center gap-2 py-2"
    >
      <span className="text-[10px] text-muted">
        Scroll for {remaining} more…
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

/** Progressive reveal so dense sprite grids stay light until scrolled. */
function useInfiniteReveal<T>(items: T[], resetKey: string) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [prevKey, setPrevKey] = useState(resetKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setVisibleCount(PAGE_SIZE);
  }

  const total = items.length;
  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < total;

  const loadMore = () => {
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, total));
  };

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, total));
        }
      },
      { root, rootMargin: "160px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, total, visibleCount, resetKey]);

  return {
    visible,
    total,
    hasMore,
    scrollRef,
    sentinelRef,
    loadMore,
  };
}
