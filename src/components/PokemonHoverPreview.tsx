"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { TypeBadge } from "@/components/TypeBadge";
import type { PokemonEntry } from "@/lib/challenge-types";
import { pokemonSpriteUrl } from "@/lib/sprites";

type PokemonHoverPreviewProps = {
  pokemon: PokemonEntry;
  children: ReactNode;
  /** Extra classes on the hover trigger wrapper. */
  className?: string;
};

type PreviewPos = { top: number; left: number; above: boolean };

/**
 * Desktop hover glance: larger sprite + nickname / species / level / types.
 * Touch devices keep the child click behavior (no sticky popover).
 */
export function PokemonHoverPreview({
  pokemon,
  children,
  className = "",
}: PokemonHoverPreviewProps) {
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PreviewPos | null>(null);

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
    const width = 176;
    const gap = 8;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const above = rect.top > 200;
    const top = above ? rect.top - gap : rect.bottom + gap;
    setPos({ top, left, above });
  }, []);

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
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  const nickname = pokemon.nickname?.trim() ?? "";
  const label = nickname || pokemon.species;
  const showSpeciesLine =
    Boolean(nickname) &&
    nickname.toLowerCase() !== pokemon.species.toLowerCase();

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
              id={panelId}
              role="tooltip"
              className="pokemon-hover-preview pointer-events-none fixed z-[80] w-44 rounded-lg border border-frame bg-surface p-2.5 shadow-lg"
              style={{
                top: pos.top,
                left: pos.left,
                transform: pos.above ? "translateY(-100%)" : undefined,
              }}
            >
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-frame/50 bg-surface-2">
                  <Image
                    src={pokemonSpriteUrl(pokemon.species, {
                      shiny: pokemon.isShiny,
                      pokedexId: pokemon.pokedexId,
                    })}
                    alt=""
                    width={96}
                    height={96}
                    className="pixelated h-20 w-20 object-contain"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-bold leading-tight tracking-tight">
                    {label}
                    {pokemon.isShiny ? (
                      <span className="ml-1 text-accent-2" title="Shiny">
                        ✦
                      </span>
                    ) : null}
                  </p>
                  {showSpeciesLine ? (
                    <p className="truncate text-[11px] text-muted">
                      {pokemon.species}
                    </p>
                  ) : null}
                  {pokemon.level != null ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-muted">
                      Lv {pokemon.level}
                    </p>
                  ) : null}
                </div>
                {pokemon.types.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-1">
                    {pokemon.types.map((t) => (
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
