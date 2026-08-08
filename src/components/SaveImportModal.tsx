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
  encounteredImportHasDelta,
  importReviewPreviewParts,
  isHighlightReviewStatus,
  isIdenticalPokemonReview,
  trainerSyncHasDelta,
  type ImportDraftReviewStatus,
  type SaveImportBoardEncounter,
  type SaveImportBoardGrave,
  type SaveImportBoardLiving,
  type SaveImportBoardTrainer,
} from "@/lib/import-save-review";
import { catchGradeFor } from "@/lib/pokemon-grades";
import { catchTierHasChrome, catchTierTip } from "@/lib/iv-quality";
import { summarizeEncounterFlagBits } from "@/lib/personal-routes";
import { resolveMoveNames } from "@/lib/move-names";
import {
  BadgesIcon,
  CaughtIcon,
  MoneyIcon,
  PlayTimeIcon,
  ReviveIcon,
  TrainerNameIcon,
} from "@/components/trainer-stat-icons";

export type {
  SaveImportBoardEncounter,
  SaveImportBoardGrave,
  SaveImportBoardLiving,
  SaveImportBoardTrainer,
};

/** Cap matches server import proof limit (under server-action body size). */
const MAX_SAVE_PROOF_BYTES = 3 * 1024 * 1024;
/** Parse ceiling — party/box still work from large emulator dumps. */
const MAX_SAVE_PARSE_BYTES = 32 * 1024 * 1024;

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
  /** Existing Encountered strip for same-save fingerprinting. */
  boardEncountered?: SaveImportBoardEncounter[];
  /** Current trainer sync fields (badges / money / playtime / …). */
  boardTrainer?: SaveImportBoardTrainer | null;
  /**
   * False while deferred Reserves / R.I.P. / Encountered are still loading —
   * preview may under-count until ready.
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
  title,
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "muted" | "info";
  title?: string;
  className?: string;
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
      title={title}
      className={`inline-flex items-center rounded-md border px-2 py-1 text-[0.7rem] font-semibold tracking-tight ${toneClass} ${
        title ? "cursor-help" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}

function draftReviewKey(category: SaveMonCategory, index: number): string {
  return `${category}:${index}`;
}

function statusChip(
  kind: ImportDraftReviewStatus["kind"] | undefined,
  changeLabels: string[] = [],
): ReactNode {
  if (!kind || kind === "add" || kind === "same") return null;
  if (kind === "changed") {
    const tip = changeLabels.length ? changeLabels.join(" · ") : undefined;
    return (
      <Chip tone="ok" title={tip}>
        Updated!
      </Chip>
    );
  }
  if (kind === "new") return <Chip tone="info">New Catch!</Chip>;
  return <Chip tone="warn">R.I.P.</Chip>;
}

function deltaCardClass(
  kind: ImportDraftReviewStatus["kind"] | undefined,
  muted?: boolean,
): string {
  const base = `relative flex flex-col gap-1 rounded-md border bg-surface-2 p-1.5 ${
    muted ? "opacity-55" : ""
  }`;
  if (kind === "changed") {
    return `${base} import-delta-card import-delta-card--updated`;
  }
  if (kind === "new") {
    return `${base} import-delta-card import-delta-card--new`;
  }
  if (kind === "died") {
    return `${base} import-delta-card import-delta-card--rip`;
  }
  return `${base} border-frame/60`;
}

function sectionDeltaSummary(
  list: SaveImportDraft[],
  category: SaveMonCategory,
  review: ReturnType<typeof buildImportSaveReview>,
): string {
  let changed = 0;
  let neu = 0;
  let died = 0;
  let same = 0;
  for (let i = 0; i < list.length; i++) {
    const st = review.byDraftKey.get(draftReviewKey(category, i));
    if (!st) continue;
    if (st.kind === "changed") changed += 1;
    else if (st.kind === "new") neu += 1;
    else if (st.kind === "died") died += 1;
    else if (st.kind === "same") same += 1;
  }
  const bits: string[] = [];
  if (changed) bits.push(`${changed} updated`);
  if (neu) bits.push(`${neu} new`);
  if (died) bits.push(`${died} R.I.P.`);
  if (same && bits.length === 0) bits.push(`${same} matched`);
  else if (same && (changed || neu || died)) bits.push(`${same} same`);
  return bits.join(" · ");
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

/** Soft blur + pocket-spin while the import action resolves. */
function SyncingOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-surface/55 px-4 backdrop-blur-[3px] motion-safe:animate-[search-scrim-in_160ms_ease-out]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-frame/60 bg-surface/95 px-6 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
        <div className="relative h-12 w-12" aria-hidden>
          <span className="nuzlocke-cloud-bridge-spinner absolute inset-0 !h-12 !w-12 border-[2.5px]" />
          <span className="absolute inset-[0.7rem] rounded-full bg-accent/25 motion-safe:animate-pulse" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
        </div>
        <p className="text-sm font-semibold tracking-tight text-ink">{label}</p>
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[assist-dot_1s_ease-in-out_infinite]" />
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[assist-dot_1s_ease-in-out_infinite]"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-[assist-dot_1s_ease-in-out_infinite]"
            style={{ animationDelay: "320ms" }}
          />
        </div>
      </div>
    </div>
  );
}

