"use client";

import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
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
import { pokemonSpriteUrl, trainerSpriteUrl } from "@/lib/sprites";

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
  const results = useMemo(
    () => searchTrainerSprites(deferred, deferred.trim() ? 300 : 120),
    [deferred],
  );
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
              className="pressable rounded-sm bg-surface px-3 py-2 text-xs font-bold uppercase"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pressable rounded-sm bg-accent px-3 py-2 text-xs font-bold text-white uppercase"
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
          className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          placeholder="brendan, may, roxanne…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="mb-2 text-xs text-muted">
        Showing {results.length}
        {deferred.trim() ? " matches" : " (type to search the full catalog)"}
      </p>
      <div className="grid max-h-[50vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
        {results.map((key) => {
          const selected = draft === key;
          return (
            <button
              key={key}
              type="button"
              title={formatTrainerSpriteLabel(key)}
              aria-pressed={selected}
              className={`flex flex-col items-center gap-1 rounded-sm border-2 p-1.5 ${
                selected
                  ? "border-accent bg-accent/15"
                  : "border-frame bg-surface-2 hover:bg-accent/10"
              }`}
              onClick={() => setDraft(key)}
              onDoubleClick={() => {
                onSelect(key);
                onClose();
              }}
            >
              <Image
                src={trainerSpriteUrl(key)}
                alt=""
                width={40}
                height={40}
                className="pixelated h-10 w-10 object-contain"
                unoptimized
                loading="lazy"
              />
              <span className="w-full truncate text-[9px] font-bold text-muted">
                {key}
              </span>
            </button>
          );
        })}
      </div>
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
  const deferred = useDeferredValue(query);
  const results = useMemo(
    () =>
      searchPokemonIndex(deferred, {
        generation,
        limit: deferred.trim() ? 160 : 80,
      }),
    [deferred, generation],
  );
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
              className="pressable rounded-sm bg-surface px-3 py-2 text-xs font-bold uppercase"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!draft}
              className="pressable rounded-sm bg-accent px-3 py-2 text-xs font-bold text-white uppercase disabled:opacity-60"
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
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`pressable rounded-sm px-2.5 py-1.5 text-[11px] font-bold uppercase ${
            generation == null
              ? "bg-accent text-white"
              : "border-2 border-frame bg-surface"
          }`}
          onClick={() => setGeneration(null)}
        >
          All
        </button>
        {POKEMON_GENERATIONS.map((g) => (
          <button
            key={g}
            type="button"
            className={`pressable rounded-sm px-2.5 py-1.5 text-[11px] font-bold uppercase ${
              generation === g
                ? "bg-accent text-white"
                : "border-2 border-frame bg-surface"
            }`}
            onClick={() => setGeneration(g)}
          >
            Gen {g}
          </button>
        ))}
      </div>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-bold text-muted">
          Search National Dex
        </span>
        <input
          autoFocus
          className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          placeholder="Name or Pokédex #"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="mb-2 text-xs text-muted">
        Showing {results.length}
        {generation != null ? ` in Gen ${generation}` : ""}
        {deferred.trim() ? " matches" : ""}
      </p>
      <div className="grid max-h-[45vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
        {results.map((mon) => {
          const selectedRow = draft?.pokedexId === mon.pokedexId;
          return (
            <button
              key={mon.pokedexId}
              type="button"
              title={`#${mon.pokedexId} ${mon.name}`}
              aria-pressed={selectedRow}
              className={`flex flex-col items-center gap-1 rounded-sm border-2 p-1.5 ${
                selectedRow
                  ? "border-accent bg-accent/15"
                  : "border-frame bg-surface-2 hover:bg-accent/10"
              }`}
              onClick={() => setDraft(mon)}
              onDoubleClick={() => {
                onSelect(mon);
                onClose();
              }}
            >
              <Image
                src={pokemonSpriteUrl(mon.name, { pokedexId: mon.pokedexId })}
                alt=""
                width={40}
                height={40}
                className="pixelated h-10 w-10 object-contain"
                unoptimized
                loading="lazy"
              />
              <span className="w-full truncate text-[9px] font-bold text-muted">
                {mon.name}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
