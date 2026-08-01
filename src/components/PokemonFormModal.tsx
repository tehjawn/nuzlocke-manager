"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { SearchSelect } from "@/components/SearchSelect";
import { PokemonSpriteBrowser } from "@/components/SpriteBrowser";
import { StatSpreadEditor } from "@/components/StatSpreadEditor";
import { TypeBadge } from "@/components/TypeBadge";
import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";
import { heldItemSpriteUrl, searchHeldItems } from "@/data/pokemon-index";
import {
  searchAbilities,
  searchCatchRoutes,
  searchNatures,
} from "@/data/pokemon-lookups";
import { resolveMoveName } from "@/lib/move-names";
import {
  findDuplicateHeldItems,
  findDuplicateSpecies,
} from "@/lib/board-warnings";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import {
  clampEvs,
  clampIvs,
  EMPTY_EVS,
  EMPTY_IVS,
  isEmptySpread,
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

const LABEL =
  "mb-1 block text-[10px] font-semibold tracking-tight text-muted";
const INPUT =
  "w-full rounded-lg border border-frame bg-surface px-2.5 py-1.5 text-sm";

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
    move1: resolveMoveName(mon.moves[0] ?? ""),
    move2: resolveMoveName(mon.moves[1] ?? ""),
    move3: resolveMoveName(mon.moves[2] ?? ""),
    move4: resolveMoveName(mon.moves[3] ?? ""),
    ivs: clampIvs(mon.ivs ?? undefined),
    evs: clampEvs(mon.evs ?? undefined),
    causeOfDeath: mon.causeOfDeath ?? "",
  };
}

/** Draft form → entry shape for the read-only details preview. */
export function pokemonFormToEntry(form: PokemonFormState): PokemonEntry {
  const levelNum = form.level.trim() ? Number(form.level) : NaN;
  const moves = [form.move1, form.move2, form.move3, form.move4]
    .map((m) => m.trim())
    .filter(Boolean);

  const species = form.species.trim() || "Unknown";
  return {
    id: form.id ?? "draft",
    slot: form.slot,
    partyIndex: form.partyIndex,
    nickname: form.nickname.trim() || null,
    species,
    pokedexId: form.pokedexId,
    isShiny: form.isShiny,
    types: resolvePokemonTypes({
      pokedexId: form.pokedexId,
      species,
    }),
    nature: form.nature.trim() || null,
    level: Number.isFinite(levelNum) ? levelNum : null,
    ability: form.ability.trim() || null,
    catchRoute: form.catchRoute.trim() || null,
    heldItem: form.heldItem.trim() || null,
    moves,
    ivs: isEmptySpread(form.ivs) ? null : form.ivs,
    evs: isEmptySpread(form.evs) ? null : form.evs,
    causeOfDeath: form.causeOfDeath.trim() || null,
    diedOnRun: null,
  };
}

type PokemonFormModalProps = {
  open: boolean;
  initial: PokemonFormState;
  /** Board roster used for soft dupe / held-item warnings. */
  teamPokemon?: PokemonEntry[];
  pending?: boolean;
  onClose: () => void;
  onSave: (form: PokemonFormState) => void;
  onDelete?: (pokemonId: string) => void;
  /** Switch to read-only details using the current draft. */
  onPreview?: (form: PokemonFormState) => void;
};

export function PokemonFormModal({
  open,
  initial,
  teamPokemon = [],
  pending = false,
  onClose,
  onSave,
  onDelete,
  onPreview,
}: PokemonFormModalProps) {
  // Remount when opened so form state is seeded from `initial` without an effect.
  if (!open) return null;
  return (
    <PokemonFormModalInner
      key={initial.id ?? `new-${initial.slot}-${initial.partyIndex}`}
      initial={initial}
      teamPokemon={teamPokemon}
      pending={pending}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      onPreview={onPreview}
    />
  );
}

