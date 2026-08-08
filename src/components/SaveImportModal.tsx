"use client";

import { useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { Skeleton } from "@/components/Skeleton";
import {
  parsePokemonSaveAsync,
  type ParsedSavePokemon,
  type SaveMonCategory,
} from "@/lib/gen3-save";
import { formatPokedollars } from "@/lib/gen3-save/money";
import { formatPlayTime } from "@/lib/gen3-save/playtime";
import { displayActionError } from "@/lib/action-error-display";
import type { PokemonSlot } from "@/lib/challenge-types";
import { resolveMoveNames } from "@/lib/move-names";

/** Cap matches server import proof limit (under server-action body size). */
const MAX_SAVE_PROOF_BYTES = 3 * 1024 * 1024;
/** Parse ceiling — party/box still work from large emulator dumps. */
const MAX_SAVE_PARSE_BYTES = 32 * 1024 * 1024;
/** Collapse Encountered by default above this count (scroll budget, not opt-out). */
const ENCOUNTERED_COLLAPSE_THRESHOLD = 24;
/** Prefer fullscreen once the review list gets long. */
const FULLSCREEN_MON_THRESHOLD = 18;

const SAVE_ACCEPT =
  ".state,.sav,.srm,.ss0,.ss1,.ss2,.ss3,.ss4,.ss5,.ss6,.ss7,.ss8,.ss9,.s0,.s1,.s2,.s3,.s4,.s5,.s6,.s7,.s8,.s9,.sr0,.sr1,.sr2,.sr3,.sr4,.sr5,.sr6,.sr7,.sr8,.sr9,application/octet-stream";

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
  friendship: number | null;
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
  playTimeSeconds: number | null;
  applyPlayTime: boolean;
  /** Base64 of the parsed save — server re-parses for money/playtime. */
  saveBytesBase64: string | null;
  /** Spent NuzlockeEncounterFlags bits; null when unreliable or opted out. */
  nuzlockeEncounterBits: number[] | null;
  applyEncounterFlags: boolean;
};

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type SaveImportModalProps = {
  open: boolean;
  pending?: boolean;
  /**
   * Board already has Main/Reserves Pokémon — sharper “update / replace” voice.
   * Survive/Die wipe honesty is player-facing; sticky identity is #399.
   */
  hasLivingPokemon?: boolean;
  onClose: () => void;
  onApply: (payload: SaveImportPayload) => void;
};

const CATEGORY_META: {
  key: SaveMonCategory;
  slot: PokemonSlot;
  title: string;
  shortLabel: string;
}[] = [
  { key: "party", slot: "MAIN", title: "Party → Main Squad", shortLabel: "Main" },
  { key: "box", slot: "RESERVE", title: "Box → Reserves", shortLabel: "Reserves" },
  {
    key: "rip",
    slot: "GRAVEYARD",
    title: "Fainted → R.I.P.",
    shortLabel: "R.I.P.",
  },
  {
    key: "encountered",
    slot: "ENCOUNTERED",
    title: "Encountered",
    shortLabel: "Encountered",
  },
];

const SLOT_OPTIONS: { value: PokemonSlot; label: string }[] = [
  { value: "MAIN", label: "Main" },
  { value: "RESERVE", label: "Reserves" },
  { value: "GRAVEYARD", label: "R.I.P." },
  { value: "ENCOUNTERED", label: "Encountered" },
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
    friendship: mon.friendship,
    slot,
    include: true,
  }));
}

