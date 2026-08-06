"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BondHeart } from "@/components/BondHeart";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  SurvivalSentimentCaption,
  SurvivalSentimentIcon,
} from "@/components/SurvivalPollChip";
import { TypeBadge } from "@/components/TypeBadge";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  catchTierHasChrome,
  catchTierLabel,
  catchTierToneClass,
  type CatchTier,
} from "@/lib/iv-quality";
import {
  resolveCatchTier,
  resolveTrainingTier,
} from "@/lib/pokemon-grades";
import type { PokemonType } from "@/lib/pokemon-types";
import { typesForPokedexId } from "@/lib/resolve-pokemon-types";
import type { SurvivalPollTally } from "@/lib/survival-market-types";
import {
  trainingTierLabel,
  trainingTierToneClass,
  type TrainingTier,
} from "@/lib/training-quality";

type SpeciesPreview = {
  species: string;
  pokedexId: number | null;
  /** Extra muted line under the name (e.g. "Not owned yet" / "Comp S"). */
  subtitle?: string;
  /** Longer wrap text under the subtitle (e.g. competitive placement reason). */
  detail?: string;
};

type PokemonHoverPreviewProps = {
  children: ReactNode;
  /** Extra classes on the hover trigger wrapper. */
  className?: string;
} & (
  | { pokemon: PokemonEntry; speciesPreview?: never }
  | { speciesPreview: SpeciesPreview; pokemon?: never }
);

type PreviewPos = { top: number; left: number };

type HoverModel = {
  species: string;
  pokedexId: number | null;
  nickname: string | null;
  level: number | null;
  isShiny: boolean;
  types: PokemonType[];
  subtitle: string | null;
  detail: string | null;
  catchTier: CatchTier | null;
  trainingTier: TrainingTier | null;
  survivalPoll: SurvivalPollTally | null;
};

function modelFromPokemon(pokemon: PokemonEntry): HoverModel {
  return {
    species: pokemon.species,
    pokedexId: pokemon.pokedexId,
    nickname: pokemon.nickname,
    level: pokemon.level,
    isShiny: pokemon.isShiny,
    types: pokemon.types,
    subtitle: null,
    detail: null,
    catchTier: resolveCatchTier(pokemon),
    trainingTier: resolveTrainingTier(pokemon),
    survivalPoll: pokemon.survivalPoll ?? null,
  };
}

function modelFromSpecies(preview: SpeciesPreview): HoverModel {
  const types =
    preview.pokedexId != null && preview.pokedexId > 0
      ? typesForPokedexId(preview.pokedexId)
      : [];
  return {
    species: preview.species,
    pokedexId: preview.pokedexId,
    nickname: null,
    level: null,
    isShiny: false,
    types,
    subtitle: preview.subtitle?.trim() || null,
    detail: preview.detail?.trim() || null,
    catchTier: null,
    trainingTier: null,
    survivalPoll: null,
  };
}

/**
 * Desktop hover glance: larger sprite + nickname / species / level / types.
 * Live board entries also surface public catch / bond / Survive-Die grades.
 * Touch devices keep the child click behavior (no sticky popover).
 *
 * Accepts a live board `pokemon` entry, or a catalog `speciesPreview` (e.g.
 * unowned species in Pokémon Ownership — popup always renders full-color
 * sprites).
 */
