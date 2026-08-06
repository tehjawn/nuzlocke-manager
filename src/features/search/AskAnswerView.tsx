"use client";

import { AskSafeMarkdown } from "@/features/search/AskSafeMarkdown";
import { PokemonRankingCard } from "@/features/search/PokemonRankingCard";
import { resolveAskSurfaces } from "@/features/search/ask-surfaces";
import type { AskAnswer } from "@/features/search/ask-types";
import type {
  SearchResult,
  SearchSeasonContext,
} from "@/features/search/search-types";
import type { AssistState } from "@/features/search/use-jump-assist";
import { pokemonSpriteUrl } from "@/lib/sprites";

function ChipIcon({ item }: { item: SearchResult }) {
  if (item.pokemonSprite) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="pixelated h-4 w-4 shrink-0 object-contain"
        decoding="async"
        height={16}
        src={pokemonSpriteUrl(item.pokemonSprite.species, {
          pokedexId: item.pokemonSprite.pokedexId,
          shiny: item.pokemonSprite.shiny,
        })}
        width={16}
      />
    );
  }
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="pixelated h-4 w-4 shrink-0 object-contain"
        decoding="async"
        height={16}
        src={item.imageUrl}
        width={16}
      />
    );
  }
  return null;
}

export function AskAnswerView({
  state,
  related,
  season,
  results,
  onRetry,
  onNavigate,
}: {
  state: AssistState;
  related: SearchResult[];
  season: SearchSeasonContext | null;
  results: SearchResult[];
  onRetry: () => void;
  onNavigate: (target: SearchResult | string) => void;
}) {
  if (state.status === "idle") return null;

  const answer: AskAnswer | null =
    state.status === "answered" ? state.answer : null;

  const chips =
    answer?.kind === "canned"
      ? resolveAskSurfaces(answer.surfaces, results)
      : related;
  const chipLabel = answer?.kind === "canned" ? "Quick links" : "Jump to";
  const disclaimer =
    answer?.kind === "canned"
      ? "Quick links for this app — Ask can also dig into this season’s board."
      : "Generated from this season’s board — double-check anything that matters.";

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-live="polite">
      {state.status === "loading" ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3" role="status">
          <div className="rounded-md border border-frame/60 bg-surface-2/60 px-3 py-3">
            <div className="flex items-center gap-2 text-sm text-muted">
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
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-3 w-[92%] animate-pulse rounded bg-frame/20" />
              <div className="h-3 w-[78%] animate-pulse rounded bg-frame/15" />
              <div className="h-3 w-[64%] animate-pulse rounded bg-frame/10" />
            </div>
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="px-3 pb-3 pt-3">
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
        </div>
      ) : null}

      {state.status === "answered" && answer ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
          <div className="rounded-md border border-frame/60 bg-surface-2/60 px-3 py-2.5 motion-safe:animate-[search-panel-in_180ms_cubic-bezier(0.22,1,0.36,1)]">
            {answer.kind === "canned" || answer.kind === "prose" ? (
              <AskSafeMarkdown content={answer.markdown} />
            ) : null}

            {answer.kind === "pokemon_ranking" ? (
              <div className="flex flex-col gap-3">
                {answer.summaryMarkdown ? (
                  <AskSafeMarkdown content={answer.summaryMarkdown} />
                ) : null}
                <PokemonRankingCard
                  items={answer.items}
                  season={season}
                  results={results}
                  onNavigate={onNavigate}
                />
              </div>
            ) : null}
          </div>

          {chips.length ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {chipLabel}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item)}
                    className="pressable inline-flex max-w-full items-center gap-1.5 rounded-md border border-frame/70 bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-interactive/45"
                    title={item.subtitle || undefined}
                  >
                    <ChipIcon item={item} />
                    <span className="truncate">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] leading-snug text-muted">
            {disclaimer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
