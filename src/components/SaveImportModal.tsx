"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  parsePokemonSaveAsync,
  type ParsedSavePokemon,
  type SaveMonCategory,
} from "@/lib/gen3-save";
import { formatPokedollars } from "@/lib/gen3-save/money";
import { displayActionError } from "@/lib/action-error-display";
import type { PokemonSlot } from "@/lib/challenge-types";
import { resolveMoveNames } from "@/lib/move-names";

export type SaveImportDraft = {
  pid: number;
  nickname: string;
  species: string;
  pokedexId: number;
  level: string;
  isShiny: boolean;
  nature: string | null;
  ability: string | null;
  catchRoute: string | null;
  heldItem: string | null;
  moves: string[];
  ivs: ParsedSavePokemon["ivs"];
  evs: ParsedSavePokemon["evs"];
  slot: PokemonSlot;
  include: boolean;
};

export type SaveImportPayload = {
  pokemon: SaveImportDraft[];
  trainerName: string | null;
  applyTrainerName: boolean;
  badgeKeys: string[];
  applyBadges: boolean;
  reviveUsed: boolean | null;
  applyRevive: boolean;
  money: number | null;
  applyMoney: boolean;
  safariZoneAreas: string[] | null;
};

type SaveImportModalProps = {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onApply: (payload: SaveImportPayload) => void;
};

const CATEGORY_META: {
  key: SaveMonCategory;
  slot: PokemonSlot;
  title: string;
}[] = [
  { key: "party", slot: "MAIN", title: "Party → Main Squad" },
  { key: "box", slot: "RESERVE", title: "Box → Reserves" },
  { key: "rip", slot: "GRAVEYARD", title: "Fainted → R.I.P. (add to memorial)" },
  { key: "encountered", slot: "ENCOUNTERED", title: "Encountered" },
];

function categoryToDrafts(
  list: ParsedSavePokemon[],
  slot: PokemonSlot,
): SaveImportDraft[] {
  return list.map((mon) => ({
    pid: mon.pid,
    nickname: mon.nickname ?? "",
    species: mon.species,
    pokedexId: mon.pokedexId,
    level: mon.level != null ? String(mon.level) : "",
    isShiny: mon.isShiny,
    nature: mon.nature,
    ability: mon.ability,
    catchRoute: mon.catchRoute,
    heldItem: mon.heldItem,
    moves: mon.moves,
    ivs: mon.ivs,
    evs: mon.evs,
    slot,
    include: true,
  }));
}

