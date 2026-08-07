"use client";

import { HeldItemLabel } from "@/components/HeldItemLabel";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { itemDexSlug } from "@/data/item-links";
import {
  evolutionViewFor,
  type EvolutionConditionChip,
  type EvolutionOption,
  type EvolutionView,
} from "@/lib/species-evolutions";
import { toolsHref } from "@/lib/tools-routes";

type EvolutionPathProps = {
  pokedexId: number;
  species: string;
  level?: number | null;
  heldItem?: string | null;
  moves?: string[] | null;
  shiny?: boolean;
  /** Caption under the highlighted stage. Defaults to "You" (specimen modal). */
  currentLabel?: string;
  /**
   * Season slug. When set, item condition chips link to their ItemDex entry —
   * "needs a Spell Tag" is only half an answer without "and here's where one is".
   */
  slug?: string | null;
  /** When set, non-current stages navigate (e.g. Pokédex browse). */
  onSelectSpecies?: (pokedexId: number) => void;
};

/** ItemDex deep link, or null when the catalog doesn't know the item. */
function itemHref(
  slug: string | null | undefined,
  name: string,
): string | null {
  if (!slug) return null;
  const item = itemDexSlug(name);
  if (!item) return null;
  return toolsHref(slug, "itemdex", { item });
}

