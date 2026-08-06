"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Frame } from "@/components/Frame";
import { ModeTabs } from "@/components/ModeTabs";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { heldItemDescription, heldItemSpriteUrl } from "@/data/pokemon-index";
import {
  evolutionUsesForItem,
  findItem,
  isWildHoldOnly,
  ITEM_LENSES,
  parseItemLens,
  searchItems,
  WILD_HOLD_RATES,
  type ItemEvolutionUse,
  type ItemLens,
  type ItemSource,
  type ItemSourceKind,
  type ModernItem,
} from "@/data/items";
import { toolsHref } from "@/lib/tools-routes";

/** Opening entry when nothing is deep-linked — the ticket's worked example. */
const DEFAULT_ITEM_SLUG = "spell-tag";

const SOURCE_KIND_LABELS: Record<ItemSourceKind, string> = {
  ball: "Item ball",
  hidden: "Hidden item",
  gift: "NPC gift",
  berry: "Berry tree",
  mart: "Sold at",
  held: "Wild hold",
  pickup: "Pickup",
};

/** Everything except `held` sits still across seeds. */
const FIXED_KINDS: ReadonlySet<ItemSourceKind> = new Set([
  "ball",
  "hidden",
  "gift",
  "berry",
  "mart",
]);

const POCKET_LABELS: Record<ModernItem["pocket"], string> = {
  items: "Items",
  balls: "Poké Balls",
  "tm-hm": "TMs & HMs",
  berries: "Berries",
  key: "Key items",
};

type ItemDexPanelProps = {
  slug: string;
  initialItem?: string | null;
  initialLens?: ItemLens | null;
};

