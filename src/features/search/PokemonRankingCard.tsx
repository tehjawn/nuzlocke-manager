"use client";

import type { AskPokemonRankingItem } from "@/features/search/ask-types";
import type {
  SearchResult,
  SearchSeasonContext,
} from "@/features/search/search-types";
import { pokemonSpriteUrl } from "@/lib/sprites";

type ResolvedItem = {
  key: string;
  species: string;
  nickname?: string;
  level?: number;
  trainerHandle: string;
  reason?: string;
  pokedexId: number | null;
  shiny: boolean;
  href?: string;
  avatarUrl?: string;
};

function resolveItems(
  items: AskPokemonRankingItem[],
  season: SearchSeasonContext | null,
  results: SearchResult[],
): ResolvedItem[] {
  const trainersByHandle = new Map(
    (season?.trainers ?? []).map((t) => [t.handle.toLowerCase(), t]),
  );

  const pokemonByKey = new Map<string, SearchResult>();
  const trainerByHandle = new Map<string, SearchResult>();
  for (const r of results) {
    if (r.category === "trainer") {
      trainerByHandle.set(r.title.toLowerCase(), r);
      continue;
    }
    if (r.category !== "pokemon") continue;
    const handle = r.subtitle.split("·").at(-1)?.trim().toLowerCase() ?? "";
    const species = r.pokemonSprite?.species.toLowerCase() ?? "";
    const title = r.title.toLowerCase();
    if (handle) {
      pokemonByKey.set(`${handle}:${title}`, r);
      if (species) pokemonByKey.set(`${handle}:${species}`, r);
    }
  }

  const resolved: ResolvedItem[] = [];
  for (const item of items.slice(0, 12)) {
    const species = item.species?.trim();
    const handle = item.trainerHandle?.trim();
    if (!species || !handle) continue;

    const handleLower = handle.toLowerCase();
    const speciesLower = species.toLowerCase();
    const nickLower = item.nickname?.trim().toLowerCase() || "";

    const trainer = trainersByHandle.get(handleLower);
    const mon = trainer?.pokemon.find((p) => {
      if (nickLower && p.nickname?.toLowerCase() === nickLower) return true;
      return p.species.toLowerCase() === speciesLower;
    });

    const pokemonResult =
      (nickLower ? pokemonByKey.get(`${handleLower}:${nickLower}`) : undefined) ??
      pokemonByKey.get(`${handleLower}:${speciesLower}`);
    const trainerResult = trainerByHandle.get(handleLower);
    const href = pokemonResult?.href ?? trainerResult?.href;

    resolved.push({
      key:
        pokemonResult?.id ??
        `${handleLower}:${speciesLower}:${item.level ?? ""}`,
      species: mon?.species ?? species,
      nickname: mon?.nickname ?? item.nickname,
      level: mon?.level ?? item.level,
      trainerHandle: trainer?.handle ?? handle,
      reason: item.reason?.trim() || undefined,
      pokedexId:
        mon?.pokedexId ?? pokemonResult?.pokemonSprite?.pokedexId ?? null,
      shiny: mon?.isShiny ?? pokemonResult?.pokemonSprite?.shiny ?? false,
      href,
      avatarUrl: trainerResult?.imageUrl,
    });
  }

  return resolved;
}

export function PokemonRankingCard({
  items,
  season,
  results,
  onNavigate,
}: {
  items: AskPokemonRankingItem[];
  season: SearchSeasonContext | null;
  results: SearchResult[];
  onNavigate: (href: string) => void;
}) {
  const resolved = resolveItems(items, season, results);
  if (!resolved.length) return null;

  return (
    <ul className="grid grid-cols-2 gap-2">
      {resolved.map((item, index) => {
        const label = item.nickname?.trim() || item.species;
        const className =
          "relative block w-full rounded-lg border border-frame/70 bg-surface px-2 py-2.5 text-left transition-colors";
        const interactive = item.href
          ? "pressable cursor-pointer hover:border-interactive/45 hover:bg-interactive-soft/40"
          : "";

        const inner = (
          <>
            <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-md border border-frame/60 bg-surface px-1 text-[10px] font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="pixelated mx-auto h-12 w-12 object-contain"
              decoding="async"
              height={48}
              loading="lazy"
              src={pokemonSpriteUrl(item.species, {
                pokedexId: item.pokedexId,
                shiny: item.shiny,
              })}
              width={48}
            />
            <span className="mt-1 block truncate text-center text-xs font-semibold tracking-tight text-ink">
              {label}
            </span>
            <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-muted">
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="pixelated h-3.5 w-3.5 object-contain"
                  decoding="async"
                  height={14}
                  src={item.avatarUrl}
                  width={14}
                />
              ) : null}
              <span className="truncate">{item.trainerHandle}</span>
              {typeof item.level === "number" ? (
                <span className="shrink-0 tabular-nums">· Lv{item.level}</span>
              ) : null}
            </span>
            {item.reason ? (
              <span className="mt-0.5 block truncate text-center text-[10px] text-muted/90">
                {item.reason}
              </span>
            ) : null}
          </>
        );

        return (
          <li key={item.key}>
            {item.href ? (
              <button
                type="button"
                onClick={() => onNavigate(item.href!)}
                className={`${className} ${interactive}`}
              >
                {inner}
              </button>
            ) : (
              <div className={className}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