function ConditionChip({
  chip,
  slug,
}: {
  chip: EvolutionConditionChip;
  slug?: string | null;
}) {
  if (chip.kind === "hold" && chip.label.startsWith("Hold ")) {
    const name = chip.label.slice(5);
    const href = itemHref(slug, name);
    return (
      <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-frame/40 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink">
        <span className="text-muted">Hold</span>
        {/* Unlinked chips stay `embedded` so they keep the flat chip look
            rather than growing the InfoTip's own button chrome. */}
        <HeldItemLabel name={name} href={href} embedded={!href} iconSize={12} />
      </span>
    );
  }

  if (chip.kind === "item" || chip.kind === "hold") {
    const href = itemHref(slug, chip.label);
    return (
      <span className="inline-flex max-w-full items-center rounded-md border border-frame/40 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink">
        <HeldItemLabel
          name={chip.label}
          href={href}
          embedded={!href}
          iconSize={12}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-frame/40 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink">
      {chip.label}
    </span>
  );
}

function ReadinessBadge({ option }: { option: EvolutionOption }) {
  const { status, detail } = option.readiness;
  if (!detail) return null;
  const tone =
    status === "ready"
      ? "text-accent-deep"
      : status === "close"
        ? "text-accent-2-ink"
        : status === "blocked"
          ? "text-muted"
          : "text-muted";
  return (
    <span className={`text-[10px] font-semibold tracking-tight ${tone}`}>
      {detail}
    </span>
  );
}

function StageSprite({
  pokedexId,
  species,
  shiny = false,
  current = false,
  size = 40,
  onSelect,
}: {
  pokedexId: number;
  species: string;
  shiny?: boolean;
  current?: boolean;
  size?: number;
  onSelect?: (pokedexId: number) => void;
}) {
  const inner = (
    <PokemonSpriteImage
      alt=""
      className="pixelated object-contain"
      height={size}
      pokedexId={pokedexId}
      shiny={shiny}
      species={species}
      width={size}
    />
  );
  const shellClass = `flex shrink-0 items-center justify-center rounded-lg border ${
    current ? "border-accent-2/60 bg-info" : "border-frame/40 bg-surface-2"
  }`;
  const shellStyle = { width: size + 8, height: size + 8 };

  if (onSelect && !current) {
    return (
      <button
        type="button"
        className={`pressable ${shellClass} hover:border-interactive/50`}
        style={shellStyle}
        title={`Open ${species}`}
        aria-label={`Open ${species} in Pokédex`}
        onClick={() => onSelect(pokedexId)}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={shellClass} style={shellStyle} title={species}>
      {inner}
    </div>
  );
}

function LinearChain({
  view,
  species,
  shiny,
  currentLabel,
  slug,
  onSelectSpecies,
}: {
  view: EvolutionView;
  species: string;
  shiny: boolean;
  currentLabel: string;
  slug?: string | null;
  onSelectSpecies?: (pokedexId: number) => void;
}) {
  const steps = view.forward;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {view.ancestors.map((a) => (
        <div key={a.pokedexId} className="flex items-center gap-2 opacity-60">
          <StageSprite
            pokedexId={a.pokedexId}
            species={a.name}
            size={32}
            onSelect={onSelectSpecies}
          />
          <span className="text-muted" aria-hidden>
            →
          </span>
        </div>
      ))}
      <div className="flex flex-col items-center gap-0.5">
        <StageSprite
          pokedexId={view.pokedexId}
          species={species}
          shiny={shiny}
          current
          size={40}
        />
        <span className="text-[9px] font-semibold tracking-tight text-accent-2-ink">
          {currentLabel}
        </span>
      </div>
      {steps.map((step) => (
        <div key={`${step.method}-${step.into}`} className="contents">
          <span className="text-muted" aria-hidden>
            →
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap gap-1">
              {step.chips.map((chip) => (
                <ConditionChip
                  key={`${step.into}-${chip.kind}-${chip.label}`}
                  chip={chip}
                  slug={slug}
                />
              ))}
            </div>
            <ReadinessBadge option={step} />
          </div>
          <span className="text-muted" aria-hidden>
            →
          </span>
          <div className="flex flex-col items-center gap-0.5">
            <StageSprite
              pokedexId={step.into}
              species={step.intoName}
              size={40}
              onSelect={onSelectSpecies}
            />
            <span className="max-w-[4.5rem] truncate text-center text-[10px] font-semibold">
              {step.intoName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BranchOptions({
  view,
  species,
  shiny,
  currentLabel,
  slug,
  onSelectSpecies,
}: {
  view: EvolutionView;
  species: string;
  shiny: boolean;
  currentLabel: string;
  slug?: string | null;
  onSelectSpecies?: (pokedexId: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {view.ancestors.map((a) => (
          <div key={a.pokedexId} className="flex items-center gap-2 opacity-60">
            <StageSprite
              pokedexId={a.pokedexId}
              species={a.name}
              size={28}
              onSelect={onSelectSpecies}
            />
            <span className="text-muted" aria-hidden>
              →
            </span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-0.5">
          <StageSprite
            pokedexId={view.pokedexId}
            species={species}
            shiny={shiny}
            current
            size={36}
          />
          <span className="text-[9px] font-semibold tracking-tight text-accent-2-ink">
            {currentLabel}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-muted">→ choose</span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {view.options.map((option) => (
          <li
            key={`${option.method}-${option.into}`}
            className="flex min-w-0 items-start gap-2 rounded-lg border border-frame/40 bg-surface-2 px-2 py-1.5"
          >
            <StageSprite
              pokedexId={option.into}
              species={option.intoName}
              size={36}
              onSelect={onSelectSpecies}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="truncate text-sm font-semibold leading-tight">
                  {option.intoName}
                </p>
                <ReadinessBadge option={option} />
              </div>
              <div className="flex flex-wrap gap-1">
                {option.chips.map((chip) => (
                  <ConditionChip
                    key={`${option.into}-${chip.kind}-${chip.label}`}
                    chip={chip}
                    slug={slug}
                  />
                ))}
              </div>
              {option.note && (
                <p className="text-[10px] leading-snug text-muted">
                  {option.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinalForm({
  view,
  species,
  shiny,
  currentLabel,
  onSelectSpecies,
}: {
  view: EvolutionView;
  species: string;
  shiny: boolean;
  currentLabel: string;
  onSelectSpecies?: (pokedexId: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {view.ancestors.map((a) => (
        <div key={a.pokedexId} className="flex items-center gap-2 opacity-60">
          <StageSprite
            pokedexId={a.pokedexId}
            species={a.name}
            size={32}
            onSelect={onSelectSpecies}
          />
          <span className="text-muted" aria-hidden>
            →
          </span>
        </div>
      ))}
      <div className="flex flex-col items-center gap-0.5">
        <StageSprite
          pokedexId={view.pokedexId}
          species={species}
          shiny={shiny}
          current
          size={40}
        />
        <span className="text-[9px] font-semibold tracking-tight text-accent-2-ink">
          {currentLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Modern Emerald evolution path for the open specimen.
 * Linear lines use a compact chain; branched lines show peer option rows.
 */
export function EvolutionPath({
  pokedexId,
  species,
  level,
  heldItem,
  moves,
  shiny = false,
  currentLabel = "You",
  slug = null,
  onSelectSpecies,
}: EvolutionPathProps) {
  const view = evolutionViewFor(pokedexId, { level, heldItem, moves });
  if (!view) return null;

  const branched = view.options.length > 1;
  const linear = view.options.length === 1;
  const resolvedCurrentLabel = view.isFinal ? "Final" : currentLabel;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-tight text-muted">
          Evolution
        </p>
        <p className="text-[10px] text-muted">Modern Emerald</p>
      </div>
      {view.isFinal ? (
        <FinalForm
          view={view}
          species={species}
          shiny={shiny}
          currentLabel={resolvedCurrentLabel}
          onSelectSpecies={onSelectSpecies}
        />
      ) : branched ? (
        <BranchOptions
          view={view}
          species={species}
          shiny={shiny}
          currentLabel={resolvedCurrentLabel}
          slug={slug}
          onSelectSpecies={onSelectSpecies}
        />
      ) : linear ? (
        <LinearChain
          view={view}
          species={species}
          shiny={shiny}
          currentLabel={resolvedCurrentLabel}
          slug={slug}
          onSelectSpecies={onSelectSpecies}
        />
      ) : null}
      {!branched && view.options[0]?.note && (
        <p className="mt-1.5 text-[10px] leading-snug text-muted">
          {view.options[0].note}
        </p>
      )}
    </div>
  );
}
