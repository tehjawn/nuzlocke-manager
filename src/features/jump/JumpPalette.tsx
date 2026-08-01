"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  clearRecentJumps,
  defaultSuggestions,
  getRecentJumps,
  saveRecentJump,
  searchJumpIndex,
} from "@/features/jump/jump-index";
import { useJump } from "@/features/jump/JumpProvider";
import type {
  JumpCategory,
  JumpFuseHit,
  JumpResult,
} from "@/features/jump/jump-types";
import { getAppliedTheme, toggleTheme } from "@/lib/theme";

const CATEGORY_ORDER: JumpCategory[] = [
  "navigate",
  "trainer",
  "pokemon",
  "badge",
  "rules",
  "action",
];

const CATEGORY_LABEL: Record<JumpCategory, string> = {
  navigate: "Navigate",
  trainer: "Trainers",
  pokemon: "Pokémon",
  badge: "Badges",
  rules: "Rules & FAQ",
  action: "Actions",
};

function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices: ReadonlyArray<readonly [number, number]> | undefined;
}) {
  if (!indices?.length) return <>{text}</>;

  const parts: ReactNode[] = [];
  let last = 0;
  indices.forEach(([start, end], i) => {
    if (start > last) {
      parts.push(<span key={`t-${i}`}>{text.slice(last, start)}</span>);
    }
    parts.push(
      <mark
        key={`m-${i}`}
        className="rounded-[2px] bg-interactive-soft font-medium text-ink"
      >
        {text.slice(start, end + 1)}
      </mark>,
    );
    last = end + 1;
  });
  if (last < text.length) {
    parts.push(<span key="t-end">{text.slice(last)}</span>);
  }
  return <>{parts}</>;
}

function matchIndices(
  matches: JumpFuseHit["matches"],
  key: "title" | "subtitle",
) {
  return matches?.find((m) => m.key === key)?.indices;
}

function ResultIcon({ item }: { item: JumpResult }) {
  if (item.pokemonSprite) {
    return (
      <PokemonSpriteImage
        alt=""
        className="pixelated h-7 w-7 shrink-0 object-contain"
        height={28}
        pokedexId={item.pokemonSprite.pokedexId}
        shiny={item.pokemonSprite.shiny}
        species={item.pokemonSprite.species}
        width={28}
      />
    );
  }

  if (item.imageUrl) {
    // Plain img: Jump icons come from Showdown / PokeAPI / Blob and must not
    // depend on next/image remotePatterns (custom avatars break search in prod).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        width={28}
        height={28}
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

export function JumpPalette() {
  const { open, setOpen, results, index } = useJump();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [seenOpen, setSeenOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset ephemeral search state when the palette opens (render-time sync).
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setQuery("");
      setRecents(getRecentJumps());
    }
  }

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const suggestions = useMemo(() => defaultSuggestions(results), [results]);

  // Derive from the live index so hits refresh when season registration lands
  // after hydration (stale hits were empty forever in prod until retyping).
  const hits = useMemo(() => {
    if (!query.trim()) return [] as JumpFuseHit[];
    return searchJumpIndex(index, query);
  }, [index, query]);

  const groupedHits = useMemo(() => {
    const groups = new Map<JumpCategory, JumpFuseHit[]>();
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

  const onQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setOpen]);

  const runResult = useCallback(
    (item: JumpResult) => {
      saveRecentJump(item.title);
      setRecents(getRecentJumps());
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-modal-open=""
      className="fixed inset-0 z-[200] flex items-start justify-center px-3 pt-[12vh] sm:px-4 sm:pt-[14vh]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        aria-label="Close jump"
        className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px] motion-safe:animate-[jump-scrim-in_140ms_ease-out]"
        onClick={close}
      />

      <Command
        shouldFilter={false}
        label="Jump"
        className="gba-frame relative z-10 w-full max-w-xl overflow-hidden shadow-[0_16px_48px_var(--shadow-md)] outline-none motion-safe:animate-[jump-panel-in_160ms_cubic-bezier(0.22,1,0.36,1)] sm:rounded-xl"
      >
        <div className="relative z-[1] flex items-center gap-2 border-b border-frame/70 px-3 py-2.5 sm:px-4">
          <SearchGlyph className="h-4 w-4 shrink-0 text-muted" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={onQueryChange}
            placeholder="Jump to trainer, Pokémon, page…"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted/80"
          />
          <kbd className="hidden shrink-0 rounded border border-frame/80 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted sm:inline">
            esc
          </kbd>
        </div>

        <Command.List className="relative z-[1] max-h-[min(52vh,420px)] overflow-y-auto p-2">
          {!query.trim() ? (
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
                        clearRecentJumps();
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
                  <JumpItem
                    key={item.id}
                    item={item}
                    onSelect={() => runResult(item)}
                  />
                ))}
              </Command.Group>
            </>
          ) : null}

          {query.trim() && hits.length === 0 ? (
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
              No matches for “{query.trim()}”
            </Command.Empty>
          ) : null}

          {groupedHits.map((group) => (
            <Command.Group
              key={group.category}
              heading={CATEGORY_LABEL[group.category]}
              className="[&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted"
            >
              {group.items.map((hit) => (
                <JumpItem
                  key={hit.item.id}
                  item={hit.item}
                  titleIndices={matchIndices(hit.matches, "title")}
                  subtitleIndices={matchIndices(hit.matches, "subtitle")}
                  onSelect={() => runResult(hit.item)}
                />
              ))}
            </Command.Group>
          ))}
        </Command.List>

        <footer className="relative z-[1] flex items-center justify-between gap-3 border-t border-frame/60 bg-surface-2/80 px-3 py-2 text-[11px] text-muted sm:px-4">
          <span className="font-medium tracking-tight">Jump</span>
          <span className="flex items-center gap-2 font-mono">
            <span>
              <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">↑</kbd>{" "}
              <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">↓</kbd>{" "}
              move
            </span>
            <span className="hidden sm:inline">
              <kbd className="rounded border border-frame/80 bg-surface px-1 py-0.5">↵</kbd>{" "}
              open
            </span>
          </span>
        </footer>
      </Command>
    </div>,
    document.body,
  );
}

function JumpItem({
  item,
  onSelect,
  titleIndices,
  subtitleIndices,
}: {
  item: JumpResult;
  onSelect: () => void;
  titleIndices?: ReadonlyArray<readonly [number, number]>;
  subtitleIndices?: ReadonlyArray<readonly [number, number]>;
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
          <HighlightedText text={item.title} indices={titleIndices} />
        </p>
        {item.subtitle ? (
          <p className="truncate text-xs text-muted">
            <HighlightedText text={item.subtitle} indices={subtitleIndices} />
          </p>
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
