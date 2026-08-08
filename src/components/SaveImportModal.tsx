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
import {
  buildImportSaveReview,
  importReviewPreviewParts,
  type SaveImportBoardGrave,
  type SaveImportBoardLiving,
} from "@/lib/import-save-review";
import { resolveMoveNames } from "@/lib/move-names";
import {
  BadgesIcon,
  CatchFailedIcon,
  MoneyIcon,
  PlayTimeIcon,
  ReviveIcon,
  TrainerNameIcon,
} from "@/components/trainer-stat-icons";

export type { SaveImportBoardGrave, SaveImportBoardLiving };

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
  otId: number;
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
  /** Pokédex-seen placeholder — pid is UI-only, never persist as identity. */
  isDexSeenStub: boolean;
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
   * Living Main/Reserves on the board for sticky-PID review deltas (#399 / #401).
   * Pass whatever is hydrated; set `boardLivingReady` false while Reserves load.
   */
  boardLiving?: SaveImportBoardLiving[];
  /** Existing memorial rows for R.I.P. PID refresh / append preview. */
  boardGraves?: SaveImportBoardGrave[];
  /**
   * False while deferred Reserves / R.I.P. are still loading — preview may
   * under-count until ready.
   */
  boardLivingReady?: boolean;
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

function categoryToDrafts(
  list: ParsedSavePokemon[],
  slot: PokemonSlot,
): SaveImportDraft[] {
  return list.map((mon) => ({
    pid: mon.pid,
    otId: mon.otId,
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
    isDexSeenStub: Boolean(mon.isDexSeenStub),
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
  tone?: "neutral" | "ok" | "warn" | "muted" | "info";
}) {
  const toneClass =
    tone === "ok"
      ? "border-accent/35 bg-accent/10 text-ink"
      : tone === "warn"
        ? "border-danger/30 bg-danger/10 text-danger"
        : tone === "info"
          ? "border-accent-2/40 bg-accent-2/10 text-accent-2-ink"
          : tone === "muted"
            ? "border-frame/40 bg-surface text-muted"
            : "border-frame/60 bg-surface text-ink";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-[0.7rem] font-semibold tracking-tight ${toneClass}`}
    >
      {children}
    </span>
  );
}

function draftReviewKey(category: SaveMonCategory, index: number): string {
  return `${category}:${index}`;
}

function statusChip(
  kind: "updated" | "new" | "died" | "add" | undefined,
): ReactNode {
  if (!kind || kind === "add") return null;
  if (kind === "updated") return <Chip tone="ok">Updated</Chip>;
  if (kind === "new") return <Chip tone="info">New</Chip>;
  return <Chip tone="warn">Died</Chip>;
}

/** Note + pen — nickname fields are the editable override. */
function NicknameEditIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        d="M5.5 3.75h8.25L17.5 7.5v11.75a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1z"
        strokeLinejoin="round"
      />
      <path d="M13.75 3.75V7.75H17.5" strokeLinejoin="round" />
      <path d="M7.25 11h5.5M7.25 14.25h4" strokeLinecap="round" />
      <path
        d="M14.25 18.25 19.5 13l1.75 1.75-5.25 5.25H14.25v-1.75Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveImportModal({
  open,
  pending = false,
  boardLiving = [],
  boardGraves = [],
  boardLivingReady = true,
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
  const [parserNotesOpen, setParserNotesOpen] = useState(false);

  if (!open) return null;

  const isReimport = boardLiving.length > 0 || boardGraves.length > 0;
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
    setParserNotesOpen(false);
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
      setParserNotesOpen(false);
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

  const partyBoxIncluded =
    (includedByCategory.find((c) => c.key === "party")?.count ?? 0) +
    (includedByCategory.find((c) => c.key === "box")?.count ?? 0);
  const encounteredIncluded =
    includedByCategory.find((c) => c.key === "encountered")?.count ?? 0;
  const ripIncluded =
    includedByCategory.find((c) => c.key === "rip")?.count ?? 0;
  const trainerSyncParts: string[] = [];
  if (applyBadges && badgesReliable) trainerSyncParts.push("badges");
  if (applyMoney && moneyReliable) trainerSyncParts.push("money");
  if (applyPlayTime && playTimeReliable) trainerSyncParts.push("playtime");
  if (applyRevive && reviveReliable) trainerSyncParts.push("revive");
  if (applyEncounterFlags && encounterFlagsReliable) trainerSyncParts.push("flags");
  if (applyTrainerName && trainerName) trainerSyncParts.push("name");

  const reviewDrafts =
    sections == null
      ? []
      : CATEGORY_META.flatMap(({ key }) =>
          sections[key].map((d, index) => ({
            key: draftReviewKey(key, index),
            pid: d.pid,
            isDexSeenStub: d.isDexSeenStub,
            include: d.include,
            slot: d.slot,
            species: d.species,
            nickname: d.nickname,
            level: d.level,
            pokedexId: d.pokedexId,
            isShiny: d.isShiny,
          })),
        );
  const saveReview = buildImportSaveReview(
    boardLiving,
    reviewDrafts,
    boardGraves,
  );
  const applyPreviewParts = importReviewPreviewParts(saveReview, {
    encounteredIncluded,
    ripIncluded,
    trainerSyncParts,
    includedCount: included.length,
  });
  // First-import party/box still need a voice when sticky review is empty.
  if (
    !saveReview.hasBoardLiving &&
    partyBoxIncluded > 0 &&
    !applyPreviewParts.some((p) => p.includes("Pokémon"))
  ) {
    applyPreviewParts.unshift(`${partyBoxIncluded} Main/Reserves`);
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

  const trainerUnavailable: string[] = [];
  if (!badgesReliable) trainerUnavailable.push("badges");
  if (!moneyReliable) trainerUnavailable.push("money");
  if (!playTimeReliable) trainerUnavailable.push("playtime");
  if (!reviveReliable) trainerUnavailable.push("revive");
  if (!encounterFlagsReliable) trainerUnavailable.push("flags");
  const hasParsedFile = Boolean(sections) && !parsing;

  function syncCellClass(reliable: boolean): string {
    return `flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
      reliable
        ? "border-frame/55 bg-surface-2"
        : "border-frame/30 bg-surface/40 opacity-70"
    }`;
  }

  return (
    <Modal
      open={open}
      title={modalTitle}
      size={useFullscreen || parsing ? "fullscreen" : "wide"}
      containScroll
      onClose={handleClose}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs leading-snug text-muted sm:max-w-[55%]">
            {sections ? applyPreview : "Choose a save to review what will sync."}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="pressable rounded-lg border border-frame bg-surface px-3 py-2 text-sm font-semibold tracking-tight"
              disabled={pending}
              onClick={handleClose}
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!canApply}
              className="pressable rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
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
      <div className="flex min-h-0 flex-1 flex-col text-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept={SAVE_ACCEPT}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <>
            {(hasParsedFile || (sections && !parsing)) && (
            <div className="shrink-0 space-y-3 border-b border-frame/50 px-4 py-3 sm:px-5">
              {hasParsedFile ? (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-frame/70 bg-surface-2 px-3 py-2.5"
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight text-ink">
                      {fileName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {format ?? "Parsed save"}
                      {isReimport ? " · updating board" : " · ready to import"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="pressable shrink-0 rounded-md border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight disabled:opacity-60"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace
                  </button>
                </div>
              ) : null}

              {sections && !parsing ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {format && <Chip>{format}</Chip>}
                    <Chip tone="ok">Roster</Chip>
                    {trainerUnavailable.length === 0 ? (
                      <Chip tone="ok">Trainer syncs</Chip>
                    ) : (
                      <Chip tone="muted">
                        Missing {trainerUnavailable.join(", ")}
                      </Chip>
                    )}
                    {warnings.length > 0 && (
                      <button
                        type="button"
                        className="pressable rounded-md border border-frame/50 bg-surface px-2.5 py-1 text-xs font-semibold tracking-tight text-muted"
                        onClick={() => setParserNotesOpen((o) => !o)}
                      >
                        {parserNotesOpen
                          ? "Hide notes"
                          : `Notes (${warnings.length})`}
                      </button>
                    )}
                  </div>
                  {parserNotesOpen && warnings.length > 0 && (
                    <ul className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-frame/40 bg-surface-2/80 px-3 py-2 text-xs leading-snug text-muted">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm leading-snug text-ink">
                    <span className="font-semibold tracking-tight">
                      Preview
                    </span>
                    <span className="text-muted"> · {applyPreview}</span>
                  </p>
                  {!boardLivingReady && isReimport && (
                    <p className="text-xs text-muted">
                      Loading board sections for match preview…
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            )}

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
              {parsing && (
                <div
                  className="space-y-3"
                  aria-busy="true"
                  aria-label="Reading save"
                >
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-frame/50 bg-surface-2 p-3"
                    >
                      <Skeleton className="h-5 w-5 shrink-0 rounded bg-frame/20" />
                      <Skeleton className="h-12 w-12 shrink-0 rounded bg-frame/15" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-7 w-full max-w-[16rem] rounded-md bg-frame/15" />
                        <Skeleton className="h-3.5 w-32 rounded bg-frame/10" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p
                  className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {!hasParsedFile && !parsing && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm text-muted">
                      Drop a{" "}
                      <code className="text-ink">.state</code>,{" "}
                      <code className="text-ink">.sav</code>, or{" "}
                      <code className="text-ink">.srm</code>
                      {" — "}confirm what we read, then sync.
                    </p>
                    <details className="group">
                      <summary className="cursor-pointer list-none text-xs font-semibold tracking-tight text-muted underline-offset-2 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden">
                        How this works
                      </summary>
                      <div className="mt-2 max-w-xl space-y-2 rounded-lg border border-frame/50 bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
                        <p>
                          Emulator <code className="text-ink">.state</code>{" "}
                          dumps are what most players use and work for
                          party/box/R.I.P./encounters. Afterplay in-game exports
                          (<code className="text-ink">.sav</code> /{" "}
                          <code className="text-ink">.srm</code>) are best when
                          you also want badges, money, playtime, revive, and
                          flags.
                        </p>
                        <p>
                          Species, level, shiny, and destination stay locked to
                          the save. Nickname and include are the only overrides —
                          rearrange on the board after import. On re-import,
                          Main/Reserves match by PID so Survive/Die and notes
                          stick.
                        </p>
                      </div>
                    </details>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className={`pressable flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-frame bg-surface-2 px-4 text-center disabled:opacity-60 ${
                      parsing ? "border-accent/40 bg-accent/5 py-8" : "py-10"
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
                    <span className="text-base font-semibold tracking-tight text-ink">
                      Drop a save here or browse
                    </span>
                    <span className="text-sm text-muted">
                      .state · .sav · .srm accepted
                    </span>
                  </button>
                </div>
              )}

              {sections && !parsing && (
                <div
                  className={`space-y-5 ${
                    parseReveal
                      ? "motion-safe:animate-[search-panel-in_180ms_cubic-bezier(0.22,1,0.36,1)]"
                      : ""
                  }`}
                >
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-tight text-muted">
                      Trainer syncs
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {trainerName ? (
                        <label className={syncCellClass(true)}>
                          <input
                            type="checkbox"
                            className="mt-1 shrink-0"
                            checked={applyTrainerName}
                            disabled={busy}
                            onChange={(e) =>
                              setApplyTrainerName(e.target.checked)
                            }
                          />
                          <span className="mt-0.5 shrink-0 text-muted">
                            <TrainerNameIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold tracking-tight text-muted">
                              Name
                            </span>
                            <span className="block truncate text-sm font-semibold text-ink">
                              {trainerName}
                            </span>
                          </span>
                        </label>
                      ) : null}

                      <label className={syncCellClass(badgesReliable)}>
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={applyBadges && badgesReliable}
                          disabled={!badgesReliable || busy}
                          onChange={(e) => setApplyBadges(e.target.checked)}
                        />
                        <span className="mt-0.5 shrink-0 text-muted">
                          <BadgesIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold tracking-tight text-muted">
                            Badges
                          </span>
                          <span className="block truncate text-sm font-semibold text-ink">
                            {badgesReliable
                              ? `${badgeKeys.length} earned`
                              : "Unavailable"}
                          </span>
                        </span>
                      </label>

                      <label className={syncCellClass(reviveReliable)}>
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={applyRevive && reviveReliable}
                          disabled={
                            !reviveReliable || reviveUsed == null || busy
                          }
                          onChange={(e) => setApplyRevive(e.target.checked)}
                        />
                        <span className="mt-0.5 shrink-0 text-muted">
                          <ReviveIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold tracking-tight text-muted">
                            Revive
                          </span>
                          <span className="block truncate text-sm font-semibold text-ink">
                            {reviveReliable && reviveUsed != null
                              ? reviveUsed
                                ? "Used"
                                : "Available"
                              : "Unavailable"}
                          </span>
                        </span>
                      </label>

                      <label className={syncCellClass(moneyReliable)}>
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={applyMoney && moneyReliable}
                          disabled={!moneyReliable || money == null || busy}
                          onChange={(e) => setApplyMoney(e.target.checked)}
                        />
                        <span className="mt-0.5 shrink-0 text-muted">
                          <MoneyIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold tracking-tight text-muted">
                            Money
                          </span>
                          <span className="block truncate text-sm font-semibold text-ink">
                            {moneyReliable && money != null
                              ? formatPokedollars(money)
                              : "Unavailable"}
                          </span>
                        </span>
                      </label>

                      <label className={syncCellClass(playTimeReliable)}>
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={applyPlayTime && playTimeReliable}
                          disabled={
                            !playTimeReliable ||
                            playTimeSeconds == null ||
                            busy
                          }
                          onChange={(e) => setApplyPlayTime(e.target.checked)}
                        />
                        <span className="mt-0.5 shrink-0 text-muted">
                          <PlayTimeIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold tracking-tight text-muted">
                            Playtime
                          </span>
                          <span className="block truncate text-sm font-semibold text-ink">
                            {playTimeReliable && playTimeSeconds != null
                              ? formatPlayTime(playTimeSeconds)
                              : "Unavailable"}
                          </span>
                        </span>
                      </label>

                      <label className={syncCellClass(encounterFlagsReliable)}>
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={
                            applyEncounterFlags && encounterFlagsReliable
                          }
                          disabled={!encounterFlagsReliable || busy}
                          onChange={(e) =>
                            setApplyEncounterFlags(e.target.checked)
                          }
                        />
                        <span className="mt-0.5 shrink-0 text-muted">
                          <CatchFailedIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold tracking-tight text-muted">
                            Catch-failed
                          </span>
                          <span className="block truncate text-sm font-semibold text-ink">
                            {encounterFlagsReliable &&
                            nuzlockeEncounterBits != null
                              ? `${nuzlockeEncounterBits.length} flagged`
                              : "Unavailable"}
                          </span>
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
                      <section key={key} className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex min-w-0 items-center gap-2.5">
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
                            <h3 className="text-sm font-semibold tracking-tight text-ink">
                              {title}{" "}
                              <span className="font-normal text-muted">
                                ({includedCount}/{list.length})
                              </span>
                            </h3>
                          </label>
                          {isEncountered &&
                            list.length > ENCOUNTERED_COLLAPSE_THRESHOLD && (
                              <button
                                type="button"
                                className="pressable ml-auto rounded-md border border-frame/60 bg-surface px-2.5 py-1 text-xs font-semibold tracking-tight text-muted"
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
                          <p className="rounded-lg border border-frame/50 bg-surface-2 px-3 py-2.5 text-sm text-muted">
                            {list.length} species · will replace Encountered
                            {includedCount < list.length
                              ? ` (${includedCount} included)`
                              : ""}
                          </p>
                        ) : (
                          <ul
                            className={`grid gap-2 ${
                              isEncountered
                                ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
                                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                            }`}
                          >
                            {list.map((mon, index) => {
                              const reviewStatus = saveReview.byDraftKey.get(
                                draftReviewKey(key, index),
                              );
                              const detailLine = [
                                mon.nature,
                                mon.ability,
                                mon.moves.length
                                  ? resolveMoveNames(mon.moves).join(" · ")
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ");
                              const changeBit = reviewStatus?.changeLabels
                                .length
                                ? reviewStatus.changeLabels.join(" · ")
                                : "";
                              return (
                                <li
                                  key={`${key}-${mon.pid}-${index}`}
                                  className={`flex flex-col gap-1.5 rounded-lg border border-frame/70 bg-surface-2 p-2 ${
                                    mon.include ? "" : "opacity-45"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <input
                                      type="checkbox"
                                      className="shrink-0"
                                      checked={mon.include}
                                      disabled={busy}
                                      onChange={(e) =>
                                        updateDraft(key, index, {
                                          include: e.target.checked,
                                        })
                                      }
                                      aria-label={`Include ${mon.nickname.trim() || mon.species}`}
                                    />
                                    {mon.include
                                      ? statusChip(reviewStatus?.kind)
                                      : null}
                                  </div>
                                  <div className="flex justify-center py-0.5">
                                    <PokemonSpriteImage
                                      alt=""
                                      className="pixelated h-11 w-11"
                                      height={44}
                                      pokedexId={mon.pokedexId}
                                      shiny={mon.isShiny}
                                      species={mon.species}
                                      width={44}
                                    />
                                  </div>
                                  <label className="relative block">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-1.5 text-muted/50">
                                      <NicknameEditIcon className="h-3.5 w-3.5" />
                                    </span>
                                    <input
                                      value={mon.nickname}
                                      placeholder={mon.species}
                                      disabled={busy}
                                      aria-label={`Nickname for ${mon.species}`}
                                      title="Editable nickname"
                                      className="w-full rounded-md border border-frame/70 bg-surface px-6 py-1 text-center text-xs disabled:opacity-60 sm:text-sm"
                                      onChange={(e) =>
                                        updateDraft(key, index, {
                                          nickname: e.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <p
                                    className="truncate text-center text-[0.7rem] text-muted"
                                    title={detailLine || undefined}
                                  >
                                    {mon.species}
                                    {" · "}
                                    {levelCaption(mon.level)}
                                    {mon.isShiny ? " · shiny" : ""}
                                  </p>
                                  {changeBit ? (
                                    <p className="truncate text-center text-[0.7rem] text-accent-ink">
                                      {changeBit}
                                    </p>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })}

                  {saveReview.cleared.length > 0 && (
                    <section className="space-y-2.5">
                      <h3 className="text-sm font-semibold tracking-tight text-ink">
                        Leaving the board{" "}
                        <span className="font-normal text-muted">
                          ({saveReview.cleared.length})
                        </span>
                      </h3>
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {saveReview.cleared.map(({ board, nullPid }) => (
                          <li
                            key={board.id}
                            className="flex flex-col items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/5 p-2"
                          >
                            <Chip tone="warn">
                              {nullPid ? "Replace" : "Clear"}
                            </Chip>
                            <PokemonSpriteImage
                              alt=""
                              className="pixelated h-11 w-11 opacity-80"
                              height={44}
                              pokedexId={board.pokedexId ?? 0}
                              shiny={board.isShiny}
                              species={board.species}
                              width={44}
                            />
                            <p className="w-full truncate text-center text-sm font-semibold tracking-tight text-ink">
                              {board.nickname?.trim() || board.species}
                            </p>
                            <p className="w-full truncate text-center text-[0.7rem] text-muted">
                              {board.species}
                              {board.level != null
                                ? ` · Lv ${board.level}`
                                : ""}
                              {" · "}
                              {board.slot === "MAIN" ? "Main" : "Reserves"}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs leading-relaxed text-muted">
                        Not in this save’s living party/box
                        {ripIncluded > 0 ? " or R.I.P." : ""}. Open Survive/Die
                        bets on cleared Pokémon will be voided.
                      </p>
                    </section>
                  )}

                  <div className="space-y-1.5 rounded-lg border border-frame/50 bg-surface-2/50 px-3 py-2.5 text-xs leading-relaxed text-muted sm:text-sm">
                    {saveReview.hasBoardLiving &&
                      (saveReview.updated > 0 ||
                        saveReview.created > 0 ||
                        saveReview.died > 0 ||
                        saveReview.cleared.length > 0) && (
                        <p>
                          Matched Main/Reserves{" "}
                          <span className="font-semibold text-ink">
                            update in place
                          </span>
                          {saveReview.updated > 0
                            ? ` (${saveReview.updated})`
                            : ""}
                          — Survive/Die stays open. New PIDs are added
                          {saveReview.created > 0
                            ? ` (${saveReview.created})`
                            : ""}
                          .
                          {saveReview.died > 0
                            ? ` ${saveReview.died} living → R.I.P. resolve as Die.`
                            : ""}
                          {saveReview.cleared.length > 0
                            ? ` ${saveReview.cleared.length} leave the board (open bets void).`
                            : ""}
                        </p>
                      )}
                    {(saveReview.memorialUpdated > 0 ||
                      saveReview.memorialCreated > 0) && (
                      <p>
                        Matched R.I.P.{" "}
                        <span className="font-semibold text-ink">
                          refresh in place
                        </span>
                        {saveReview.memorialUpdated > 0
                          ? ` (${saveReview.memorialUpdated})`
                          : ""}
                        without overwriting cause of death or notes.
                        {saveReview.memorialCreated > 0
                          ? ` ${saveReview.memorialCreated} new memorial ${
                              saveReview.memorialCreated === 1
                                ? "entry"
                                : "entries"
                            } append.`
                          : ""}
                      </p>
                    )}
                    {!saveReview.hasBoardLiving && partyBoxIncluded > 0 && (
                      <p>
                        Included Main/Reserves will be written to the board.
                      </p>
                    )}
                    {encounteredIncluded > 0 && (
                      <p>
                        Encountered will{" "}
                        <span className="font-semibold text-ink">replace</span>{" "}
                        your current Encountered list.
                      </p>
                    )}
                    {ripIncluded > 0 &&
                      saveReview.memorialUpdated === 0 &&
                      saveReview.memorialCreated === 0 && (
                      <p>
                        R.I.P.{" "}
                        <span className="font-semibold text-ink">appends</span>{" "}
                        to the memorial (duplicates skipped); existing graves
                        stay.
                      </p>
                    )}
                    {!partyBoxIncluded &&
                      !encounteredIncluded &&
                      !ripIncluded &&
                      saveReview.cleared.length === 0 && (
                        <p>
                          No Pokémon selected — only checked trainer syncs will
                          apply.
                        </p>
                      )}
                  </div>
                </div>
              )}
            </div>
        </>
      </div>
    </Modal>
  );
}
