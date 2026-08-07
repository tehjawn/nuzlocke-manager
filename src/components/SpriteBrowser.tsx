"use client";

import Image from "next/image";
import {
  useDeferredValue,
  useEffect,
  useId,
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
  pokemonAnimatedSpriteUrl,
  pokemonSpriteUrl,
  SHOWDOWN_ANI_SPRITES_DIR,
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
const SIDEBAR_SPRITE_PX = 192;

type SpritePickerPreview = {
  src: string;
  title: string;
  subtitle?: string;
  /** Showdown ani GIFs aren't pixel art. */
  smooth?: boolean;
};

/** Catalog on the left; large selection preview + actions on the right. */
function SpritePickerShell({
  catalog,
  preview,
  emptyLabel,
  confirmLabel,
  canConfirm,
  onClose,
  onConfirm,
}: {
  catalog: ReactNode;
  preview: SpritePickerPreview | null;
  emptyLabel: string;
  confirmLabel: string;
  canConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-4 sm:h-[min(68vh,36rem)] sm:flex-row sm:gap-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{catalog}</div>
      <aside className="order-first grid w-full shrink-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-lg border border-frame/50 bg-surface-2/70 p-3 sm:order-none sm:flex sm:w-48 sm:flex-col lg:w-56">
        <div className="flex aspect-square w-[4.5rem] items-center justify-center rounded-lg border border-frame/40 bg-surface p-2 sm:w-full sm:p-3">
          {preview ? (
            <Image
              src={preview.src}
              alt=""
              width={SIDEBAR_SPRITE_PX}
              height={SIDEBAR_SPRITE_PX}
              className={`${preview.smooth ? "" : "pixelated "}h-14 w-14 object-contain sm:h-44 sm:w-44`}
              unoptimized
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted">
              {emptyLabel}
            </span>
          )}
        </div>
        <div className="min-w-0 self-center text-left sm:min-h-12 sm:self-auto sm:text-center">
          {preview && (
            <>
              <p className="text-sm font-bold leading-snug">{preview.title}</p>
              {preview.subtitle && (
                <p className="mt-0.5 text-[11px] text-muted">
                  {preview.subtitle}
                </p>
              )}
            </>
          )}
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:mt-auto sm:flex sm:flex-col">
          <button
            type="button"
            disabled={!canConfirm}
            className="pressable w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-60"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="pressable w-full rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}

type TrainerBrowserProps = {
  open: boolean;
  /** When null, no sprite is preselected (Use stays disabled until a pick). */
  selectedKey: string | null;
  onClose: () => void;
  onSelect: (key: string) => void;
  /** Render panel content only (parent owns the modal chrome). */
  embedded?: boolean;
};

export function TrainerSpriteBrowser({
  open,
  selectedKey,
  onClose,
  onSelect,
  embedded = false,
}: TrainerBrowserProps) {
  // Remount when opened so draft/query reset from props without an effect.
  if (!open) return null;
  return (
    <TrainerSpriteBrowserInner
      key={selectedKey ?? "none"}
      selectedKey={selectedKey}
      onClose={onClose}
      onSelect={onSelect}
      embedded={embedded}
    />
  );
}

function TrainerSpriteBrowserInner({
  selectedKey,
  onClose,
  onSelect,
  embedded,
}: Omit<TrainerBrowserProps, "open">) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const allResults = useMemo(() => searchTrainerSprites(deferred), [deferred]);
  const { visible, total, hasMore, scrollRef, sentinelRef, loadMore } =
    useInfiniteReveal(allResults, deferred);
  const hover = useSpriteHoverPreview(scrollRef);
  const coarse = useCoarsePointer();
  const [draft, setDraft] = useState<string | null>(selectedKey);

  const catalog = (
    <>
      <label className="mb-3 block shrink-0 text-sm">
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
              onPreviewShow={hover.show}
              onPreviewHide={hover.hide}
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
      <SpriteHoverPreview preview={hover.preview} />
    </>
  );

  const body = (
    <SpritePickerShell
      catalog={catalog}
      preview={
        draft
          ? {
              src: trainerSpriteUrl(draft),
              title: formatTrainerSpriteLabel(draft),
            }
          : null
      }
      emptyLabel="Pick a trainer sprite"
      confirmLabel="Use sprite"
      canConfirm={Boolean(draft)}
      onClose={onClose}
      onConfirm={() => {
        if (!draft) return;
        onSelect(draft);
        onClose();
      }}
    />
  );

  if (embedded) return body;

  return (
    <Modal open title="Choose trainer sprite" onClose={onClose} wide>
      {body}
    </Modal>
  );
}

type PokemonBrowserProps = {
  open: boolean;
  selectedId: number | null;
  onClose: () => void;
  onSelect: (entry: PokemonIndexEntry) => void;
  /** Render panel content only (parent owns the modal chrome). */
  embedded?: boolean;
  /** Showdown `/sprites/ani/` GIFs instead of static dex sprites. */
  animated?: boolean;
  /** Portrait picker: include Still/Animated in the compact filter row. */
  showMotionFilter?: boolean;
  onAnimatedChange?: (animated: boolean) => void;
};

function initialPokemonDraft(
  selectedId: number | null,
): PokemonIndexEntry | null {
  return selectedId ? (findPokemonById(selectedId) ?? null) : null;
}

export function PokemonSpriteBrowser({
  open,
  selectedId,
  onClose,
  onSelect,
  embedded = false,
  animated = false,
  showMotionFilter = false,
  onAnimatedChange,
}: PokemonBrowserProps) {
  // Remount when opened so draft/query/generation reset without an effect.
  if (!open) return null;
  return (
    <PokemonSpriteBrowserInner
      key={selectedId ?? "none"}
      selectedId={selectedId}
      onClose={onClose}
      onSelect={onSelect}
      embedded={embedded}
      animated={animated}
      showMotionFilter={showMotionFilter}
      onAnimatedChange={onAnimatedChange}
    />
  );
}

function PokemonSpriteBrowserInner({
  selectedId,
  onClose,
  onSelect,
  embedded,
  animated = false,
  showMotionFilter = false,
  onAnimatedChange,
}: Omit<PokemonBrowserProps, "open">) {
  const selected = initialPokemonDraft(selectedId);
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<number | null>(
    selected?.generation ?? 3,
  );
  const [formesOnly, setFormesOnly] = useState(Boolean(selected?.isForme));
  const [filterMenu, setFilterMenu] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const resetKey = `${deferred}|${generation ?? "all"}|${formesOnly ? 1 : 0}|${animated ? "ani" : "still"}`;
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
  const hover = useSpriteHoverPreview(scrollRef);
  const coarse = useCoarsePointer();
  const [draft, setDraft] = useState<PokemonIndexEntry | null>(selected);

  const spriteSrc = (mon: PokemonIndexEntry) =>
    animated
      ? pokemonAnimatedSpriteUrl(mon.slug)
      : pokemonSpriteUrl(mon.name, { pokedexId: mon.pokedexId });
  const stillSrc = (mon: PokemonIndexEntry) =>
    pokemonSpriteUrl(mon.name, { pokedexId: mon.pokedexId });

  const catalog = (
    <>
      <div className="mb-2 flex shrink-0 flex-col gap-2">
        <div
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || filterMenu == null) return;
            // Prefer dismissing an open filter menu over the parent Modal.
            event.stopPropagation();
            setFilterMenu(null);
          }}
        >
          {showMotionFilter && (
            <FilterSubmenu
              id="motion"
              openId={filterMenu}
              onOpenChange={setFilterMenu}
              label="Style"
              valueLabel={animated ? "Animated" : "Still"}
              options={[
                { value: "still", label: "Still" },
                { value: "animated", label: "Animated" },
              ]}
              value={animated ? "animated" : "still"}
              onChange={(next) => onAnimatedChange?.(next === "animated")}
            />
          )}
          <FilterSubmenu
            id="gen"
            openId={filterMenu}
            onOpenChange={setFilterMenu}
            label="Gen"
            valueLabel={generation == null ? "All gens" : `Gen ${generation}`}
            options={[
              { value: "all", label: "All gens" },
              ...POKEMON_GENERATIONS.map((g) => ({
                value: String(g),
                label: `Gen ${g}`,
              })),
            ]}
            value={generation == null ? "all" : String(generation)}
            onChange={(next) =>
              setGeneration(next === "all" ? null : Number(next))
            }
          />
          <FilterSubmenu
            id="formes"
            openId={filterMenu}
            onOpenChange={setFilterMenu}
            label="Formes"
            valueLabel={formesOnly ? "Formes" : "All"}
            options={[
              { value: "all", label: "All species" },
              { value: "formes", label: "Formes only" },
            ]}
            value={formesOnly ? "formes" : "all"}
            onChange={(next) => setFormesOnly(next === "formes")}
          />
          <input
            autoFocus
            aria-label="Search species and formes"
            className="min-w-0 flex-1 rounded-md border border-frame bg-surface px-2.5 py-1.5 text-sm"
            placeholder="Search species…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ResultCount
          visible={visible.length}
          total={total}
          suffix={`${generation != null ? ` · Gen ${generation}` : ""}${formesOnly ? " · formes" : ""}${animated ? " · ani" : ""}`}
          catalogHref={
            animated ? SHOWDOWN_ANI_SPRITES_DIR : SHOWDOWN_POKEMON_SPRITES_DIR
          }
          catalogLabel={animated ? "Showdown ani" : "Showdown sprites"}
        />
      </div>
      <SpriteScrollGrid scrollRef={scrollRef}>
        {visible.map((mon) => {
          const selectedRow = draft?.pokedexId === mon.pokedexId;
          const src = spriteSrc(mon);
          const label = `#${mon.pokedexId} ${mon.name}`;
          return (
            <SpriteTile
              key={mon.pokedexId}
              src={src}
              fallbackSrc={animated ? stillSrc(mon) : undefined}
              name={mon.name}
              label={label}
              selected={selectedRow}
              coarse={coarse}
              smooth={animated}
              onSelect={() => setDraft(mon)}
              onConfirm={() => {
                onSelect(mon);
                onClose();
              }}
              onPreviewShow={hover.show}
              onPreviewHide={hover.hide}
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
      <SpriteHoverPreview preview={hover.preview} smooth={animated} />
    </>
  );

  const body = (
    <SpritePickerShell
      catalog={catalog}
      preview={
        draft
          ? {
              src: spriteSrc(draft),
              title: `#${draft.pokedexId} ${draft.name}`,
              subtitle: `Gen ${draft.generation}${draft.isForme ? " · forme" : ""}${animated ? " · animated" : ""}`,
              smooth: animated,
            }
          : null
      }
      emptyLabel="Pick a species"
      confirmLabel={animated ? "Use animated" : "Use Pokémon"}
      canConfirm={Boolean(draft)}
      onClose={onClose}
      onConfirm={() => {
        if (!draft) return;
        onSelect(draft);
        onClose();
      }}
    />
  );

  if (embedded) return body;

  return (
    <Modal open title="Choose Pokémon" onClose={onClose} wide>
      {body}
    </Modal>
  );
}

type FilterOption = { value: string; label: string };

function FilterSubmenu({
  id,
  openId,
  onOpenChange,
  label,
  valueLabel,
  options,
  value,
  onChange,
}: {
  id: string;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  label: string;
  valueLabel: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const open = openId === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        // Stop Modal's Escape handler from closing the whole picker.
        event.stopPropagation();
        onOpenChange(null);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        className={`pressable inline-flex max-w-36 items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold tracking-tight ${
          open
            ? "border-accent/50 bg-accent/15 text-accent-ink"
            : "border-frame bg-surface text-ink"
        }`}
        onClick={() => onOpenChange(open ? null : id)}
      >
        <span className="truncate">{valueLabel}</span>
        <FilterChevron open={open} />
      </button>
      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 min-w-full overflow-hidden rounded-md border border-frame bg-surface py-0.5 shadow-[0_8px_24px_var(--shadow-md)]"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-tight ${
                    selected
                      ? "bg-accent/15 text-accent-ink"
                      : "text-ink hover:bg-accent/10"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    onOpenChange(null);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-2.5 w-2.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px]">
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
  fallbackSrc,
  name,
  label,
  selected,
  coarse = false,
  smooth = false,
  onSelect,
  onConfirm,
  onPreviewShow,
  onPreviewHide,
}: {
  src: string;
  fallbackSrc?: string;
  name: string;
  label: string;
  selected: boolean;
  coarse?: boolean;
  smooth?: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onPreviewShow: (el: HTMLElement, src: string, label: string) => void;
  onPreviewHide: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const displaySrc =
    failed && fallbackSrc && fallbackSrc !== src ? fallbackSrc : src;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 ${
        selected
          ? "border-accent bg-accent/15"
          : "border-frame bg-surface-2 hover:bg-accent/10"
      }`}
      // Touch has no reliable double-click: a tap on the already-selected tile
      // confirms, so it acts as a fast double-tap. Desktop keeps select + the
      // native double-click shortcut below.
      onClick={coarse && selected ? onConfirm : onSelect}
      onDoubleClick={onConfirm}
      onMouseEnter={(e) => onPreviewShow(e.currentTarget, displaySrc, label)}
      onMouseLeave={onPreviewHide}
      onFocus={(e) => onPreviewShow(e.currentTarget, displaySrc, label)}
      onBlur={onPreviewHide}
    >
      <Image
        key={displaySrc}
        src={displaySrc}
        alt=""
        width={72}
        height={72}
        className={`${smooth && !failed ? "" : "pixelated "}h-14 w-14 object-contain sm:h-16 sm:w-16`}
        unoptimized
        loading="lazy"
        onError={() => {
          if (fallbackSrc && !failed) setFailed(true);
        }}
      />
      <span className="w-full truncate text-[11px] font-bold text-muted">
        {name}
      </span>
    </button>
  );
}

function SpriteHoverPreview({
  preview,
  smooth = false,
}: {
  preview: SpritePreview | null;
  smooth?: boolean;
}) {
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
            className={`${smooth ? "" : "pixelated "}h-40 w-40 object-contain`}
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
  maxHeightClass = "max-h-[42vh] min-h-0 sm:max-h-none sm:flex-1",
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  maxHeightClass?: string;
}) {
  return (
    <div
      ref={scrollRef}
      className={`grid ${maxHeightClass} grid-cols-3 content-start gap-2.5 overflow-y-auto sm:grid-cols-4 md:grid-cols-5`}
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
