"use client";

import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { PokemonSpriteBrowser } from "@/components/SpriteBrowser";
import { StatSpreadEditor } from "@/components/StatSpreadEditor";
import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";
import { heldItemSpriteUrl, searchHeldItems } from "@/data/pokemon-index";
import {
  searchAbilities,
  searchCatchRoutes,
  searchNatures,
} from "@/data/pokemon-lookups";
import { pokemonSpriteUrl } from "@/lib/sprites";
import {
  clampEvs,
  clampIvs,
  EMPTY_EVS,
  EMPTY_IVS,
  type StatSpread,
} from "@/lib/stats";

export type PokemonFormState = {
  id?: string;
  slot: PokemonSlot;
  partyIndex: number;
  nickname: string;
  species: string;
  pokedexId: number | null;
  isShiny: boolean;
  nature: string;
  level: string;
  ability: string;
  catchRoute: string;
  heldItem: string;
  move1: string;
  move2: string;
  move3: string;
  move4: string;
  ivs: StatSpread;
  evs: StatSpread;
  causeOfDeath: string;
};

export const EMPTY_POKEMON_FORM: PokemonFormState = {
  id: undefined,
  slot: "MAIN",
  partyIndex: 0,
  nickname: "",
  species: "",
  pokedexId: null,
  isShiny: false,
  nature: "",
  level: "",
  ability: "",
  catchRoute: "",
  heldItem: "",
  move1: "",
  move2: "",
  move3: "",
  move4: "",
  ivs: { ...EMPTY_IVS },
  evs: { ...EMPTY_EVS },
  causeOfDeath: "",
};

export function pokemonEntryToForm(mon: PokemonEntry): PokemonFormState {
  return {
    id: mon.id,
    slot: mon.slot,
    partyIndex: mon.partyIndex,
    nickname: mon.nickname ?? "",
    species: mon.species,
    pokedexId: mon.pokedexId,
    isShiny: mon.isShiny,
    nature: mon.nature ?? "",
    level: mon.level != null ? String(mon.level) : "",
    ability: mon.ability ?? "",
    catchRoute: mon.catchRoute ?? "",
    heldItem: mon.heldItem ?? "",
    move1: mon.moves[0] ?? "",
    move2: mon.moves[1] ?? "",
    move3: mon.moves[2] ?? "",
    move4: mon.moves[3] ?? "",
    ivs: clampIvs(mon.ivs ?? undefined),
    evs: clampEvs(mon.evs ?? undefined),
    causeOfDeath: mon.causeOfDeath ?? "",
  };
}

type PokemonFormModalProps = {
  open: boolean;
  initial: PokemonFormState;
  pending?: boolean;
  onClose: () => void;
  onSave: (form: PokemonFormState) => void;
  onDelete?: (pokemonId: string) => void;
};