export function SaveImportModal({
  open,
  pending = false,
  boardLiving = [],
  boardGraves = [],
  boardEncountered = [],
  boardTrainer = null,
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
      setSections({
        party: categoryToDrafts(result.party, "MAIN"),
        box: categoryToDrafts(result.box, "RESERVE"),
        rip: categoryToDrafts(result.rip, "GRAVEYARD"),
        encountered: categoryToDrafts(result.encountered, "ENCOUNTERED"),
      });
      // Compact delta brief at render — save is source of truth for roster.
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
  const pokemonIdentical =
    isReimport && boardLivingReady && isIdenticalPokemonReview(saveReview);
  const encounteredDelta =
    sections != null &&
    encounteredImportHasDelta(
      boardEncountered,
      CATEGORY_META.flatMap(({ key }) =>
        sections[key].map((d) => ({
          include: d.include,
          slot: d.slot,
          species: d.species,
          nickname: d.nickname,
          pokedexId: d.pokedexId,
          isShiny: d.isShiny,
          catchRoute: d.catchRoute,
        })),
      ),
    );
  const trainerDelta =
    boardTrainer != null &&
    trainerSyncHasDelta(boardTrainer, {
      applyTrainerName: Boolean(applyTrainerName && trainerName),
      trainerName,
      applyBadges: Boolean(applyBadges && badgesReliable),
      badgeKeys,
      applyRevive: Boolean(
        applyRevive && reviveReliable && reviveUsed != null,
      ),
      reviveUsed,
      applyMoney: Boolean(applyMoney && moneyReliable && money != null),
      money,
      applyPlayTime: Boolean(
        applyPlayTime && playTimeReliable && playTimeSeconds != null,
      ),
      playTimeSeconds,
      applyEncounterFlags: Boolean(
        applyEncounterFlags &&
          encounterFlagsReliable &&
          nuzlockeEncounterBits != null,
      ),
      nuzlockeEncounterBits,
    });
  const sameSaveDetected =
    pokemonIdentical && !encounteredDelta && !trainerDelta;

  const applyPreviewParts = importReviewPreviewParts(saveReview, {
    encounteredIncluded: encounteredDelta ? encounteredIncluded : 0,
    ripIncluded:
      saveReview.memorialCreated > 0 || saveReview.memorialChanged > 0
        ? ripIncluded
        : 0,
    trainerSyncParts: trainerDelta ? trainerSyncParts : [],
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
  const applyPreview = sameSaveDetected
    ? "Same save file detected!"
    : applyPreviewParts.join(" · ") || "Nothing selected to apply";

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

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  const canApply =
    Boolean(sections) &&
    !busy &&
    !sameSaveDetected &&
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
    : sameSaveDetected
      ? "Nothing to update"
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

  function syncChipClass(reliable: boolean, checked: boolean): string {
    return `inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
      !reliable
        ? "cursor-not-allowed border-frame/30 bg-surface/40 text-muted opacity-60"
        : checked
          ? "cursor-pointer border-accent/35 bg-accent/10 text-ink hover:border-accent/55 hover:bg-accent/20"
          : "cursor-pointer border-frame/50 bg-surface-2 text-muted hover:border-frame hover:bg-surface hover:text-ink"
    }`;
  }

  const honestyBits: string[] = [];
  if (sameSaveDetected) {
    honestyBits.push("No Pokémon or trainer changes vs this board");
  } else {
    if (saveReview.hasBoardLiving) honestyBits.push("Matched update in place");
    if (
      saveReview.memorialCreated > 0 ||
      saveReview.memorialChanged > 0
    ) {
      honestyBits.push("R.I.P. append");
    }
    if (encounteredDelta) honestyBits.push("Encountered replace");
    if (!honestyBits.length && partyBoxIncluded > 0) {
      honestyBits.push("Write Pokémon from save");
    }
  }
  const honesty = honestyBits.join(" · ");

  const ownedCatchRoutesForFlags = sections
    ? (["party", "box", "rip"] as const).flatMap((cat) =>
        sections[cat]
          .map((d) => d.catchRoute?.trim())
          .filter((route): route is string => Boolean(route)),
      )
    : [];
  const encounterFlagSummary =
    encounterFlagsReliable && nuzlockeEncounterBits != null
      ? summarizeEncounterFlagBits(
          nuzlockeEncounterBits,
          ownedCatchRoutesForFlags,
        )
      : null;

  return (
    <Modal
      open={open}
      title={modalTitle}
      size="wide"
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
                if (!canApply || sameSaveDetected) return;
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
      <div className="relative flex min-h-0 flex-1 flex-col text-sm">
        {pending ? (
          <SyncingOverlay
            label={isReimport ? "Updating board…" : "Importing save…"}
          />
        ) : null}
        <div
          className={`flex min-h-0 flex-1 flex-col ${
            pending ? "pointer-events-none select-none" : ""
          }`}
          aria-hidden={pending || undefined}
        >
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
            <div className="shrink-0 space-y-2 border-b border-frame/50 px-4 py-2.5 sm:px-5">
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
                      {sameSaveDetected
                        ? " · same as board"
                        : isReimport
                          ? " · updating board"
                          : " · ready to import"}
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
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {trainerUnavailable.length > 0 ? (
                      <Chip tone="muted">
                        Missing {trainerUnavailable.join(", ")}
                      </Chip>
                    ) : null}
                    {warnings.length > 0 && (
                      <button
                        type="button"
                        className="pressable rounded-md border border-frame/50 bg-surface px-2 py-0.5 text-[0.7rem] font-semibold tracking-tight text-muted"
                        onClick={() => setParserNotesOpen((o) => !o)}
                      >
                        {parserNotesOpen
                          ? "Hide notes"
                          : `Notes (${warnings.length})`}
                      </button>
                    )}
                    {!boardLivingReady && isReimport ? (
                      <span className="text-[0.7rem] text-muted">
                        Loading board for match preview…
                      </span>
                    ) : null}
                    {sameSaveDetected ? (
                      <Chip tone="muted">Same save file detected!</Chip>
                    ) : null}
                  </div>
                  {parserNotesOpen && warnings.length > 0 && (
                    <ul className="max-h-24 space-y-1 overflow-y-auto rounded-md border border-frame/40 bg-surface-2/80 px-2.5 py-1.5 text-[0.7rem] leading-snug text-muted">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            )}

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
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
                          the save. Nickname is the only override — rearrange
                          on the board after import. On re-import,
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
                  className={`space-y-3 ${
                    parseReveal
                      ? "motion-safe:animate-[search-panel-in_180ms_cubic-bezier(0.22,1,0.36,1)]"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {trainerName ? (
                      <label
                        className={syncChipClass(true, applyTrainerName)}
                        title="Trainer name"
                      >
                        <input
                          type="checkbox"
                          className="shrink-0"
                          checked={applyTrainerName}
                          disabled={busy}
                          onChange={(e) =>
                            setApplyTrainerName(e.target.checked)
                          }
                        />
                        <TrainerNameIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-semibold tracking-tight">
                          {trainerName}
                        </span>
                      </label>
                    ) : null}

                    <label
                      className={syncChipClass(
                        badgesReliable,
                        applyBadges && badgesReliable,
                      )}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={applyBadges && badgesReliable}
                        disabled={!badgesReliable || busy}
                        onChange={(e) => setApplyBadges(e.target.checked)}
                      />
                      <BadgesIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold tracking-tight">
                        {badgesReliable
                          ? `${badgeKeys.length} badges`
                          : "Badges —"}
                      </span>
                    </label>

                    <label
                      className={syncChipClass(
                        reviveReliable,
                        applyRevive && reviveReliable,
                      )}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={applyRevive && reviveReliable}
                        disabled={
                          !reviveReliable || reviveUsed == null || busy
                        }
                        onChange={(e) => setApplyRevive(e.target.checked)}
                      />
                      <ReviveIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold tracking-tight">
                        {reviveReliable && reviveUsed != null
                          ? reviveUsed
                            ? "Revive used"
                            : "Revive ready"
                          : "Revive —"}
                      </span>
                    </label>

                    <label
                      className={syncChipClass(
                        moneyReliable,
                        applyMoney && moneyReliable,
                      )}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={applyMoney && moneyReliable}
                        disabled={!moneyReliable || money == null || busy}
                        onChange={(e) => setApplyMoney(e.target.checked)}
                      />
                      <MoneyIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold tracking-tight">
                        {moneyReliable && money != null
                          ? formatPokedollars(money)
                          : "Money —"}
                      </span>
                    </label>

                    <label
                      className={syncChipClass(
                        playTimeReliable,
                        applyPlayTime && playTimeReliable,
                      )}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={applyPlayTime && playTimeReliable}
                        disabled={
                          !playTimeReliable ||
                          playTimeSeconds == null ||
                          busy
                        }
                        onChange={(e) => setApplyPlayTime(e.target.checked)}
                      />
                      <PlayTimeIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold tracking-tight">
                        {playTimeReliable && playTimeSeconds != null
                          ? formatPlayTime(playTimeSeconds)
                          : "Playtime —"}
                      </span>
                    </label>

                    <label
                      className={syncChipClass(
                        encounterFlagsReliable,
                        applyEncounterFlags && encounterFlagsReliable,
                      )}
                      title={
                        encounterFlagSummary
                          ? `${encounterFlagSummary.exhausted - encounterFlagSummary.failed} caught (owned on that slot) · ${encounterFlagSummary.failed} got away (flag set, no Pokémon) · ${encounterFlagSummary.exhausted} exhausted total`
                          : encounterFlagsReliable
                            ? "Sync Nuzlocke encounter flags from the save"
                            : "Encounter flags unavailable in this save"
                      }
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={
                          applyEncounterFlags && encounterFlagsReliable
                        }
                        disabled={!encounterFlagsReliable || busy}
                        onChange={(e) =>
                          setApplyEncounterFlags(e.target.checked)
                        }
                      />
                      <CaughtIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold tracking-tight">
                        {encounterFlagSummary
                          ? `${encounterFlagSummary.exhausted - encounterFlagSummary.failed} caught · ${encounterFlagSummary.failed} got away`
                          : "Flags —"}
                      </span>
                    </label>
                  </div>

                  {honesty ? (
                    <p className="text-[0.7rem] leading-snug text-muted">
                      {honesty}
                    </p>
                  ) : null}

                  {CATEGORY_META.map(({ key, title }) => {
                    const list = sections[key];
                    if (list.length === 0) return null;

                    const isEncountered = key === "encountered";
                    const indexed = list.map((mon, index) => ({
                      mon,
                      index,
                      status: saveReview.byDraftKey.get(
                        draftReviewKey(key, index),
                      ),
                    }));
                    const deltaBit = isReimport
                      ? sectionDeltaSummary(list, key, saveReview)
                      : "";
                    const highlightRows = indexed.filter(({ status }) =>
                      isHighlightReviewStatus(status),
                    );
                    const sameRows = indexed.filter(
                      ({ status }) => status?.kind === "same",
                    );
                    const otherRows = indexed.filter(({ status }) => {
                      if (!isReimport) return true;
                      if (isHighlightReviewStatus(status)) return false;
                      if (status?.kind === "same") return false;
                      return true;
                    });
                    const useCompactRoster = isReimport && !isEncountered;

                    function renderMonCard(
                      mon: SaveImportDraft,
                      index: number,
                      status: ImportDraftReviewStatus | undefined,
                      muted = false,
                    ) {
                      const changeLabels = status?.changeLabels ?? [];
                      const changeBit = changeLabels.length
                        ? changeLabels.join(" · ")
                        : "";
                      const chip = statusChip(status?.kind, changeLabels);
                      // Catch wash only on true deltas — matched sprites stay plain.
                      const catchGrade = isHighlightReviewStatus(status)
                        ? catchGradeFor({
                            pokedexId: mon.pokedexId,
                            nature: mon.nature,
                            ability: mon.ability,
                            ivs: mon.ivs,
                            evs: mon.evs,
                            friendship: mon.friendship,
                          })
                        : null;
                      const catchTier = catchGrade?.tier ?? null;
                      const hasCatchChrome =
                        catchTier != null && catchTierHasChrome(catchTier);
                      const catchTip =
                        catchTier != null
                          ? catchTierTip(catchTier, catchGrade?.score)
                          : undefined;
                      const washClass =
                        hasCatchChrome && catchTier
                          ? `import-catch-wash import-catch-wash--${catchTier}`
                          : "";

                      return (
                        <li
                          key={`${key}-${mon.pid}-${index}`}
                          className={`${deltaCardClass(status?.kind, muted)} ${washClass}`.trim()}
                          title={catchTip}
                        >
                          {chip ? (
                            <div className="absolute right-1.5 top-1.5 z-[2] origin-top-right scale-90">
                              {chip}
                            </div>
                          ) : null}
                          <div className="flex justify-center pt-5">
                            <PokemonSpriteImage
                              alt=""
                              className="pixelated h-14 w-14"
                              height={56}
                              pokedexId={mon.pokedexId}
                              shiny={mon.isShiny}
                              species={mon.species}
                              width={56}
                            />
                          </div>
                          <label className="relative block">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-1 text-muted/50">
                              <NicknameEditIcon className="h-3 w-3" />
                            </span>
                            <input
                              value={mon.nickname}
                              placeholder={mon.species}
                              disabled={busy}
                              aria-label={`Nickname for ${mon.species}`}
                              title="Editable nickname"
                              className="w-full rounded border border-frame/60 bg-surface py-0.5 pl-5 pr-1 text-center text-[0.7rem] disabled:opacity-60 sm:text-xs"
                              onChange={(e) =>
                                updateDraft(key, index, {
                                  nickname: e.target.value,
                                })
                              }
                            />
                          </label>
                          <p
                            className="truncate text-center text-[0.65rem] leading-tight text-muted"
                            title={changeBit || undefined}
                          >
                            {mon.species}
                            {" · "}
                            {levelCaption(mon.level)}
                            {mon.isShiny ? " · shiny" : ""}
                          </p>
                        </li>
                      );
                    }

                    function renderSpriteStrip(
                      rows: {
                        mon: SaveImportDraft;
                        index: number;
                        status: ImportDraftReviewStatus | undefined;
                      }[],
                    ) {
                      return (
                        <ul className="flex flex-wrap items-center gap-0.5">
                          {rows.map(({ mon, index, status }) => {
                            const label =
                              mon.nickname.trim() || mon.species;
                            const tip = [
                              label,
                              mon.species,
                              levelCaption(mon.level),
                              status?.kind === "changed"
                                ? "Updated!"
                                : status?.kind === "new"
                                  ? "New Catch!"
                                  : status?.kind === "died"
                                    ? "R.I.P."
                                    : status?.kind === "same"
                                      ? "matched"
                                      : null,
                            ]
                              .filter(Boolean)
                              .join(" · ");
                            return (
                              <li
                                key={`${key}-strip-${mon.pid}-${index}`}
                                className="opacity-80"
                                title={tip}
                              >
                                <PokemonSpriteImage
                                  alt=""
                                  className="pixelated h-12 w-12"
                                  height={48}
                                  pokedexId={mon.pokedexId}
                                  shiny={mon.isShiny}
                                  species={mon.species}
                                  width={48}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      );
                    }

                    return (
                      <section key={key} className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 text-sm font-semibold tracking-tight text-ink">
                            {title}{" "}
                            <span className="font-normal text-muted">
                              ({list.length})
                            </span>
                            {deltaBit ? (
                              <span className="ml-1.5 font-normal text-accent-ink">
                                · {deltaBit}
                              </span>
                            ) : null}
                          </h3>
                        </div>

                        {useCompactRoster ? (
                          <div className="space-y-2">
                            {highlightRows.length > 0 ? (
                              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {highlightRows.map(
                                  ({ mon, index, status }) =>
                                    renderMonCard(mon, index, status),
                                )}
                              </ul>
                            ) : null}
                            {sameRows.length > 0
                              ? renderSpriteStrip(sameRows)
                              : null}
                            {otherRows.length > 0 ? (
                              <div className="opacity-60">
                                {renderSpriteStrip(otherRows)}
                              </div>
                            ) : null}
                            {highlightRows.length === 0 &&
                            sameRows.length === 0 &&
                            otherRows.length === 0 ? (
                              <p className="text-[0.7rem] text-muted">
                                No Pokémon in this section.
                              </p>
                            ) : null}
                          </div>
                        ) : isEncountered ? (
                          <div className="rounded-md border border-frame/40 bg-surface-2/60 px-2.5 py-1.5">
                            <p className="text-[0.7rem] text-muted">
                              {list.length} species · will replace Encountered
                            </p>
                          </div>
                        ) : (
                          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {indexed.map(({ mon, index, status }) =>
                              renderMonCard(mon, index, status),
                            )}
                          </ul>
                        )}
                      </section>
                    );
                  })}

                  {saveReview.cleared.length > 0 && (
                    <section className="space-y-1.5">
                      <h3 className="text-sm font-semibold tracking-tight text-ink">
                        Leaving the board{" "}
                        <span className="font-normal text-muted">
                          ({saveReview.cleared.length})
                        </span>
                      </h3>
                      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {saveReview.cleared.map(({ board, nullPid }) => (
                          <li
                            key={board.id}
                            className="flex flex-col items-center gap-1 rounded-md border border-danger/25 bg-danger/5 p-1.5"
                          >
                            <Chip tone="warn">
                              {nullPid ? "Replace" : "Clear"}
                            </Chip>
                            <PokemonSpriteImage
                              alt=""
                              className="pixelated h-14 w-14 opacity-80"
                              height={56}
                              pokedexId={board.pokedexId ?? 0}
                              shiny={board.isShiny}
                              species={board.species}
                              width={56}
                            />
                            <p className="w-full truncate text-center text-xs font-semibold tracking-tight text-ink">
                              {board.nickname?.trim() || board.species}
                            </p>
                            <p className="w-full truncate text-center text-[0.65rem] text-muted">
                              {board.species}
                              {board.level != null
                                ? ` · Lv ${board.level}`
                                : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[0.7rem] leading-snug text-muted">
                        Not in this save
                        {ripIncluded > 0 ? " or R.I.P." : ""}. Open Survive/Die
                        bets void.
                      </p>
                    </section>
                  )}
                </div>
              )}
            </div>
        </>
        </div>
      </div>
    </Modal>
  );
}