function levelCaption(level: string): string {
  return level.trim() ? `Lv ${level.trim()}` : "Lv —";
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "muted";
}) {
  const toneClass =
    tone === "ok"
      ? "border-accent/35 bg-accent/10 text-ink"
      : tone === "warn"
        ? "border-danger/30 bg-danger/10 text-danger"
        : tone === "muted"
          ? "border-frame/40 bg-surface text-muted"
          : "border-frame/60 bg-surface text-ink";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold tracking-tight ${toneClass}`}
    >
      {children}
    </span>
  );
}

export function SaveImportModal({
  open,
  pending = false,
  hasLivingPokemon = false,
  onClose,
  onApply,
}: SaveImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sections, setSections] = useState<Record<
    SaveMonCategory,
    SaveImportDraft[]
  > | null>(null);
  const [encounteredOpen, setEncounteredOpen] = useState(true);
  const [parseReveal, setParseReveal] = useState(false);
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
  const [playTimeSeconds, setPlayTimeSeconds] = useState<number | null>(null);
  const [applyPlayTime, setApplyPlayTime] = useState(false);
  const [playTimeReliable, setPlayTimeReliable] = useState(false);
  const [saveBytes, setSaveBytes] = useState<Uint8Array | null>(null);
  const [nuzlockeEncounterBits, setNuzlockeEncounterBits] = useState<
    number[] | null
  >(null);
  const [applyEncounterFlags, setApplyEncounterFlags] = useState(false);
  const [encounterFlagsReliable, setEncounterFlagsReliable] = useState(false);
  const [parsing, setParsing] = useState(false);

  if (!open) return null;

  const isReimport = hasLivingPokemon;
  const modalTitle = isReimport ? "Update from save" : "Import from save";
  const busy = parsing || pending;

  function reset() {
    setError(null);
    setFileName(null);
    setFormat(null);
    setWarnings([]);
    setSections(null);
    setEncounteredOpen(true);
    setParseReveal(false);
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
    setPlayTimeSeconds(null);
    setApplyPlayTime(false);
    setPlayTimeReliable(false);
    setSaveBytes(null);
    setNuzlockeEncounterBits(null);
    setApplyEncounterFlags(false);
    setEncounterFlagsReliable(false);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFile(file: File | null) {
    if (!file || busy) return;
    if (file.size > MAX_SAVE_PARSE_BYTES) {
      setError(
        "That file is too large to be a Gen 3 save or emulator state. Expected under 32 MB.",
      );
      return;
    }
    setParsing(true);
    setError(null);
    setParseReveal(false);
    // Keep a prior good parse until the new file succeeds (#401 Replace save).
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await parsePokemonSaveAsync(buf);
      if (!result.ok) {
        setError(displayActionError(result.error));
        return;
      }
      // Only keep bytes the server can re-accept for money/playtime proof.
      const proofOk = buf.length <= MAX_SAVE_PROOF_BYTES;
      setSaveBytes(proofOk ? buf : null);
      setFileName(file.name);
      setFormat(result.format);
      setWarnings(result.warnings);
      setTrainerName(result.trainer?.name ?? null);
      setBadgeKeys(result.badges.earnedKeys);
      setBadgesReliable(result.badges.reliable);
      setApplyBadges(result.badges.reliable);
      setReviveUsed(result.revive.reliable ? result.revive.used : null);
      setReviveReliable(result.revive.reliable);
      setApplyRevive(result.revive.reliable);
      const moneyOk = proofOk && result.money.reliable;
      setMoney(moneyOk ? result.money.amount : null);
      setMoneyReliable(moneyOk);
      setApplyMoney(moneyOk);
      const playTimeOk = proofOk && result.playTime.reliable;
      setPlayTimeSeconds(playTimeOk ? result.playTime.totalSeconds : null);
      setPlayTimeReliable(playTimeOk);
      setApplyPlayTime(playTimeOk);
      const flagsOk = result.encounterFlags.reliable;
      setEncounterFlagsReliable(flagsOk);
      setNuzlockeEncounterBits(flagsOk ? result.encounterFlags.usedBits : null);
      setApplyEncounterFlags(flagsOk);
      setEncounteredOpen(
        result.encountered.length <= ENCOUNTERED_COLLAPSE_THRESHOLD,
      );
      setSections({
        party: categoryToDrafts(result.party, "MAIN"),
        box: categoryToDrafts(result.box, "RESERVE"),
        rip: categoryToDrafts(result.rip, "GRAVEYARD"),
        encountered: categoryToDrafts(result.encountered, "ENCOUNTERED"),
      });
      setParseReveal(true);
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
  const totalMons = allDrafts.length;
  const useFullscreen = totalMons >= FULLSCREEN_MON_THRESHOLD;

  const includedByCategory = CATEGORY_META.map(({ key, shortLabel }) => {
    const list = sections?.[key] ?? [];
    const count = list.filter((d) => d.include).length;
    return { key, shortLabel, count, total: list.length };
  });

  const replaceLabels = includedByCategory
    .filter(
      (c) =>
        c.count > 0 &&
        (c.key === "party" || c.key === "box" || c.key === "encountered"),
    )
    .map((c) => c.shortLabel);
  const ripIncluded =
    includedByCategory.find((c) => c.key === "rip")?.count ?? 0;
  const trainerSyncParts: string[] = [];
  if (applyBadges && badgesReliable) trainerSyncParts.push("badges");
  if (applyMoney && moneyReliable) trainerSyncParts.push("money");
  if (applyPlayTime && playTimeReliable) trainerSyncParts.push("playtime");
  if (applyRevive && reviveReliable) trainerSyncParts.push("revive");
  if (applyEncounterFlags && encounterFlagsReliable) trainerSyncParts.push("flags");
  if (applyTrainerName && trainerName) trainerSyncParts.push("name");

  const applyPreviewParts: string[] = [];
  if (included.length) {
    applyPreviewParts.push(
      `${included.length} Pokémon${
        replaceLabels.length
          ? ` · ${replaceLabels.join("/")} replace`
          : ""
      }${ripIncluded ? " · R.I.P. append" : ""}`,
    );
  }
  if (trainerSyncParts.length) {
    applyPreviewParts.push(trainerSyncParts.join(" + "));
  }
  const applyPreview =
    applyPreviewParts.join(" · ") || "Nothing selected to apply";

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

  function setCategoryInclude(category: SaveMonCategory, include: boolean) {
    setSections((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [category]: prev[category].map((d) => ({ ...d, include })),
      };
    });
  }

  function handleClose() {
    reset();
    onClose();
  }

  const canApply =
    Boolean(sections) &&
    !busy &&
    (included.length > 0 ||
      Boolean(applyTrainerName && trainerName) ||
      Boolean(applyBadges && badgesReliable) ||
      Boolean(applyRevive && reviveReliable && reviveUsed != null) ||
      Boolean(applyMoney && moneyReliable && money != null) ||
      Boolean(applyPlayTime && playTimeReliable && playTimeSeconds != null) ||
      Boolean(
        applyEncounterFlags &&
          encounterFlagsReliable &&
          nuzlockeEncounterBits != null,
      ));

  const primaryLabel = pending
    ? "Saving…"
    : isReimport
      ? `Update board (${included.length})`
      : `Apply import (${included.length})`;

  return (
    <Modal
      open={open}
      title={modalTitle}
      size={useFullscreen || parsing ? "fullscreen" : "wide"}
      containScroll={useFullscreen || parsing || Boolean(sections)}
      onClose={handleClose}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-[0.7rem] leading-snug text-muted sm:max-w-[55%]">
            {sections ? applyPreview : "Choose a save to review what will sync."}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="pressable rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
              disabled={pending}
              onClick={handleClose}
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!canApply}
              className="pressable rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-50"
              onClick={() => {
                const needsEconomyProof =
                  Boolean(applyMoney && moneyReliable && money != null) ||
                  Boolean(
                    applyPlayTime &&
                      playTimeReliable &&
                      playTimeSeconds != null,
                  );
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
                  playTimeSeconds,
                  applyPlayTime: Boolean(
                    applyPlayTime &&
                      playTimeReliable &&
                      playTimeSeconds != null,
                  ),
                  saveBytesBase64:
                    needsEconomyProof && saveBytes
                      ? uint8ToBase64(saveBytes)
                      : null,
                  nuzlockeEncounterBits,
                  applyEncounterFlags: Boolean(
                    applyEncounterFlags &&
                      encounterFlagsReliable &&
                      nuzlockeEncounterBits != null,
                  ),
                });
              }}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept={SAVE_ACCEPT}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0] ?? null);
            // Allow re-picking the same file after a failed parse.
            e.target.value = "";
          }}
        />

        <p className="text-muted">
          Prefer Afterplay’s in-game export (
          <code className="text-ink">.sav</code> /{" "}
          <code className="text-ink">.srm</code>). Confirm what we read, then
          sync the board.
        </p>

        <details className="group rounded-lg border border-frame/50 bg-surface-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-tight text-muted [&::-webkit-details-marker]:hidden">
            How this works
            <span
              aria-hidden
              className="text-[0.65rem] transition group-open:rotate-90"
            >
              ▸
            </span>
          </summary>
          <div className="space-y-2 border-t border-frame/40 px-3 py-2 text-xs leading-relaxed text-muted">
            <p>
              Emulator states (
              <code className="text-ink">.state</code>,{" "}
              <code className="text-ink">.ss0</code>–
              <code className="text-ink">.ss9</code>,{" "}
              <code className="text-ink">.s0</code>–
              <code className="text-ink">.s9</code>,{" "}
              <code className="text-ink">.sr0</code>–
              <code className="text-ink">.sr9</code>) still work for
              party/box/R.I.P. and usually encounters, but badges, revive, money,
              playtime, and flags may be unavailable.
            </p>
            <p>
              Party, box (including Day Care), R.I.P., and Encountered are
              detected separately — uncheck anything you want to skip. Species,
              level, and shiny stay locked to the save. Nickname, include, and
              destination slot are the only overrides. Box levels come from
              experience. Nature, ability, moves, IVs, and EVs import when
              readable.
            </p>
            <p>
              Encountered is the wild buffer plus Pokédex “seen” species, and
              replaces your current Encountered list. Fainted → R.I.P. appends
              to the season memorial (duplicates skipped). Encounter flags mark
              catch-failed routes even when no catch was logged.
            </p>
          </div>
        </details>

        <button
          type="button"
          disabled={busy}
          className={`pressable flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-frame bg-surface-2 px-4 py-8 text-center disabled:opacity-60 ${
            parsing ? "border-accent/40 bg-accent/5" : ""
          } ${
            fileName && !parsing
              ? "motion-safe:animate-[search-panel-in_160ms_cubic-bezier(0.22,1,0.36,1)]"
              : ""
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (busy) return;
            void onFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <span className="text-sm font-semibold tracking-tight text-ink">
            {parsing
              ? "Reading save…"
              : fileName
                ? "Replace save"
                : "Drop a save here or browse"}
          </span>
          <span className="text-xs text-muted">
            {fileName
              ? fileName
              : ".sav / .srm preferred · emulator states accepted"}
          </span>
        </button>

        {parsing && (
          <div
            className="space-y-2"
            aria-busy="true"
            aria-label="Reading save"
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-frame/50 bg-surface-2 p-2"
              >
                <Skeleton className="h-4 w-4 shrink-0 rounded bg-frame/20" />
                <Skeleton className="h-10 w-10 shrink-0 rounded bg-frame/15" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-7 w-full max-w-[14rem] rounded-lg bg-frame/15" />
                  <Skeleton className="h-3 w-32 rounded bg-frame/10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p
            className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        {sections && !parsing && (
          <div
            className={`space-y-4 ${
              parseReveal
                ? "motion-safe:animate-[search-panel-in_180ms_cubic-bezier(0.22,1,0.36,1)]"
                : ""
            }`}
          >
            <div className="sticky top-0 z-10 space-y-2 rounded-lg border border-frame bg-surface-2/95 p-3 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                {format && <Chip>{format}</Chip>}
                <Chip tone="ok">Party / box / R.I.P. / encounters</Chip>
                <Chip tone={badgesReliable ? "ok" : "muted"}>
                  Badges {badgesReliable ? "ok" : "unavailable"}
                </Chip>
                <Chip tone={moneyReliable ? "ok" : "muted"}>
                  Money {moneyReliable ? "ok" : "unavailable"}
                </Chip>
                <Chip tone={playTimeReliable ? "ok" : "muted"}>
                  Playtime {playTimeReliable ? "ok" : "unavailable"}
                </Chip>
                <Chip tone={reviveReliable ? "ok" : "muted"}>
                  Revive {reviveReliable ? "ok" : "unavailable"}
                </Chip>
                <Chip tone={encounterFlagsReliable ? "ok" : "muted"}>
                  Flags {encounterFlagsReliable ? "ok" : "unavailable"}
                </Chip>
              </div>
              {warnings.length > 0 && (
                <ul className="space-y-1 text-xs text-muted">
                  {warnings.map((w) => (
                    <li key={w}>⚠ {w}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs font-semibold tracking-tight text-ink">
                Apply preview:{" "}
                <span className="font-normal text-muted">{applyPreview}</span>
              </p>
              {includedByCategory.some((c) => c.total === 0) && (
                <p className="text-[0.65rem] text-muted">
                  {includedByCategory
                    .filter((c) => c.total === 0)
                    .map((c) => `0 ${c.shortLabel.toLowerCase()}`)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-frame bg-surface-2 p-3">
              <p className="text-xs font-semibold tracking-tight text-muted">
                Trainer syncs
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {trainerName ? (
                  <label className="flex items-start gap-2 rounded-lg border border-frame/50 bg-surface px-2.5 py-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={applyTrainerName}
                      disabled={busy}
                      onChange={(e) => setApplyTrainerName(e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold tracking-tight">
                        Board name
                      </span>
                      <Chip>{trainerName}</Chip>
                    </span>
                  </label>
                ) : (
                  <p className="rounded-lg border border-frame/40 bg-surface/60 px-2.5 py-2 text-xs text-muted">
                    No trainer name found
                  </p>
                )}

                <label
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                    badgesReliable
                      ? "border-frame/50 bg-surface"
                      : "border-frame/30 bg-surface/40 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={applyBadges && badgesReliable}
                    disabled={!badgesReliable || busy}
                    onChange={(e) => setApplyBadges(e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-tight">
                      Gym badges
                    </span>
                    {badgesReliable ? (
                      <Chip tone="ok">
                        {badgeKeys.length
                          ? `${badgeKeys.length} badges`
                          : "0 badges"}
                      </Chip>
                    ) : (
                      <Chip tone="muted">Unavailable</Chip>
                    )}
                  </span>
                </label>

                <label
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                    reviveReliable
                      ? "border-frame/50 bg-surface"
                      : "border-frame/30 bg-surface/40 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={applyRevive && reviveReliable}
                    disabled={
                      !reviveReliable || reviveUsed == null || busy
                    }
                    onChange={(e) => setApplyRevive(e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-tight">
                      Revive token
                    </span>
                    {reviveReliable && reviveUsed != null ? (
                      <Chip tone="ok">
                        {reviveUsed ? "Used" : "Available"}
                      </Chip>
                    ) : (
                      <Chip tone="muted">Unavailable</Chip>
                    )}
                  </span>
                </label>

                <label
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                    moneyReliable
                      ? "border-frame/50 bg-surface"
                      : "border-frame/30 bg-surface/40 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={applyMoney && moneyReliable}
                    disabled={!moneyReliable || money == null || busy}
                    onChange={(e) => setApplyMoney(e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-tight">
                      Money
                    </span>
                    {moneyReliable && money != null ? (
                      <Chip tone="ok">{formatPokedollars(money)}</Chip>
                    ) : (
                      <Chip tone="muted">Unavailable · try .sav/.srm</Chip>
                    )}
                  </span>
                </label>

                <label
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                    playTimeReliable
                      ? "border-frame/50 bg-surface"
                      : "border-frame/30 bg-surface/40 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={applyPlayTime && playTimeReliable}
                    disabled={
                      !playTimeReliable || playTimeSeconds == null || busy
                    }
                    onChange={(e) => setApplyPlayTime(e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-tight">
                      Playtime
                    </span>
                    {playTimeReliable && playTimeSeconds != null ? (
                      <Chip tone="ok">
                        {formatPlayTime(playTimeSeconds)}
                      </Chip>
                    ) : (
                      <Chip tone="muted">Unavailable · try .sav/.srm</Chip>
                    )}
                  </span>
                </label>

                <label
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 sm:col-span-2 ${
                    encounterFlagsReliable
                      ? "border-frame/50 bg-surface"
                      : "border-frame/30 bg-surface/40 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={applyEncounterFlags && encounterFlagsReliable}
                    disabled={!encounterFlagsReliable || busy}
                    onChange={(e) => setApplyEncounterFlags(e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-tight">
                      Catch-failed routes
                    </span>
                    {encounterFlagsReliable &&
                    nuzlockeEncounterBits != null ? (
                      <Chip tone="ok">
                        {nuzlockeEncounterBits.length} flagged
                      </Chip>
                    ) : (
                      <Chip tone="muted">Unavailable</Chip>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {CATEGORY_META.map(({ key, title }) => {
              const list = sections[key];
              if (list.length === 0) return null;

              const includedCount = list.filter((d) => d.include).length;
              const allIncluded = includedCount === list.length;
              const noneIncluded = includedCount === 0;
              const isEncountered = key === "encountered";
              const collapsed = isEncountered && !encounteredOpen;

              return (
                <section key={key} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allIncluded}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              !allIncluded && !noneIncluded;
                          }
                        }}
                        disabled={busy}
                        onChange={(e) =>
                          setCategoryInclude(key, e.target.checked)
                        }
                      />
                      <h3 className="text-xs font-semibold tracking-tight text-muted">
                        {title}{" "}
                        <span className="font-normal normal-case text-muted">
                          ({includedCount}/{list.length})
                        </span>
                      </h3>
                    </label>
                    {isEncountered &&
                      list.length > ENCOUNTERED_COLLAPSE_THRESHOLD && (
                        <button
                          type="button"
                          className="pressable ml-auto rounded-md border border-frame/60 bg-surface px-2 py-1 text-[0.65rem] font-semibold tracking-tight text-muted"
                          disabled={busy}
                          onClick={() => setEncounteredOpen((o) => !o)}
                        >
                          {collapsed
                            ? `Show ${list.length} species`
                            : "Collapse"}
                        </button>
                      )}
                  </div>

                  {collapsed ? (
                    <p className="rounded-lg border border-frame/50 bg-surface-2 px-3 py-2 text-xs text-muted">
                      {list.length} species · will replace Encountered
                      {includedCount < list.length
                        ? ` (${includedCount} included)`
                        : ""}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((mon, index) => (
                        <li
                          key={`${key}-${mon.pid}-${index}`}
                          className={`flex flex-wrap items-center gap-2 rounded-lg border border-frame bg-surface-2 px-2 py-1.5 sm:flex-nowrap ${
                            mon.include ? "" : "opacity-50"
                          }`}
                        >
                          <label className="flex shrink-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={mon.include}
                              disabled={busy}
                              onChange={(e) =>
                                updateDraft(key, index, {
                                  include: e.target.checked,
                                })
                              }
                            />
                            <PokemonSpriteImage
                              alt=""
                              className="pixelated h-9 w-9"
                              height={36}
                              pokedexId={mon.pokedexId}
                              shiny={mon.isShiny}
                              species={mon.species}
                              width={36}
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            <input
                              value={mon.nickname}
                              placeholder={mon.species}
                              disabled={busy}
                              aria-label={`Nickname for ${mon.species}`}
                              className="w-full rounded-md border border-frame bg-surface px-2 py-1 text-sm disabled:opacity-60"
                              onChange={(e) =>
                                updateDraft(key, index, {
                                  nickname: e.target.value,
                                })
                              }
                            />
                            <p className="mt-0.5 truncate text-[0.65rem] text-muted">
                              {mon.species}
                              {" · "}
                              {levelCaption(mon.level)}
                              {mon.isShiny ? " · shiny" : ""}
                              {" · "}#{mon.pokedexId}
                            </p>
                            <p className="truncate text-[0.65rem] text-muted/80">
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
                          <select
                            value={mon.slot}
                            disabled={busy}
                            aria-label={`Destination slot for ${mon.species}`}
                            title="Destination slot"
                            className="w-full shrink-0 rounded-md border border-frame/60 bg-surface px-1.5 py-1 text-[0.65rem] text-muted sm:w-auto"
                            onChange={(e) =>
                              updateDraft(key, index, {
                                slot: e.target.value as PokemonSlot,
                              })
                            }
                          >
                            {SLOT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}

            <div className="space-y-1.5 rounded-lg border border-frame/60 bg-surface-2/60 px-3 py-2.5 text-xs leading-relaxed text-muted">
              {replaceLabels.length > 0 && (
                <p>
                  Included{" "}
                  <span className="font-semibold text-ink">
                    {replaceLabels.join(" / ")}
                  </span>{" "}
                  will <span className="font-semibold text-ink">replace</span>{" "}
                  those board sections.
                </p>
              )}
              {ripIncluded > 0 && (
                <p>
                  R.I.P. <span className="font-semibold text-ink">appends</span>{" "}
                  to the memorial (duplicates skipped); existing graves stay.
                </p>
              )}
              {isReimport &&
                replaceLabels.some(
                  (l) => l === "Main" || l === "Reserves" || l === "Encountered",
                ) && (
                  <p>
                    Replaces your current Main / Reserves / Encountered. Open
                    Survive or Die bets on those Pokémon may be cleared.
                  </p>
                )}
              {!replaceLabels.length && !ripIncluded && (
                <p>No Pokémon selected — only checked trainer syncs will apply.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