export function PokemonHoverPreview(props: PokemonHoverPreviewProps) {
  const { children, className = "" } = props;
  const model =
    "pokemon" in props && props.pokemon
      ? modelFromPokemon(props.pokemon)
      : modelFromSpecies(props.speciesPreview!);

  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PreviewPos | null>(null);

  const catchLabel =
    model.catchTier !== null ? catchTierLabel(model.catchTier) : null;
  const bondLabel =
    model.trainingTier !== null
      ? trainingTierLabel(model.trainingTier)
      : null;
  const hasCatchChrome =
    model.catchTier !== null && catchTierHasChrome(model.catchTier);
  const showSurvival =
    model.survivalPoll != null && model.survivalPoll.total > 0;
  const hasGradeLines =
    Boolean(catchLabel) ||
    (model.trainingTier !== null && Boolean(bondLabel)) ||
    showSurvival;
  // Grades need a bit more width than the plain species glance.
  const widePanel = Boolean(model.detail) || hasGradeLines;

  const clearTimers = useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Wider when a placement reason / grade stack needs room.
    const width = widePanel ? 240 : 176;
    const gap = 8;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    // Provisional — useLayoutEffect measures the panel and flips/clamps.
    setPos({ top: rect.bottom + gap, left });
  }, [widePanel]);

  const scheduleShow = useCallback(() => {
    // Touch / coarse pointers keep click→details; no sticky popover.
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }
    clearTimers();
    showTimer.current = setTimeout(() => {
      place();
      setOpen(true);
      showTimer.current = null;
    }, 180);
  }, [clearTimers, place]);

  const scheduleHide = useCallback(() => {
    clearTimers();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      hideTimer.current = null;
    }, 80);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      setOpen(false);
    }
    function onResize() {
      place();
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, place]);

  // Comp-tier detail / grade stack makes the panel tall; a fixed "flip above
  // at 200px" heuristic clips under the viewport (and modal chrome) on early
  // list rows.
  useLayoutEffect(() => {
    if (!open || !pos) return;
    const panel = panelRef.current;
    const el = wrapRef.current;
    if (!panel || !el) return;
    const rect = el.getBoundingClientRect();
    const height = panel.offsetHeight;
    const gap = 8;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const preferAbove = spaceBelow < height && spaceAbove >= spaceBelow;
    let top = preferAbove ? rect.top - gap - height : rect.bottom + gap;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    if (top === pos.top) return;
    setPos({ top, left: pos.left });
  }, [open, pos]);

  const nickname = model.nickname?.trim() ?? "";
  const label = nickname || model.species;
  const showSpeciesLine =
    Boolean(nickname) &&
    nickname.toLowerCase() !== model.species.toLowerCase();
  const dexLine =
    model.pokedexId != null && model.pokedexId > 0
      ? `#${String(model.pokedexId).padStart(3, "0")}`
      : null;

  return (
    <div
      ref={wrapRef}
      className={`pokemon-hover-anchor relative ${className}`}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
      onFocus={scheduleShow}
      onBlur={scheduleHide}
    >
      {children}
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="tooltip"
              className={`pokemon-hover-preview pointer-events-none fixed z-[110] rounded-lg border border-frame bg-surface p-2.5 shadow-lg ${
                widePanel ? "w-60" : "w-44"
              }`}
              style={{
                top: pos.top,
                left: pos.left,
              }}
            >
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div
                  className={
                    hasCatchChrome
                      ? `pokemon-catch-ring pokemon-catch-ring--${model.catchTier}`
                      : undefined
                  }
                >
                  <div
                    className={`relative flex h-24 w-24 items-center justify-center rounded-lg border ${
                      hasCatchChrome
                        ? `pokemon-catch-sprite pokemon-catch-sprite--${model.catchTier}`
                        : "border-frame/50 bg-surface-2"
                    }`}
                  >
                    <PokemonSpriteImage
                      alt=""
                      className="pixelated h-20 w-20 object-contain"
                      height={96}
                      pokedexId={model.pokedexId}
                      shiny={model.isShiny}
                      species={model.species}
                      width={96}
                    />
                    {showSurvival && model.survivalPoll ? (
                      <SurvivalSentimentIcon
                        className="pokemon-survival-sentiment--corner h-3.5 w-3.5"
                        poll={model.survivalPoll}
                      />
                    ) : null}
                    {model.trainingTier !== null ? (
                      <BondHeart
                        className="pokemon-bond-heart--corner h-3.5 w-3.5"
                        tier={model.trainingTier}
                      />
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-bold leading-tight tracking-tight">
                    {label}
                    {model.isShiny ? (
                      <span className="ml-1 text-accent-2" title="Shiny">
                        ✦
                      </span>
                    ) : null}
                  </p>
                  {showSpeciesLine ? (
                    <p className="truncate text-[11px] text-muted">
                      {model.species}
                    </p>
                  ) : null}
                  {model.level != null ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-muted">
                      Lv {model.level}
                    </p>
                  ) : null}
                  {model.subtitle ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-muted">
                      {model.subtitle}
                      {dexLine && !model.detail ? ` · ${dexLine}` : ""}
                    </p>
                  ) : dexLine && !showSpeciesLine && model.level == null ? (
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                      {dexLine}
                    </p>
                  ) : null}
                  {model.detail ? (
                    <p className="mt-1 text-left text-[11px] leading-snug text-muted">
                      {model.detail}
                    </p>
                  ) : null}
                  {hasGradeLines ? (
                    <div className="mt-1.5 flex flex-col items-center gap-0.5">
                      {model.catchTier !== null && catchLabel ? (
                        <p
                          className={`text-[11px] font-semibold tracking-tight ${catchTierToneClass(model.catchTier)}`}
                        >
                          {catchLabel}
                        </p>
                      ) : null}
                      {model.trainingTier !== null && bondLabel ? (
                        <p
                          className={`text-[11px] font-semibold tracking-tight ${trainingTierToneClass(model.trainingTier)}`}
                        >
                          {bondLabel}
                        </p>
                      ) : null}
                      {showSurvival && model.survivalPoll ? (
                        <SurvivalSentimentCaption
                          className="text-[11px] font-semibold tracking-tight"
                          iconClassName="h-3 w-3"
                          poll={model.survivalPoll}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {model.types.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-1">
                    {model.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