export function ItemDexPanel({
  slug,
  initialItem = null,
  initialLens = null,
}: ItemDexPanelProps) {
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState<ItemLens>(parseItemLens(initialLens));
  // Null falls through to the deep link, then the default entry.
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => searchItems(deferredQuery, { lens }),
    [deferredQuery, lens],
  );

  const focusSlug = pickedSlug ?? initialItem ?? DEFAULT_ITEM_SLUG;
  const selected = findItem(focusSlug) ?? findItem(DEFAULT_ITEM_SLUG);
  const selectedIndex = selected
    ? results.findIndex((item) => item.slug === selected.slug)
    : -1;

  // Mode / item URL updates use history.pushState (not the Next router) so the
  // tools page doesn't RSC-refetch, matching the Pokédex. Sync state on
  // back/forward through those entries.
  useEffect(() => {
    function onPopState() {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tool") !== "itemdex") return;
      setLens(parseItemLens(url.searchParams.get("mode")));
      setPickedSlug(url.searchParams.get("item"));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function writeUrl(nextLens: ItemLens, nextSlug: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.set("tool", "itemdex");
    if (nextLens === "useful") url.searchParams.delete("mode");
    else url.searchParams.set("mode", nextLens);
    if (nextSlug) url.searchParams.set("item", nextSlug);
    else url.searchParams.delete("item");
    if (url.href === window.location.href) return;
    window.history.pushState(window.history.state, "", url.href);
  }

  function selectItem(item: ModernItem) {
    setPickedSlug(item.slug);
    writeUrl(lens, item.slug);
  }

  function selectLens(next: ItemLens) {
    setLens(next);
    writeUrl(next, selected?.slug ?? null);
  }

  function step(delta: -1 | 1) {
    if (selectedIndex < 0) return;
    const next = results[selectedIndex + delta];
    if (next) selectItem(next);
  }

  return (
    <ModeTabs
      aria-label="ItemDex lens"
      idPrefix="itemdex"
      value={lens}
      tabs={ITEM_LENSES}
      onValueChange={selectLens}
      panelClassName="space-y-4"
    >
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-muted">Search</p>
        <input
          className="min-w-0 w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
          placeholder="Item, move, route or holder…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-label="Search items"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <Frame
          title="Items"
          dense
          className="min-w-0 self-start"
          actions={
            <span className="text-[11px] font-semibold tabular-nums text-[var(--on-chrome)]/80">
              {results.length}
            </span>
          }
        >
          {results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">No matches.</p>
          ) : (
            <ul
              role="listbox"
              aria-label="Item list"
              className="m-0 max-h-[min(22rem,42vh)] list-none overflow-y-auto overscroll-contain p-0 lg:max-h-[min(32rem,52vh)]"
            >
              {results.map((item) => {
                const active = selected?.slug === item.slug;
                return (
                  <li key={item.slug} className="m-0 p-0">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`pressable flex w-full items-center gap-2 border-b border-frame/25 px-1.5 py-1.5 text-left ${
                        active ? "bg-relic-soft" : "hover:bg-surface-2/80"
                      }`}
                      onClick={() => selectItem(item)}
                    >
                      <ItemIcon item={item} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-tight">
                          {item.name}
                        </span>
                        {item.move ? (
                          <span className="block truncate text-[11px] leading-tight text-muted">
                            {item.move}
                          </span>
                        ) : null}
                      </span>
                      {isWildHoldOnly(item) ? (
                        <span
                          className="shrink-0 rounded border border-warn/50 bg-warn/15 px-1 text-[10px] font-bold leading-tight text-warn"
                          title="No fixed pickup — wild hold only"
                        >
                          HOLD
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Frame>

        {selected ? (
          <div className="min-w-0 self-start lg:sticky lg:top-4">
            <ItemEntry
              slug={slug}
              item={selected}
              canGoPrev={selectedIndex > 0}
              canGoNext={
                selectedIndex >= 0 && selectedIndex < results.length - 1
              }
              onPrev={() => step(-1)}
              onNext={() => step(1)}
            />
          </div>
        ) : (
          <Frame title="Data" className="self-start">
            <p className="text-sm text-muted">
              Pick an item on the left — what it does and where it comes from
              fill in here.
            </p>
          </Frame>
        )}
      </div>
    </ModeTabs>
  );
}

function ItemIcon({ item, size = 32 }: { item: ModernItem; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={heldItemSpriteUrl(item.slug)}
      alt=""
      width={size}
      height={size}
      className="pixelated shrink-0 object-contain"
      style={{ width: size, height: size }}
      decoding="async"
      loading="lazy"
    />
  );
}

function ItemEntry({
  slug,
  item,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: {
  slug: string;
  item: ModernItem;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const evolutionUses = evolutionUsesForItem(item.slug);
  const fixed = item.sources.filter((source) => FIXED_KINDS.has(source.kind));
  const held = item.sources.filter((source) => source.kind === "held");
  const pickup = item.sources.find((source) => source.kind === "pickup");
  // Showdown's battle text is sharper than the ROM's on held items; the ROM
  // string stays as the fallback (and is the only text for bag-use items).
  const battleText = heldItemDescription(item.slug);

  return (
    <Frame
      title={item.name}
      className="min-w-0"
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="pressable rounded-md border border-[var(--on-chrome)]/25 bg-[var(--on-chrome)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--on-chrome)] disabled:opacity-40"
            disabled={!canGoPrev}
            aria-label="Previous item"
            onClick={onPrev}
          >
            ◀
          </button>
          <button
            type="button"
            className="pressable rounded-md border border-[var(--on-chrome)]/25 bg-[var(--on-chrome)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--on-chrome)] disabled:opacity-40"
            disabled={!canGoNext}
            aria-label="Next item"
            onClick={onNext}
          >
            ▶
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-frame bg-surface-2">
            <ItemIcon item={item} size={40} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex rounded border border-relic/45 bg-relic-soft px-1.5 py-0.5 text-[11px] font-semibold tracking-tight text-relic">
                {POCKET_LABELS[item.pocket]}
              </span>
              {item.move ? (
                <span className="inline-flex rounded border border-frame/50 bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tracking-tight">
                  Teaches {item.move}
                </span>
              ) : null}
              {item.price > 0 ? (
                <span className="inline-flex rounded border border-frame/50 bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-tight text-muted">
                  ₽{item.price.toLocaleString()}
                </span>
              ) : null}
            </div>
            {item.description ? (
              <p className="text-sm leading-snug">{item.description}</p>
            ) : null}
            {battleText && battleText !== item.description ? (
              <p className="text-[11px] leading-snug text-muted">
                In battle: {battleText}
              </p>
            ) : null}
          </div>
        </div>

        {evolutionUses.length > 0 ? (
          <EvolutionUses slug={slug} uses={evolutionUses} />
        ) : null}

        <Sources
          slug={slug}
          item={item}
          fixed={fixed}
          held={held}
          pickup={pickup ?? null}
        />
      </div>
    </Frame>
  );
}

function EvolutionUses({
  slug,
  uses,
}: {
  slug: string;
  uses: ItemEvolutionUse[];
}) {
  return (
    <section>
      <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
        Evolves
      </p>
      <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
        {uses.map((use) => (
          <li
            key={`${use.fromId}-${use.intoId}`}
            className="flex items-center gap-2 rounded-lg border border-frame/40 bg-surface-2 px-2 py-1.5"
          >
            <Link
              href={toolsHref(slug, "pokedex", { id: use.fromId })}
              className="pressable flex min-w-0 items-center gap-1.5"
            >
              <PokemonSpriteImage
                alt=""
                className="pixelated h-8 w-8 shrink-0 object-contain"
                height={32}
                loading="lazy"
                pokedexId={use.fromId}
                species={use.fromName}
                width={32}
              />
              <span className="truncate text-xs font-semibold">
                {use.fromName}
              </span>
            </Link>
            <span aria-hidden className="shrink-0 text-xs text-muted">
              →
            </span>
            <Link
              href={toolsHref(slug, "pokedex", { id: use.intoId })}
              className="pressable flex min-w-0 items-center gap-1.5"
            >
              <PokemonSpriteImage
                alt=""
                className="pixelated h-8 w-8 shrink-0 object-contain"
                height={32}
                loading="lazy"
                pokedexId={use.intoId}
                species={use.intoName}
                width={32}
              />
              <span className="truncate text-xs font-semibold">
                {use.intoName}
              </span>
            </Link>
            <span className="ml-auto shrink-0 text-[10px] font-bold tracking-tight text-muted">
              {use.needsTrade ? "TRADE" : use.isHold ? "HOLD" : "USE"}
            </span>
          </li>
        ))}
      </ul>
      {uses.some((use) => use.needsTrade) ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          Trade evolutions need a partner — the item alone will not do it on a
          solo run.
        </p>
      ) : null}
      <p className="mt-1 text-[11px] leading-snug text-muted">
        With the evolution-method randomizer on, a species reads another
        species&rsquo; evolution row — check your own save before committing an
        item.
      </p>
    </section>
  );
}

function Sources({
  slug,
  item,
  fixed,
  held,
  pickup,
}: {
  slug: string;
  item: ModernItem;
  fixed: ItemSource[];
  held: ItemSource[];
  pickup: ItemSource | null;
}) {
  const holdOnly = isWildHoldOnly(item);

  return (
    <section>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-tight text-muted">
          Where to find it
        </p>
        <p className="text-[11px] text-muted">
          Item locations are not randomized — only holders move.
        </p>
      </div>

      {item.sources.length === 0 ? (
        <p className="rounded-lg border border-frame/40 bg-surface-2 px-2.5 py-2 text-sm text-muted">
          No source in the ROM&rsquo;s overworld tables. Reachable only through
          in-game events this catalog doesn&rsquo;t model.
        </p>
      ) : null}

      {holdOnly ? (
        <p className="mb-2 rounded-lg border border-warn/50 bg-warn/10 px-2.5 py-2 text-[11px] leading-snug">
          <span className="font-bold">No pickup anywhere in the ROM.</span> Not
          a ball, not a hidden square, not a shop — the only way to get one is
          off a wild holder. Wild species are randomized, so find where the
          holder below actually spawns in your seed rather than trusting a
          vanilla route list.
        </p>
      ) : null}

      {fixed.length > 0 ? (
        <ul className="m-0 mb-2 list-none space-y-1 p-0">
          {fixed.map((source, index) => (
            <li
              key={`${source.kind}-${source.where}-${source.detail}-${index}`}
              className="flex items-baseline gap-2 rounded-lg border border-frame/40 bg-surface-2 px-2.5 py-1.5"
            >
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-tight text-muted">
                {SOURCE_KIND_LABELS[source.kind]}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                {source.detail ?? source.where}
                {source.detail && source.where !== source.detail ? (
                  <span className="ml-1.5 text-[11px] font-medium text-muted">
                    {source.where}
                  </span>
                ) : null}
              </span>
              {source.count && source.count > 1 ? (
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted">
                  ×{source.count}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {held.length > 0 ? (
        <div className="mb-2">
          <p className="mb-1 text-[11px] font-semibold tracking-tight text-muted">
            Held by wild
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {held.map((source) => {
              const label = source.species ?? "Unknown";
              const chip = (
                <span className="flex items-center gap-1.5">
                  {source.pokedexId ? (
                    <PokemonSpriteImage
                      alt=""
                      className="pixelated h-7 w-7 shrink-0 object-contain"
                      height={28}
                      loading="lazy"
                      pokedexId={source.pokedexId}
                      species={label}
                      width={28}
                    />
                  ) : null}
                  <span className="text-xs font-semibold">{label}</span>
                  <span
                    className={`rounded border px-1 text-[10px] font-bold leading-tight ${
                      source.rate === "always"
                        ? "border-accent/45 bg-accent/12 text-accent-deep"
                        : source.rate === "common"
                          ? "border-frame/50 bg-surface text-muted"
                          : "border-warn/50 bg-warn/12 text-warn"
                    }`}
                  >
                    {holdRateLabel(source.rate)}
                  </span>
                </span>
              );
              return (
                <li key={label}>
                  {source.pokedexId ? (
                    <Link
                      href={toolsHref(slug, "pokedex", {
                        id: source.pokedexId,
                      })}
                      className="pressable inline-flex items-center rounded-lg border border-frame/40 bg-surface-2 px-2 py-1"
                    >
                      {chip}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center rounded-lg border border-frame/40 bg-surface-2 px-2 py-1">
                      {chip}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-muted">
            A wild mon rolls {WILD_HOLD_RATES.none}% nothing /{" "}
            {WILD_HOLD_RATES.common}% common / {WILD_HOLD_RATES.rare}% rare. Lead
            with Compound Eyes and that becomes{" "}
            {WILD_HOLD_RATES.compoundEyes.none}/
            {WILD_HOLD_RATES.compoundEyes.common}/
            {WILD_HOLD_RATES.compoundEyes.rare}. Thief and Covet take the item
            without a catch.
          </p>
        </div>
      ) : null}

      {pickup ? (
        <p className="text-[11px] leading-snug text-muted">
          Pickup can also turn this up ({holdRateLabel(pickup.rate)} table).
        </p>
      ) : null}
    </section>
  );
}

function holdRateLabel(rate: ItemSource["rate"]): string {
  if (rate === "always") return "always";
  if (rate === "common") return "common";
  return "rare";
}