export function PokemonFormModal({
  open,
  initial,
  pending = false,
  onClose,
  onSave,
  onDelete,
}: PokemonFormModalProps) {
  // Remount when opened so form state is seeded from `initial` without an effect.
  if (!open) return null;
  return (
    <PokemonFormModalInner
      key={initial.id ?? `new-${initial.slot}-${initial.partyIndex}`}
      initial={initial}
      pending={pending}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

function PokemonFormModalInner({
  initial,
  pending = false,
  onClose,
  onSave,
  onDelete,
}: Omit<PokemonFormModalProps, "open">) {
  const [form, setForm] = useState(initial);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState(initial.heldItem);
  const deferredItem = useDeferredValue(itemQuery);
  const itemResults = useMemo(
    () => searchHeldItems(deferredItem, 12),
    [deferredItem],
  );

  return (
    <>
      <Modal
        open
        title={form.id ? "Edit Pokémon" : "Add Pokémon"}
        onClose={onClose}
        wide
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !form.species.trim()}
              className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
              onClick={() => onSave(form)}
            >
              {form.id ? "Save changes" : "Add to board"}
            </button>
            <button
              type="button"
              className="pressable rounded-sm bg-surface px-4 py-2 font-display text-xs font-bold tracking-wide uppercase"
              onClick={onClose}
            >
              Cancel
            </button>
            {form.id && onDelete ? (
              <button
                type="button"
                disabled={pending}
                className="pressable ml-auto rounded-sm bg-danger px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
                onClick={() => {
                  if (!confirm("Delete this Pokémon entry?")) return;
                  onDelete(form.id!);
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center rounded-sm border-2 border-frame bg-surface-2">
              {form.species ? (
                <Image
                  src={pokemonSpriteUrl(form.species, {
                    shiny: form.isShiny,
                    pokedexId: form.pokedexId,
                  })}
                  alt=""
                  width={96}
                  height={96}
                  className="pixelated h-24 w-24 object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-sm text-muted">?</span>
              )}
            </div>
            <button
              type="button"
              className="pressable rounded-sm bg-accent px-3 py-2 text-xs font-bold text-white uppercase"
              onClick={() => setBrowseOpen(true)}
            >
              {form.species ? "Change species" : "Pick species"}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isShiny}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isShiny: e.target.checked }))
                }
              />
              <span className="font-bold">Shiny</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-bold text-muted">Species</span>
              <input
                className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form.species}
                readOnly
                placeholder="Use Pick species…"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-bold text-muted">Nickname</span>
              <input
                className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form.nickname}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nickname: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-bold text-muted">Slot</span>
              <select
                className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form.slot}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    slot: e.target.value as PokemonSlot,
                  }))
                }
              >
                <option value="MAIN">Main Squad</option>
                <option value="RESERVE">Reserves</option>
                <option value="GRAVEYARD">R.I.P.</option>
                <option value="ENCOUNTERED">Encountered</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-bold text-muted">Party index</span>
              <input
                type="number"
                min={0}
                max={11}
                className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form.partyIndex}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    partyIndex: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-bold text-muted">Level</span>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form.level}
                onChange={(e) =>
                  setForm((f) => ({ ...f, level: e.target.value }))
                }
              />
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-bold text-muted">Nature</span>
              <SearchSelect
                value={form.nature}
                onChange={(nature) => setForm((f) => ({ ...f, nature }))}
                search={searchNatures}
                placeholder="Search Hardy, Jolly…"
              />
            </div>
            <div className="text-sm">
              <span className="mb-1 block font-bold text-muted">Ability</span>
              <SearchSelect
                value={form.ability}
                onChange={(ability) => setForm((f) => ({ ...f, ability }))}
                search={searchAbilities}
                placeholder="Search Static, Blaze…"
              />
            </div>
            <div className="text-sm">
              <span className="mb-1 block font-bold text-muted">Catch route</span>
              <SearchSelect
                value={form.catchRoute}
                onChange={(catchRoute) =>
                  setForm((f) => ({ ...f, catchRoute }))
                }
                search={searchCatchRoutes}
                placeholder="Search Route 104…"
              />
            </div>
            <div className="text-sm sm:col-span-2">
              <span className="mb-1 block font-bold text-muted">Held item</span>
              <div className="flex items-center gap-2">
                {form.heldItem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heldItemSpriteUrl(form.heldItem)}
                    alt=""
                    width={32}
                    height={32}
                    className="pixelated h-8 w-8 object-contain"
                  />
                ) : null}
                <input
                  className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                  value={itemQuery}
                  placeholder="Search leftovers, life orb…"
                  onChange={(e) => {
                    setItemQuery(e.target.value);
                    setForm((f) => ({ ...f, heldItem: e.target.value }));
                  }}
                />
                {form.heldItem ? (
                  <button
                    type="button"
                    className="pressable shrink-0 rounded-sm bg-surface px-2 py-2 text-xs font-bold uppercase"
                    onClick={() => {
                      setItemQuery("");
                      setForm((f) => ({ ...f, heldItem: "" }));
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {itemResults.length > 0 && itemQuery.trim() ? (
                <ul className="mt-2 max-h-36 overflow-auto rounded-sm border-2 border-frame bg-surface">
                  {itemResults.map((item) => (
                    <li key={item.slug}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent/15"
                        onClick={() => {
                          setItemQuery(item.name);
                          setForm((f) => ({ ...f, heldItem: item.name }));
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={heldItemSpriteUrl(item.slug)}
                          alt=""
                          width={24}
                          height={24}
                          className="pixelated h-6 w-6 object-contain"
                        />
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {(["move1", "move2", "move3", "move4"] as const).map((key, i) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block font-bold text-muted">
                  Move {i + 1}
                </span>
                <input
                  className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
            <StatSpreadEditor
              label="IVs"
              value={form.ivs}
              max={31}
              onChange={(ivs) => setForm((f) => ({ ...f, ivs }))}
            />
            <StatSpreadEditor
              label="EVs"
              value={form.evs}
              max={255}
              onChange={(evs) => setForm((f) => ({ ...f, evs }))}
            />
            {form.slot === "GRAVEYARD" ? (
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-bold text-muted">
                  Cause of death
                </span>
                <textarea
                  className="min-h-16 w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                  value={form.causeOfDeath}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, causeOfDeath: e.target.value }))
                  }
                />
              </label>
            ) : null}
          </div>
        </div>
      </Modal>

      <PokemonSpriteBrowser
        open={browseOpen}
        selectedId={form.pokedexId}
        onClose={() => setBrowseOpen(false)}
        onSelect={(entry) => {
          setForm((f) => ({
            ...f,
            species: entry.name,
            pokedexId: entry.pokedexId,
            nickname: f.nickname || entry.name,
          }));
        }}
      />
    </>
  );
}