export function SaveImportModal({
  open,
  pending = false,
  onClose,
  onApply,
}: SaveImportModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sections, setSections] = useState<Record<
    SaveMonCategory,
    SaveImportDraft[]
  > | null>(null);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [applyTrainerName, setApplyTrainerName] = useState(false);
  const [badgeKeys, setBadgeKeys] = useState<string[]>([]);
  const [applyBadges, setApplyBadges] = useState(true);
  const [badgesReliable, setBadgesReliable] = useState(false);
  const [reviveUsed, setReviveUsed] = useState<boolean | null>(null);
  const [applyRevive, setApplyRevive] = useState(false);
  const [reviveReliable, setReviveReliable] = useState(false);
  const [money, setMoney] = useState<number | null>(null);
  const [applyMoney, setApplyMoney] = useState(false);
  const [moneyReliable, setMoneyReliable] = useState(false);
  const [safariZoneAreas, setSafariZoneAreas] = useState<string[] | null>(null);
  const [parsing, setParsing] = useState(false);

  if (!open) return null;

  function reset() {
    setError(null);
    setFormat(null);
    setWarnings([]);
    setSections(null);
    setTrainerName(null);
    setApplyTrainerName(false);
    setBadgeKeys([]);
    setApplyBadges(true);
    setBadgesReliable(false);
    setReviveUsed(null);
    setApplyRevive(false);
    setReviveReliable(false);
    setMoney(null);
    setApplyMoney(false);
    setMoneyReliable(false);
    setSafariZoneAreas(null);
    setParsing(false);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setError(null);
    setSections(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await parsePokemonSaveAsync(buf);
      if (!result.ok) {
        setError(displayActionError(result.error));
        return;
      }
      setFormat(result.format);
      setWarnings(result.warnings);
      setTrainerName(result.trainer?.name ?? null);
      setBadgeKeys(result.badges.earnedKeys);
      setBadgesReliable(result.badges.reliable);
      setApplyBadges(result.badges.reliable);
      setReviveUsed(result.revive.reliable ? result.revive.used : null);
      setReviveReliable(result.revive.reliable);
      setApplyRevive(result.revive.reliable);
      setMoney(result.money.reliable ? result.money.amount : null);
      setMoneyReliable(result.money.reliable);
      setApplyMoney(result.money.reliable);
      setSafariZoneAreas(
        result.safariZoneAreas.reliable ? result.safariZoneAreas.areas : null,
      );
      setSections({
        party: categoryToDrafts(result.party, "MAIN"),
        box: categoryToDrafts(result.box, "RESERVE"),
        rip: categoryToDrafts(result.rip, "GRAVEYARD"),
        encountered: categoryToDrafts(result.encountered, "ENCOUNTERED"),
      });
    } catch (e) {
      setError(
        displayActionError(
          e instanceof Error ? e.message : "Failed to read save file",
        ),
      );
    } finally {
      setParsing(false);
    }
  }

  const allDrafts = sections
    ? CATEGORY_META.flatMap((c) => sections[c.key])
    : [];
  const included = allDrafts.filter((d) => d.include);

  function updateDraft(
    category: SaveMonCategory,
    index: number,
    patch: Partial<SaveImportDraft>,
  ) {
    setSections((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [category]: prev[category].map((d, i) =>
          i === index ? { ...d, ...patch } : d,
        ),
      };
    });
  }

  return (
    <Modal
      open={open}
      title="Import from save"
      wide
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="pressable rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={
              (!included.length &&
                !applyTrainerName &&
                !applyBadges &&
                !applyRevive &&
                !applyMoney) ||
              pending ||
              parsing ||
              !sections
            }
            className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
            onClick={() =>
              onApply({
                pokemon: included,
                trainerName,
                applyTrainerName: Boolean(applyTrainerName && trainerName),
                badgeKeys,
                applyBadges: Boolean(applyBadges && badgesReliable),
                reviveUsed,
                applyRevive: Boolean(
                  applyRevive && reviveReliable && reviveUsed != null,
                ),
                money,
                applyMoney: Boolean(
                  applyMoney && moneyReliable && money != null,
                ),
                safariZoneAreas,
              })
            }
          >
            {pending
              ? "Saving…"
              : `Apply import (${included.length} Pokémon)`}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Upload a Modern Emerald save. Prefer Afterplay’s in-game export (
          <code className="text-ink">.sav</code> /{" "}
          <code className="text-ink">.srm</code>) — that’s the most stable
          source for badges, revive, money, Day Care, and Pokédex encounters.
          Emulator states (
          <code className="text-ink">.state</code>,{" "}
          <code className="text-ink">.ss0</code>–
          <code className="text-ink">.ss9</code>,{" "}
          <code className="text-ink">.s0</code>–
          <code className="text-ink">.s9</code>,{" "}
          <code className="text-ink">.sr0</code>–
          <code className="text-ink">.sr9</code>
          ) still work for party/box/R.I.P. and usually encounters, but badges,
          revive, and money may be unavailable. Party, box (including Day
          Care), R.I.P., and Encountered are detected separately — uncheck
          anything you want to skip. Box Pokémon levels are derived from
          experience. Nature, ability, moves, IVs, and EVs are imported when
          readable. Encountered is the wild buffer plus Pokédex “seen”
          species, and replaces your current Encountered list on import.
          Fainted → R.I.P. is added to the season memorial (duplicates
          skipped); existing graves are kept.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-tight tracking-wide text-muted">
            Save file
          </span>
          <input
            type="file"
            accept=".state,.sav,.srm,.ss0,.ss1,.ss2,.ss3,.ss4,.ss5,.ss6,.ss7,.ss8,.ss9,.s0,.s1,.s2,.s3,.s4,.s5,.s6,.s7,.s8,.s9,.sr0,.sr1,.sr2,.sr3,.sr4,.sr5,.sr6,.sr7,.sr8,.sr9,application/octet-stream"
            disabled={parsing || pending}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-frame file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {parsing ? <p className="text-muted">Reading save…</p> : null}
        {error ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-danger">
            {error}
          </p>
        ) : null}
        {format ? (
          <p className="text-xs text-muted">
            Detected: {format}
            {warnings.length ? ` — ${warnings.join(" ")}` : ""}
          </p>
        ) : null}

        {sections ? (
          <>
            <div className="space-y-2 rounded-lg border border-frame bg-surface-2 p-3">
              <p className="text-xs font-semibold tracking-tight tracking-wide text-muted">
                Trainer
              </p>
              {trainerName ? (
                <label className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={applyTrainerName}
                    onChange={(e) => setApplyTrainerName(e.target.checked)}
                  />
                  <span>
                    Set board name to{" "}
                    <strong className="text-ink">{trainerName}</strong>
                  </span>
                </label>
              ) : (
                <p className="text-xs text-muted">No trainer name found.</p>
              )}
              <label className="flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  checked={applyBadges && badgesReliable}
                  disabled={!badgesReliable}
                  onChange={(e) => setApplyBadges(e.target.checked)}
                />
                <span>
                  Sync gym badges
                  {badgesReliable
                    ? badgeKeys.length
                      ? ` (${badgeKeys.length} earned)`
                      : " (none earned)"
                    : " (unavailable)"}
                </span>
              </label>
              <label className="flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  checked={applyRevive && reviveReliable}
                  disabled={!reviveReliable || reviveUsed == null}
                  onChange={(e) => setApplyRevive(e.target.checked)}
                />
                <span>
                  Sync revive token
                  {reviveReliable && reviveUsed != null
                    ? reviveUsed
                      ? " (used)"
                      : " (available)"
                    : " (unavailable)"}
                </span>
              </label>
              <label className="flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  checked={applyMoney && moneyReliable}
                  disabled={!moneyReliable || money == null}
                  onChange={(e) => setApplyMoney(e.target.checked)}
                />
                <span>
                  Sync money
                  {moneyReliable && money != null
                    ? ` (${formatPokedollars(money)})`
                    : " (unavailable — try a .sav/.srm export)"}
                </span>
              </label>
            </div>

            {CATEGORY_META.map(({ key, title }) => {
              const list = sections[key];
              return (
                <section key={key} className="space-y-2">
                  <h3 className="text-xs font-semibold tracking-tight tracking-wide text-muted">
                    {title}{" "}
                    <span className="font-normal normal-case">
                      ({list.length})
                    </span>
                  </h3>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted">None detected.</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.map((mon, index) => (
                        <li
                          key={mon.pid}
                          className={`flex flex-wrap items-center gap-3 rounded-lg border border-frame bg-surface-2 p-2 ${
                            mon.include ? "" : "opacity-50"
                          }`}
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={mon.include}
                              onChange={(e) =>
                                updateDraft(key, index, {
                                  include: e.target.checked,
                                })
                              }
                            />
                            <PokemonSpriteImage
                              alt=""
                              className="pixelated h-10 w-10"
                              height={40}
                              pokedexId={mon.pokedexId}
                              shiny={mon.isShiny}
                              species={mon.species}
                              width={40}
                            />
                          </label>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap gap-2">
                              <input
                                value={mon.nickname}
                                placeholder="Nickname"
                                className="w-full rounded-lg border border-frame bg-surface px-2 py-1 text-sm sm:w-auto sm:min-w-[6rem] sm:flex-1"
                                onChange={(e) =>
                                  updateDraft(key, index, {
                                    nickname: e.target.value,
                                  })
                                }
                              />
                              <input
                                value={mon.species}
                                placeholder="Species"
                                className="w-full rounded-lg border border-frame bg-surface px-2 py-1 text-sm sm:w-auto sm:min-w-[6rem] sm:flex-1"
                                onChange={(e) =>
                                  updateDraft(key, index, {
                                    species: e.target.value,
                                  })
                                }
                              />
                              <input
                                value={mon.level}
                                placeholder="Lv"
                                inputMode="numeric"
                                className="w-14 rounded-lg border border-frame bg-surface px-2 py-1 text-sm"
                                onChange={(e) =>
                                  updateDraft(key, index, {
                                    level: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={mon.isShiny}
                                  onChange={(e) =>
                                    updateDraft(key, index, {
                                      isShiny: e.target.checked,
                                    })
                                  }
                                />
                                Shiny
                              </label>
                              <select
                                value={mon.slot}
                                className="rounded-lg border border-frame bg-surface px-2 py-1"
                                onChange={(e) =>
                                  updateDraft(key, index, {
                                    slot: e.target.value as PokemonSlot,
                                  })
                                }
                              >
                                <option value="MAIN">Main Squad</option>
                                <option value="RESERVE">Reserves</option>
                                <option value="GRAVEYARD">R.I.P.</option>
                                <option value="ENCOUNTERED">Encountered</option>
                              </select>
                              <span className="text-muted">#{mon.pokedexId}</span>
                            </div>
                            <p className="truncate text-[11px] text-muted">
                              {[
                                mon.nature,
                                mon.ability,
                                mon.moves.length
                                  ? resolveMoveNames(mon.moves).join(" · ")
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "No nature / ability / moves"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