function PokemonFormModalInner({
  initial,
  teamPokemon = [],
  pending = false,
  onClose,
  onSave,
  onDelete,
  onPreview,
}: Omit<PokemonFormModalProps, "open">) {
  const [form, setForm] = useState(initial);
  const [browseOpen, setBrowseOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [itemQuery, setItemQuery] = useState(initial.heldItem);
  const deferredItem = useDeferredValue(itemQuery);
  const itemResults = useMemo(
    () => searchHeldItems(deferredItem, 12),
    [deferredItem],
  );
  const itemWarnings = useMemo(
    () =>
      findDuplicateHeldItems(teamPokemon, {
        excludeId: form.id,
        draftItem: form.heldItem,
      }),
    [teamPokemon, form.id, form.heldItem],
  );
  const speciesWarnings = useMemo(
    () =>
      findDuplicateSpecies(teamPokemon, {
        excludeId: form.id,
        draftSpecies: form.species,
      }),
    [teamPokemon, form.id, form.species],
  );

  const nickname = form.nickname.trim();
  const species = form.species.trim();
  const title = nickname || species || (form.id ? "Edit Pokémon" : "Add Pokémon");
  const types = resolvePokemonTypes({
    pokedexId: form.pokedexId,
    species: species || null,
  });

  const subtitleParts: string[] = [];
  if (form.id) subtitleParts.push("Editing");
  else subtitleParts.push("New");
  if (nickname && species) subtitleParts.push(species);
  if (form.level.trim()) subtitleParts.push(`Lv ${form.level.trim()}`);
  const subtitleText = subtitleParts.join(" · ");

  return (
    <>
      <Modal
        open
        title={title}
        subtitle={
          <>
            {subtitleText}
            {form.isShiny ? (
              <span className="ml-1.5 font-semibold text-accent-2">
                Shiny ✦
              </span>
            ) : null}
          </>
        }
        onClose={onClose}
        size="md"
        headerActions={
          onPreview && species ? (
            <button
              type="button"
              className="pressable border-frame bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
              onClick={() => onPreview(form)}
            >
              Preview
            </button>
          ) : null
        }
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !species}
              className="pressable rounded-lg bg-accent px-4 py-2 text-xs font-semibold tracking-tight text-[var(--on-accent)] disabled:opacity-60"
              onClick={() => onSave(form)}
            >
              {form.id ? "Save changes" : "Add to board"}
            </button>
            <button
              type="button"
              className="pressable rounded-lg border border-frame bg-surface px-4 py-2 text-xs font-semibold tracking-tight"
              onClick={onClose}
            >
              Cancel
            </button>
            {form.id && onDelete ? (
              <button
                type="button"
                disabled={pending}
                className="pressable ml-auto rounded-lg bg-danger px-4 py-2 text-xs font-semibold tracking-tight text-white disabled:opacity-60"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this Pokémon?",
                    description:
                      "Removes it from your board. You can add it again later if needed.",
                    confirmLabel: "Delete",
                    tone: "danger",
                  });
                  if (!ok) return;
                  onDelete(form.id!);
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        }
      >
        {confirmDialog}
        <div className="space-y-4">
          {(itemWarnings.length > 0 || speciesWarnings.length > 0) && (
            <div className="space-y-1.5 rounded-lg border border-accent-2/40 bg-accent-2/10 px-3 py-2 text-sm">
              {itemWarnings.map((w) => (
                <p key={`item-${w.item}`}>
                  <span className="font-semibold text-accent-ink">
                    Duplicate held item:
                  </span>{" "}
                  <span className="text-muted">
                    {w.item} already on{" "}
                    {w.holders.map((h) => h.label).join(", ")}.
                  </span>
                </p>
              ))}
              {speciesWarnings.map((w) => (
                <p key={`sp-${w.species}`}>
                  <span className="font-semibold text-accent-ink">
                    Species already on board:
                  </span>{" "}
                  <span className="text-muted">
                    {w.species} ({w.holders.map((h) => h.label).join(", ")}).
                  </span>
                </p>
              ))}
              <p className="text-[11px] text-muted">
                Soft warning only — you can still save.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start">
            {/* Identity rail — mirrors details modal */}
            <div className="flex flex-col items-center gap-2 sm:items-stretch">
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-lg border border-frame bg-surface-2 sm:mx-0 sm:aspect-square sm:h-auto sm:w-full">
                {species ? (
                  <PokemonSpriteImage
                    alt=""
                    className="pixelated h-28 w-28 object-contain sm:h-[85%] sm:w-[85%]"
                    height={144}
                    pokedexId={form.pokedexId}
                    shiny={form.isShiny}
                    species={species}
                    width={144}
                  />
                ) : (
                  <span className="text-sm text-muted">?</span>
                )}
              </div>

              {types.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                  {types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                className="pressable w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)]"
                onClick={() => setBrowseOpen(true)}
              >
                {species ? "Change species" : "Pick species"}
              </button>

              <label className="flex items-center justify-center gap-2 text-sm sm:justify-start">
                <input
                  type="checkbox"
                  checked={form.isShiny}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isShiny: e.target.checked }))
                  }
                />
                <span className="font-semibold">Shiny</span>
              </label>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="col-span-2 text-sm sm:col-span-1">
                  <span className={LABEL}>Nickname</span>
                  <input
                    className={INPUT}
                    value={form.nickname}
                    placeholder={species || "Nickname"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nickname: e.target.value }))
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className={LABEL}>Level</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className={INPUT}
                    value={form.level}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, level: e.target.value }))
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className={LABEL}>Slot</span>
                  <select
                    className={INPUT}
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
                  <span className={LABEL}>Party index</span>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    className={INPUT}
                    value={form.partyIndex}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        partyIndex: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="text-sm">
                  <span className={LABEL}>Nature</span>
                  <SearchSelect
                    value={form.nature}
                    onChange={(nature) => setForm((f) => ({ ...f, nature }))}
                    search={searchNatures}
                    placeholder="Hardy, Jolly…"
                  />
                </div>
                <div className="text-sm">
                  <span className={LABEL}>Ability</span>
                  <SearchSelect
                    value={form.ability}
                    onChange={(ability) => setForm((f) => ({ ...f, ability }))}
                    search={searchAbilities}
                    placeholder="Static, Blaze…"
                  />
                </div>
                <div className="text-sm">
                  <span className={LABEL}>Catch route</span>
                  <SearchSelect
                    value={form.catchRoute}
                    onChange={(catchRoute) =>
                      setForm((f) => ({ ...f, catchRoute }))
                    }
                    search={searchCatchRoutes}
                    placeholder="Route 104…"
                  />
                </div>
                <div className="text-sm">
                  <span className={LABEL}>Held item</span>
                  <div className="flex items-center gap-1.5">
                    {form.heldItem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={heldItemSpriteUrl(form.heldItem)}
                        alt=""
                        width={28}
                        height={28}
                        className="pixelated h-7 w-7 shrink-0 object-contain"
                      />
                    ) : null}
                    <input
                      className={INPUT}
                      value={itemQuery}
                      placeholder="Leftovers, Life Orb…"
                      onChange={(e) => {
                        setItemQuery(e.target.value);
                        setForm((f) => ({ ...f, heldItem: e.target.value }));
                      }}
                    />
                    {form.heldItem ? (
                      <button
                        type="button"
                        className="pressable shrink-0 rounded-lg border border-frame bg-surface px-2 py-1.5 text-[11px] font-semibold"
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
                    <ul className="mt-1.5 max-h-32 overflow-auto rounded-lg border border-frame bg-surface">
                      {itemResults.map((item) => (
                        <li key={item.slug}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-interactive-soft/50"
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
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                  Moves
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["move1", "move2", "move3", "move4"] as const).map(
                    (key, i) => (
                      <label key={key} className="text-sm">
                        <span className={LABEL}>Move {i + 1}</span>
                        <input
                          className={INPUT}
                          value={form[key]}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [key]: e.target.value }))
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              {form.slot === "GRAVEYARD" ? (
                <label className="block text-sm">
                  <span className={LABEL}>Cause of death</span>
                  <textarea
                    className={`${INPUT} min-h-16`}
                    value={form.causeOfDeath}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, causeOfDeath: e.target.value }))
                    }
                  />
                </label>
              ) : null}
            </div>
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
