"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  deletePokemonAction,
  gmResetTrainerBoardAction,
  importFromSaveAction,
  recordFinalTeamAction,
  relocatePokemonAction,
  startNewRunAction,
  updateTrainerBoardAction,
  upsertPokemonAction,
} from "@/app/actions/challenge";
import { fetchToolsPokemonEntryAction } from "@/app/actions/tools-pokemon";
import { fetchTrainerBoardSlotAction } from "@/app/actions/trainer-board";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { BadgeCase } from "@/components/BadgeCase";
import { BadgeCaseEditor } from "@/components/BadgeCaseEditor";
import { BoardHistoryModal } from "@/components/BoardHistoryModal";
import { EndRunModal } from "@/components/EndRunModal";
import { Frame, frameCountTitle } from "@/components/Frame";
import {
  EMPTY_POKEMON_FORM,
  PokemonFormModal,
  pokemonEntryToForm,
  pokemonFormToEntry,
  type PokemonFormState,
} from "@/components/PokemonFormModal";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PartyBoardDnd } from "@/components/PartyBoardDnd";
import { PartyStrip } from "@/components/PartyStrip";
import { EncounteredSpeciesStrip } from "@/components/EncounteredSpeciesStrip";
import { PlayerCustomizationEditor } from "@/components/PlayerCustomizationEditor";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { ReviveToken } from "@/components/ReviveToken";
import { SaveImportModal } from "@/components/SaveImportModal";
import { SaveStatus, useSaveStatus } from "@/components/SaveStatus";
import { Skeleton } from "@/components/Skeleton";
import { StatusLine } from "@/components/StatusLine";
import { TeamExportModal } from "@/components/TeamExportModal";
import { TrainerStatsSummary } from "@/components/TrainerStatsSummary";
import { pushSnackbar } from "@/components/Snackbar";
import { useSearch } from "@/features/search/SearchProvider";
import {
  isAvatarBackgroundKey,
  parseAvatarBackgroundKey,
} from "@/data/avatar-backgrounds";
import {
  isCardBackgroundKey,
  parseCardBackgroundKey,
} from "@/data/card-backgrounds";
import type {
  BadgeDefinition,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import {
  CHAMPIONSHIP_BADGE_KEYS,
  hasBeatenChampionship,
} from "@/lib/championship";
import { copyText } from "@/lib/copy-text";
import { EMERALD_BADGE_META } from "@/lib/emerald-badges";
import { pokemonInSlot } from "@/lib/trainer-display";
import { memorialPokemonAfterWipe } from "@/lib/wipe-memorial";
import { RulesIcon } from "@/components/nav-icons";
import { SeasonStatsToolIcon } from "@/components/tool-icons";
import { CTA_PRIMARY_SM } from "@/lib/cta";
import { seasonStatsHref } from "@/lib/tools-routes";
import {
  MAIN_PARTY_SIZE,
  firstOpenMainPartyIndex,
} from "@/lib/pokemon-board-dnd";
import { isEmptySpread } from "@/lib/stats";
import {
  TrainerBoardActionsMenu,
  type TrainerBoardMenuItem,
} from "@/components/TrainerBoardActionsMenu";
import {
  TRAINER_BOARD_OVERFLOW_ACTIONS,
  TRAINER_BOARD_PRIMARY_ACTIONS,
  type TrainerBoardActionKey,
} from "@/lib/trainer-board-actions";
import { trainerBoardPath } from "@/lib/team-export";

type TrainerBoardProps = {
  leagueBoardHref: string;
  leagueBoardLabel: string;
  joinHref: string;
  /** When set, demo boards point signed-in players at their own board instead of login. */
  myBoardHref?: string | null;
  challengeSlug: string;
  challengeName: string;
  challengeGame: string;
  trainer: TrainerProfile;
  badges: BadgeDefinition[];
  canEdit: boolean;
  /**
   * Show nature / ability / stats / moves. True for the board owner and GMs,
   * including when the season is read-only (canEdit false).
   */
  showCompetitiveDetails?: boolean;
  isGm: boolean;
  isDemo: boolean;
  /** Soft CTA glow on Import save until the first successful import. */
  encourageImportSave?: boolean;
  /** Survive/Die polls on living MAIN + RESERVE. */
  survivalMarketsEnabled?: boolean;
  /** Signed-in viewer — highlight on resolved poll roster. */
  viewerUserId?: string | null;
};

function PencilIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.5 1.5 14.5 4.5 5.75 13.25 2.5 13.5l.25-3.25L11.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 3 13 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ImportSaveIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 7 8 9.5 10.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Finish line — ending the attempt, however it ended. */
function EndRunIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 14V2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3.5 3.25h9v6h-9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3.5 6.25h9M8 3.25v6" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function WipeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 8A5 5 0 1 1 11.7 4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 2.5V6H9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** GM hard reset — blank slate (distinct from wipe’s restart arrow). */
function ResetBoardIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="3"
        width="11"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 11.5 11 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoardHistoryIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 2.5h6.2L12.5 5.3v8.2H3.5V2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 2.5V5.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 8.5h5M5.5 11h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExportTeamIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 9.5V2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 4.5 8 2 10.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 9.5v2a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 11.5v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyLinkIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 8.5a2.5 2.5 0 0 0 1.8.7h1.2a2.5 2.5 0 0 0 0-5H8.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.5 7.5a2.5 2.5 0 0 0-1.8-.7H6.5a2.5 2.5 0 0 0 0 5h1.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReviveShortcutIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  );
}

function FaqShortcutIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path
        d="M9.8 9.6a2.4 2.4 0 114.2 1.6c-.7.8-1.5 1.2-1.5 2.3"
        strokeLinecap="round"
      />
      <path d="M12 16.75v.5" strokeLinecap="round" />
    </svg>
  );
}

function ToolsShortcutIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M14.5 6.5l3 3-8.5 8.5H6v-3L14.5 6.5z" strokeLinejoin="round" />
      <path d="M12.5 8.5l3 3" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="2.25" />
      <path d="M16.5 16.5l2 2" strokeLinecap="round" />
    </svg>
  );
}

function EncountersShortcutIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h10M4 17h13" strokeLinecap="round" />
      <circle cx="18.5" cy="12" r="2.25" />
    </svg>
  );
}

const shortcutTileBase =
  "pressable flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius)] border px-2 text-center text-[11px] font-semibold leading-tight tracking-tight sm:text-xs";

const shortcutActionRowBase =
  "inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border px-3 text-xs font-semibold tracking-tight";

const shortcutActionButtonBase = `pressable ${shortcutActionRowBase} disabled:opacity-60`;

/** Quiet nav tiles — read as destinations, not actions. */
const shortcutLinkClass = `${shortcutTileBase} border-dashed border-frame/55 bg-transparent text-muted hover:border-frame hover:bg-surface-2/70 hover:text-ink`;

function shortcutActionToneClass(
  tone: "accent" | "danger" | "import" | "neutral" = "neutral",
  options?: { firstImport?: boolean },
) {
  switch (tone) {
    case "accent":
      return "border-accent/35 bg-accent/15 text-accent-deep hover:brightness-105";
    case "danger":
      return "border-danger/35 bg-danger/15 text-danger hover:brightness-105";
    case "import":
      return `cta-import-save border-frame bg-surface text-ink shadow-sm${
        options?.firstImport ? " is-first-import" : ""
      }`;
    default:
      return "border-frame bg-surface text-ink shadow-sm hover:bg-surface-2";
  }
}

function ShortcutLinkTile({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link href={href} className={shortcutLinkClass}>
      <span className="shrink-0 text-muted/80" aria-hidden>
        {icon}
      </span>
      <span className="max-w-full px-0.5">{label}</span>
    </Link>
  );
}

function ShortcutActionTile({
  label,
  icon,
  onClick,
  disabled,
  title,
  tone = "neutral",
  firstImport = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "accent" | "danger" | "import" | "neutral";
  firstImport?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`${shortcutActionButtonBase} ${shortcutActionToneClass(tone, { firstImport })}`}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function SaveIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 2.5h8.5L13.5 5v8.5H3V2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 2.5v4h5v-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 11h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeaderButton({
  children,
  onClick,
  disabled,
  tone = "ghost",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "ghost" | "primary";
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={
        tone === "primary"
          ? `${CTA_PRIMARY_SM} gap-1.5 disabled:opacity-60`
          : "pressable inline-flex items-center gap-1 border-white/25 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold tracking-tight text-white hover:bg-black/45 disabled:opacity-60"
      }
    >
      {children}
    </button>
  );
}

export function TrainerBoard({
  leagueBoardHref,
  leagueBoardLabel,
  joinHref,
  myBoardHref = null,
  challengeSlug,
  challengeName,
  challengeGame,
  trainer,
  badges,
  canEdit,
  showCompetitiveDetails = canEdit,
  isGm,
  isDemo,
  encourageImportSave = false,
  survivalMarketsEnabled = true,
  viewerUserId = null,
}: TrainerBoardProps) {
  const [editingPlayer, setEditingPlayer] = useState(false);

  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const {
    pendingBoardAction,
    clearBoardAction,
    season: searchSeason,
  } = useSearch();
  const playerSave = useSaveStatus();
  const partySave = useSaveStatus();
  const reviveSave = useSaveStatus();
  const wipeSave = useSaveStatus();
  const resetSave = useSaveStatus();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [importSaveGlow, setImportSaveGlow] = useState(encourageImportSave);

  const [endRunOpen, setEndRunOpen] = useState(false);
  /** Optimistic "run is over" until the RSC refresh carries runEnded. */
  const [runEndedOverride, setRunEndedOverride] = useState<boolean | null>(
    null,
  );

  // Include slot/partyIndex — wipe/reset clear or rewrite the board.
  const serverStamp = `${trainer.updatedAt ?? ""}|${trainer.handle}|${trainer.statusText ?? ""}|${trainer.statusEmoji ?? ""}|${trainer.realName ?? ""}|${trainer.avatarSpriteKey}|${trainer.avatarBackgroundKey ?? ""}|${trainer.cardBackgroundKey ?? ""}|${trainer.reviveUsed}|${trainer.wipeCount}|${trainer.completionCount}|${trainer.runEnded}|${trainer.mainSquadLocked}|${trainer.money ?? ""}|${trainer.playTimeSeconds ?? ""}|${trainer.earnedBadgeKeys.join("|")}|${trainer.pokemon.map((p) => `${p.id}:${p.slot}:${p.partyIndex}`).join(",")}|${encourageImportSave ? 1 : 0}`;
  const [seenStamp, setSeenStamp] = useState(serverStamp);

  /** Optimistic board after wipe/reset until RSC refresh lands. */
  const [boardOverride, setBoardOverride] = useState<{
    kind: "wipe" | "reset";
    wipeCount: number;
    pokemon: PokemonEntry[];
    mainSquadLocked: boolean;
    money: number | null;
    playTimeSeconds: number | null;
  } | null>(null);
  /** Remount badge editor to drop pending debounced writes before wipe. */
  const [badgeEditorKey, setBadgeEditorKey] = useState(0);

  const [committed, setCommitted] = useState({
    handle: trainer.handle,
    statusText: trainer.statusText ?? "",
    statusEmoji: trainer.statusEmoji ?? null,
    realName: trainer.realName ?? "",
    avatarSpriteKey: trainer.avatarSpriteKey,
    avatarBackgroundKey: parseAvatarBackgroundKey(trainer.avatarBackgroundKey),
    cardBackgroundKey: parseCardBackgroundKey(trainer.cardBackgroundKey),
    reviveUsed: trainer.reviveUsed,
  });

  const [handle, setHandle] = useState(trainer.handle);
  const [statusText, setStatusText] = useState(trainer.statusText ?? "");
  const [statusEmoji, setStatusEmoji] = useState<string | null>(
    trainer.statusEmoji ?? null,
  );
  const [realName, setRealName] = useState(trainer.realName ?? "");
  const [avatarSpriteKey, setAvatarSpriteKey] = useState(
    trainer.avatarSpriteKey,
  );
  const [avatarBackgroundKey, setAvatarBackgroundKey] = useState<string | null>(
    parseAvatarBackgroundKey(trainer.avatarBackgroundKey),
  );
  const [cardBackgroundKey, setCardBackgroundKey] = useState<string | null>(
    parseCardBackgroundKey(trainer.cardBackgroundKey),
  );
  /** Survive edit remounts when the live selection is a curated preset. */
  const [savedCustomAvatarBg, setSavedCustomAvatarBg] = useState<string | null>(
    () => {
      const parsed = parseAvatarBackgroundKey(trainer.avatarBackgroundKey);
      return parsed && !isAvatarBackgroundKey(parsed) ? parsed : null;
    },
  );
  const [savedCustomCardBg, setSavedCustomCardBg] = useState<string | null>(
    () => {
      const parsed = parseCardBackgroundKey(trainer.cardBackgroundKey);
      return parsed && !isCardBackgroundKey(parsed) ? parsed : null;
    },
  );
  const [reviveUsed, setReviveUsed] = useState(trainer.reviveUsed);
  const [earnedBadgeKeys, setEarnedBadgeKeys] = useState(
    trainer.earnedBadgeKeys,
  );

  /** Own board: shared draft between Preview (view) and Edit. */
  const [pokemonInspect, setPokemonInspect] = useState<{
    mode: "view" | "edit";
    form: PokemonFormState;
  } | null>(null);
  /** Other trainers' boards: read-only details only. */
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );
  const [saveImportOpen, setSaveImportOpen] = useState(false);
  const [boardHistoryOpen, setBoardHistoryOpen] = useState(false);
  const [teamExportOpen, setTeamExportOpen] = useState(false);
  /** null = not loaded yet (SSR omits deferred slots); [] = loaded empty. */
  const [reservesPokemon, setReservesPokemon] = useState<
    PokemonEntry[] | null
  >(null);
  const [reservesLoading, setReservesLoading] = useState(false);
  const [reservesError, setReservesError] = useState<string | null>(null);
  const [reservesOpen, setReservesOpen] = useState(false);
  const [graveyardPokemon, setGraveyardPokemon] = useState<
    PokemonEntry[] | null
  >(null);
  const [graveyardLoading, setGraveyardLoading] = useState(false);
  const [graveyardError, setGraveyardError] = useState<string | null>(null);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [encounteredPokemon, setEncounteredPokemon] = useState<
    PokemonEntry[] | null
  >(null);
  const [encounteredLoading, setEncounteredLoading] = useState(false);
  const [encounteredError, setEncounteredError] = useState<string | null>(null);
  const [encounteredOpen, setEncounteredOpen] = useState(false);
  const searchParams = useSearchParams();
  const searchPokemonId = searchParams.get("pokemon");
  /** Search `?pokemon=` ids already opened this mount — ref avoids effect setState. */
  const openedSearchPokemonIdRef = useRef<string | null>(null);
  /** In-flight deep-link fetch for Encountered / off-board ids (#365). */
  const [searchPokemonFetching, setSearchPokemonFetching] = useState(false);
  const searchPokemonLoading =
    Boolean(searchPokemonId) && searchPokemonFetching;

  // Jump Actions (#308): derive modal open from pending handoff so we don't
  // need setState-in-effect. Read-only boards leave the pending action alone
  // for My Trainer (or a GM-editable board) after soft-nav.
  const myTrainerId = searchSeason?.myTrainerId ?? null;
  const jumpImportOpen = pendingBoardAction === "import-save" && canEdit;
  const jumpExportOpen =
    pendingBoardAction === "export-team" &&
    (!myTrainerId || trainer.id === myTrainerId || canEdit);
  const importModalOpen = saveImportOpen || jumpImportOpen;
  const exportModalOpen = teamExportOpen || jumpExportOpen;

  const closeSaveImport = () => {
    setSaveImportOpen(false);
    if (pendingBoardAction === "import-save") clearBoardAction();
  };
  const closeTeamExport = () => {
    setTeamExportOpen(false);
    if (pendingBoardAction === "export-team") clearBoardAction();
  };

  if (serverStamp !== seenStamp) {
    setSeenStamp(serverStamp);
    setImportSaveGlow(encourageImportSave);

    // Keep wipe/reset optimism until the RSC payload reflects the operation.
    // Both clear the live board (including R.I.P.). Wipe also bumps wipeCount
    // and zeros money + playtime. Avoid wipeCount !== so a server count ahead of
    // optimism cannot pin a stale override.
    const wipeOrResetInFlight =
      boardOverride != null &&
      (boardOverride.kind === "reset"
        ? trainer.pokemon.length > 0
        : trainer.wipeCount < boardOverride.wipeCount ||
          trainer.pokemon.length > 0 ||
          (trainer.money ?? 0) !== 0 ||
          (trainer.playTimeSeconds ?? 0) !== 0);

    setCommitted({
      handle: trainer.handle,
      statusText: trainer.statusText ?? "",
      statusEmoji: trainer.statusEmoji ?? null,
      realName: trainer.realName ?? "",
      avatarSpriteKey: trainer.avatarSpriteKey,
      avatarBackgroundKey: parseAvatarBackgroundKey(
        trainer.avatarBackgroundKey,
      ),
      cardBackgroundKey: parseCardBackgroundKey(trainer.cardBackgroundKey),
      // Don't let a stale RSC revive flag clobber wipe/reset optimism.
      reviveUsed: wipeOrResetInFlight ? false : trainer.reviveUsed,
    });
    const nextAvatarBg = parseAvatarBackgroundKey(trainer.avatarBackgroundKey);
    if (nextAvatarBg && !isAvatarBackgroundKey(nextAvatarBg)) {
      setSavedCustomAvatarBg(nextAvatarBg);
    }
    const nextCardBg = parseCardBackgroundKey(trainer.cardBackgroundKey);
    if (nextCardBg && !isCardBackgroundKey(nextCardBg)) {
      setSavedCustomCardBg(nextCardBg);
    }

    if (!wipeOrResetInFlight) {
      setReviveUsed(trainer.reviveUsed);
      setEarnedBadgeKeys(trainer.earnedBadgeKeys);
      setBoardOverride(null);
      setRunEndedOverride(null);
      // Board writes revalidate `:trainer:${id}` (+ `:board` for shared views) —
      // drop deferred slots so a reopen (or still-open section) refetches.
      setReservesPokemon(null);
      setReservesError(null);
      setGraveyardPokemon(null);
      setGraveyardError(null);
      setEncounteredPokemon(null);
      setEncounteredError(null);
    }
  }

  const ssrPokemon = boardOverride?.pokemon ?? trainer.pokemon;
  // Wipe/reset optimism owns the full board; otherwise merge accordion hydrates
  // for Reserves / R.I.P. (SSR is Main-only after #378).
  const boardPokemon =
    boardOverride != null
      ? ssrPokemon
      : [
          ...ssrPokemon.filter(
            (p) => p.slot !== "RESERVE" && p.slot !== "GRAVEYARD",
          ),
          ...(reservesPokemon ??
            ssrPokemon.filter((p) => p.slot === "RESERVE")),
          ...(graveyardPokemon ??
            ssrPokemon.filter((p) => p.slot === "GRAVEYARD")),
        ];
  const wipeCount = boardOverride?.wipeCount ?? trainer.wipeCount ?? 0;
  const runNumber = wipeCount + 1;
  const completionCount = trainer.completionCount ?? 0;
  /** Run closed, next one not started: the board is a frozen final team. */
  const runEnded = runEndedOverride ?? trainer.runEnded;
  const mainSquadLocked =
    boardOverride?.mainSquadLocked ??
    // Only the in-flight completion forces the lock. Once the server answers,
    // mainSquadLocked is the truth again — a GM unlocking a finished board to
    // fix something has to actually unlock it.
    (runEndedOverride === true || trainer.mainSquadLocked);
  const boardMoney =
    boardOverride != null ? boardOverride.money : trainer.money;
  const boardPlayTimeSeconds =
    boardOverride != null
      ? boardOverride.playTimeSeconds
      : trainer.playTimeSeconds;
  const boardTrainer = {
    ...trainer,
    pokemon: boardPokemon,
    wipeCount,
    mainSquadLocked,
    money: boardMoney,
    playTimeSeconds: boardPlayTimeSeconds,
  };

  const championshipEarned = hasBeatenChampionship(earnedBadgeKeys);
  const missingChampionshipLabels = CHAMPIONSHIP_BADGE_KEYS.filter(
    (key) => !earnedBadgeKeys.includes(key),
  ).map((key) => EMERALD_BADGE_META[key]?.badgeName ?? key);

  const main = pokemonInSlot(boardTrainer, "MAIN");
  const reserves = pokemonInSlot(boardTrainer, "RESERVE");
  const graveyard = pokemonInSlot(boardTrainer, "GRAVEYARD");
  // SSR omits deferred slots; prefer hydrated rows, else any still on the
  // trainer prop (seed / optimistic wipe leftovers).
  const encountered =
    encounteredPokemon ?? pokemonInSlot(boardTrainer, "ENCOUNTERED");
  const reservesCount =
    reservesPokemon?.length ??
    trainer.slotCounts?.reserve ??
    reserves.length;
  const graveyardCount =
    graveyardPokemon?.length ??
    trainer.slotCounts?.graveyard ??
    graveyard.length;
  const encounteredCount =
    encounteredPokemon?.length ??
    trainer.slotCounts?.encountered ??
    encountered.length;

  // Deferred slot hydrate — open (or stay open across revalidate).
  // Await before setState so we don't trip react-hooks/set-state-in-effect
  // (same pattern as ToolsView: state updates only after async work).
  useEffect(() => {
    if (!reservesOpen || reservesPokemon != null) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setReservesLoading(true);
      setReservesError(null);
      const result = await fetchTrainerBoardSlotAction({
        slug: challengeSlug,
        trainerId: trainer.id,
        slot: "RESERVE",
      });
      if (cancelled) return;
      if (result.ok) {
        setReservesPokemon(result.pokemon);
      } else {
        setReservesError(result.error);
      }
      setReservesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reservesOpen, reservesPokemon, challengeSlug, trainer.id]);

  useEffect(() => {
    if (!graveyardOpen || graveyardPokemon != null) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setGraveyardLoading(true);
      setGraveyardError(null);
      const result = await fetchTrainerBoardSlotAction({
        slug: challengeSlug,
        trainerId: trainer.id,
        slot: "GRAVEYARD",
      });
      if (cancelled) return;
      if (result.ok) {
        setGraveyardPokemon(result.pokemon);
      } else {
        setGraveyardError(result.error);
      }
      setGraveyardLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [graveyardOpen, graveyardPokemon, challengeSlug, trainer.id]);

  useEffect(() => {
    if (!encounteredOpen || encounteredPokemon != null) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setEncounteredLoading(true);
      setEncounteredError(null);
      const result = await fetchTrainerBoardSlotAction({
        slug: challengeSlug,
        trainerId: trainer.id,
        slot: "ENCOUNTERED",
      });
      if (cancelled) return;
      if (result.ok) {
        setEncounteredPokemon(result.pokemon);
      } else {
        setEncounteredError(result.error);
      }
      setEncounteredLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    encounteredOpen,
    encounteredPokemon,
    challengeSlug,
    trainer.id,
  ]);

  function onReservesOpenChange(open: boolean) {
    setReservesOpen(open);
    if (open && reservesPokemon == null) {
      setReservesLoading(true);
      setReservesError(null);
    }
  }

  function onGraveyardOpenChange(open: boolean) {
    setGraveyardOpen(open);
    if (open && graveyardPokemon == null) {
      setGraveyardLoading(true);
      setGraveyardError(null);
    }
  }

  function onEncounteredOpenChange(open: boolean) {
    setEncounteredOpen(open);
    if (open && encounteredPokemon == null) {
      setEncounteredLoading(true);
      setEncounteredError(null);
    }
  }

  const wiping =
    wipeSave.status.kind === "saving" || resetSave.status.kind === "saving";
  const seasonLinkTiles = [
    {
      href: `${leagueBoardHref}/rules`,
      label: "Rules",
      icon: <RulesIcon className="h-6 w-6" />,
    },
    {
      href: `${leagueBoardHref}/rules?tab=faq`,
      label: "FAQ",
      icon: <FaqShortcutIcon />,
    },
    {
      href: `${leagueBoardHref}/tools`,
      label: "Tools",
      icon: <ToolsShortcutIcon />,
    },
    {
      href: seasonStatsHref(challengeSlug),
      label: "Season Stats",
      icon: <SeasonStatsToolIcon className="h-6 w-6" />,
    },
    {
      href: `${leagueBoardHref}/encounters`,
      label: "Encounters",
      icon: <EncountersShortcutIcon />,
    },
  ] as const;

  function syncPlayerDraftFromCommitted() {
    setHandle(committed.handle);
    setStatusText(committed.statusText);
    setStatusEmoji(committed.statusEmoji);
    setRealName(committed.realName);
    setAvatarSpriteKey(committed.avatarSpriteKey);
    setAvatarBackgroundKey(committed.avatarBackgroundKey);
    setCardBackgroundKey(committed.cardBackgroundKey);
  }

  function startEditingPlayer() {
    syncPlayerDraftFromCommitted();
    setEditingPlayer(true);
  }

  function cancelEditingPlayer() {
    syncPlayerDraftFromCommitted();
    playerSave.reset();
    setEditingPlayer(false);
  }

  function savePlayerProfile() {
    const next = {
      handle: handle.trim(),
      statusText,
      statusEmoji,
      realName: realName || "",
      avatarSpriteKey,
      avatarBackgroundKey,
      cardBackgroundKey,
    };
    // Optimistic: show the draft immediately in view mode.
    setCommitted((current) => ({
      ...current,
      ...next,
    }));
    setEditingPlayer(false);
    playerSave.markSaving();
    startTransition(async () => {
      const result = await updateTrainerBoardAction({
        trainerId: trainer.id,
        handle: next.handle,
        statusText: next.statusText,
        statusEmoji: next.statusEmoji,
        realName: next.realName || null,
        avatarSpriteKey: next.avatarSpriteKey,
        avatarBackgroundKey: next.avatarBackgroundKey,
        cardBackgroundKey: next.cardBackgroundKey,
      });
      if (result.ok) {
        playerSave.markSaved(result.message ?? "Profile saved");
      } else {
        const rollback = {
          handle: trainer.handle,
          statusText: trainer.statusText ?? "",
          statusEmoji: trainer.statusEmoji ?? null,
          realName: trainer.realName ?? "",
          avatarSpriteKey: trainer.avatarSpriteKey,
          avatarBackgroundKey: parseAvatarBackgroundKey(
            trainer.avatarBackgroundKey,
          ),
          cardBackgroundKey: parseCardBackgroundKey(trainer.cardBackgroundKey),
          reviveUsed: trainer.reviveUsed,
        };
        setCommitted(rollback);
        setHandle(rollback.handle);
        setStatusText(rollback.statusText);
        setStatusEmoji(rollback.statusEmoji);
        setRealName(rollback.realName);
        setAvatarSpriteKey(rollback.avatarSpriteKey);
        setAvatarBackgroundKey(rollback.avatarBackgroundKey);
        setCardBackgroundKey(rollback.cardBackgroundKey);
        setEditingPlayer(true);
        playerSave.markError(result.error);
      }
    });
  }

  async function copyBoardLink() {
    const path = trainerBoardPath(challengeSlug, trainer.id);
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    const ok = await copyText(url);
    if (ok) {
      pushSnackbar("Board link copied", "success", 2200);
    } else {
      pushSnackbar("Couldn’t copy board link", "error");
    }
  }

  async function spendReviveToken() {
    const ok = await confirm({
      title: "Use revive token?",
      description:
        "This spends your one revive for this run. A wipe starts a new run with a fresh revive. Only a GM can restore a spent revive mid-run.",
      confirmLabel: "Use revive",
      tone: "danger",
    });
    if (!ok) return;
    const previous = reviveUsed;
    setReviveUsed(true);
    reviveSave.markSaving("Using revive…");
    startTransition(async () => {
      const result = await updateTrainerBoardAction({
        trainerId: trainer.id,
        reviveUsed: true,
      });
      if (result.ok) {
        reviveSave.markSaved("Revive used");
      } else {
        setReviveUsed(previous);
        reviveSave.markError(result.error);
      }
    });
  }

  async function resetReviveToken() {
    const ok = await confirm({
      title: "Reset revive token?",
      description:
        "This restores the trainer’s revive so they can use it again.",
      confirmLabel: "Reset revive",
      tone: "primary",
    });
    if (!ok) return;
    const previous = reviveUsed;
    setReviveUsed(false);
    reviveSave.markSaving("Resetting revive…");
    startTransition(async () => {
      const result = await updateTrainerBoardAction({
        trainerId: trainer.id,
        reviveUsed: false,
      });
      if (result.ok) {
        reviveSave.markSaved("Revive reset");
      } else {
        setReviveUsed(previous);
        reviveSave.markError(result.error);
      }
    });
  }

  async function markFinalTeam() {
    const previousEnded = runEndedOverride;
    const ok = await confirm({
      title: "Lock in your final team?",
      description: (
        <>
          Archives run {runNumber} as a Championship completion and freezes this
          board as your tournament roster — every Pokémon stays exactly where it
          is, nothing is cleared, and no wipe is recorded. Main Squad locks; a
          GM can unlock it if you need a correction. When you’re ready to play
          again, Start a new run clears the board for run {runNumber + 1}.
        </>
      ),
      confirmLabel: "This is my final team",
    });
    if (!ok) return;

    setRunEndedOverride(true);
    setEndRunOpen(false);
    setPokemonInspect(null);
    setDetailsPokemon(null);
    setSaveImportOpen(false);

    wipeSave.markSaving("Recording completion…");
    startTransition(async () => {
      const result = await recordFinalTeamAction({ trainerId: trainer.id });
      if (result.ok) {
        wipeSave.markSaved(result.message ?? "Final team locked in");
        router.refresh();
      } else {
        setRunEndedOverride(previousEnded);
        wipeSave.markError(result.error);
      }
    });
  }

  async function startNewRun() {
    const nextWipe = wipeCount + 1;
    const previousBadges = earnedBadgeKeys;
    const previousBoard = boardOverride;
    const previousRevive = reviveUsed;
    const previousEnded = runEndedOverride;
    const ok = await confirm({
      title: `Start run ${nextWipe + 1}?`,
      description: (
        <>
          Clears Main Squad, Reserves, Encountered, and R.I.P. on this board,
          resets badges, money, and playtime to 0, and refreshes your revive
          token for the next run. Profile (name, avatar, backdrops, status)
          stays. Locked Main Squad unlocks so you can rebuild.{" "}
          {runEnded
            ? "Your finished run is already archived — its final team stays in History and Memorial."
            : `This closes run ${runNumber} as wipe #${nextWipe}.`}{" "}
          A board history snapshot is saved first — prior partners live in
          History / Memorial, not the live board.
        </>
      ),
      confirmLabel: `Start run ${nextWipe + 1}`,
      tone: "danger",
    });
    if (!ok) return;

    setBadgeEditorKey((k) => k + 1);
    setEarnedBadgeKeys([]);
    setBoardOverride({
      kind: "wipe",
      wipeCount: nextWipe,
      // A finished run was already archived intact — don't flash its winning
      // squad as R.I.P. while the refresh lands.
      pokemon: runEnded ? [] : memorialPokemonAfterWipe(boardPokemon, nextWipe),
      mainSquadLocked: false,
      money: 0,
      playTimeSeconds: 0,
    });
    setRunEndedOverride(false);
    setReviveUsed(false);
    setEndRunOpen(false);
    setPokemonInspect(null);
    setDetailsPokemon(null);
    setSaveImportOpen(false);
    setReservesPokemon([]);
    setReservesError(null);
    setGraveyardPokemon([]);
    setGraveyardError(null);
    setEncounteredPokemon([]);
    setEncounteredError(null);

    wipeSave.markSaving("Starting new run…");
    startTransition(async () => {
      const result = await startNewRunAction({ trainerId: trainer.id });
      if (result.ok) {
        wipeSave.markSaved(result.message ?? "New run started");
        router.refresh();
      } else {
        setBoardOverride(previousBoard);
        setEarnedBadgeKeys(previousBadges);
        setReviveUsed(previousRevive);
        setRunEndedOverride(previousEnded);
        setBadgeEditorKey((k) => k + 1);
        wipeSave.markError(result.error);
      }
    });
  }

  async function resetTrainerBoard() {
    const previousBadges = earnedBadgeKeys;
    const previousCommitted = committed;
    const previousBoard = boardOverride;
    const previousRevive = reviveUsed;
    const ok = await confirm({
      title: "Reset this trainer board?",
      description: (
        <>
          GM hard reset: clears Main, Reserves, Encountered, and R.I.P.
          memorial, and resets badges, wipe count, and revive token. Profile
          stays (name, avatar, backdrops, status). A board history snapshot is
          saved first. Use for an official fresh start — not a mid-run wipe.
        </>
      ),
      confirmLabel: "Reset board",
      tone: "danger",
    });
    if (!ok) return;

    setBadgeEditorKey((k) => k + 1);
    setEarnedBadgeKeys([]);
    setBoardOverride({
      kind: "reset",
      wipeCount: 0,
      pokemon: [],
      mainSquadLocked: false,
      money: trainer.money,
      playTimeSeconds: trainer.playTimeSeconds,
    });
    setCommitted((prev) => ({
      ...prev,
      reviveUsed: false,
    }));
    setReviveUsed(false);
    setPokemonInspect(null);
    setDetailsPokemon(null);
    setSaveImportOpen(false);
    setReservesPokemon([]);
    setReservesError(null);
    setGraveyardPokemon([]);
    setGraveyardError(null);
    setEncounteredPokemon([]);
    setEncounteredError(null);

    resetSave.markSaving("Resetting board…");
    startTransition(async () => {
      const result = await gmResetTrainerBoardAction({ trainerId: trainer.id });
      if (result.ok) {
        resetSave.markSaved(result.message ?? "Board reset");
        router.refresh();
      } else {
        setBoardOverride(previousBoard);
        setEarnedBadgeKeys(previousBadges);
        setCommitted(previousCommitted);
        setReviveUsed(previousRevive);
        setBadgeEditorKey((k) => k + 1);
        resetSave.markError(result.error);
      }
    });
  }

  function openAddPokemon(
    slot: PokemonEntry["slot"] = "MAIN",
    partyIndex?: number,
  ) {
    if (wiping) return;
    if (slot === "MAIN") {
      // Main Squad is fixed 0–5 — never open add when every slot is filled.
      if (partyIndex == null) {
        const open = firstOpenMainPartyIndex(boardPokemon);
        if (open == null) return;
        partyIndex = open;
      } else if (
        partyIndex < 0 ||
        partyIndex >= MAIN_PARTY_SIZE ||
        boardPokemon.some(
          (p) => p.slot === "MAIN" && p.partyIndex === partyIndex,
        )
      ) {
        return;
      }
    } else if (partyIndex == null) {
      const pool =
        slot === "ENCOUNTERED" && encounteredPokemon
          ? [...boardPokemon, ...encounteredPokemon]
          : boardPokemon;
      const used = new Set(
        pool.filter((p) => p.slot === slot).map((p) => p.partyIndex),
      );
      partyIndex = 0;
      while (used.has(partyIndex) && partyIndex < 1000) partyIndex += 1;
    }
    setPokemonInspect({
      mode: "edit",
      form: { ...EMPTY_POKEMON_FORM, slot, partyIndex },
    });
  }

  function openPokemon(mon: PokemonEntry) {
    if (wiping) return;
    if (canEdit) {
      // Start in preview — Edit is one click; draft survives Preview ↔ Edit.
      setPokemonInspect({
        mode: "view",
        form: pokemonEntryToForm(mon),
      });
      return;
    }
    setDetailsPokemon(mon);
  }

  // Search deep-link: /trainers/:id?pokemon=:pokemonId opens that mon.
  useEffect(() => {
    if (!searchPokemonId) {
      openedSearchPokemonIdRef.current = null;
      return;
    }
    if (openedSearchPokemonIdRef.current === searchPokemonId) return;

    const mon =
      boardPokemon.find((p) => p.id === searchPokemonId) ??
      encounteredPokemon?.find((p) => p.id === searchPokemonId) ??
      null;

    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;

      if (mon) {
        openedSearchPokemonIdRef.current = searchPokemonId;
        setSearchPokemonFetching(false);
        if (canEdit) {
          setPokemonInspect({
            mode: "view",
            form: pokemonEntryToForm(mon),
          });
        } else {
          setDetailsPokemon(mon);
        }
        return;
      }

      // Encountered (and rare off-board ids) are not in the SSR party — fetch one.
      setSearchPokemonFetching(true);
      const result = await fetchToolsPokemonEntryAction({
        slug: challengeSlug,
        pokemonId: searchPokemonId,
      });
      if (cancelled) return;
      setSearchPokemonFetching(false);
      // User dismissed the loading shell — don't reopen.
      if (openedSearchPokemonIdRef.current === searchPokemonId) return;
      if (!result.ok) return;
      openedSearchPokemonIdRef.current = searchPokemonId;
      if (canEdit) {
        setPokemonInspect({
          mode: "view",
          form: pokemonEntryToForm(result.pokemon),
        });
      } else {
        setDetailsPokemon(result.pokemon);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    searchPokemonId,
    boardPokemon,
    encounteredPokemon,
    canEdit,
    challengeSlug,
  ]);

  function dismissSearchPokemon() {
    if (searchPokemonId) {
      openedSearchPokemonIdRef.current = searchPokemonId;
    }
    setSearchPokemonFetching(false);
    setPokemonInspect(null);
    setDetailsPokemon(null);
  }

  const mobileSaveStatus =
    partySave.status.kind !== "idle"
      ? partySave.status
      : playerSave.status.kind !== "idle"
        ? playerSave.status
        : wipeSave.status.kind !== "idle"
          ? wipeSave.status
          : resetSave.status.kind !== "idle"
            ? resetSave.status
            : reviveSave.status;
  // Only pin a bottom bar when it has a job — save feedback or profile save.
  // The idle "save as you go" hint felt redundant on mobile.
  const showMobileSaveBar =
    canEdit && (editingPlayer || mobileSaveStatus.kind !== "idle");
  // Primary strip + Shortcuts: Import only. Revive is status on R.I.P.; mark /
  // GM reset live in More. Everything else is overflow so mobile stays calm (#325).
  //
  // Exception: when an open run has visibly reached its end, logging it is the
  // obvious next action, so it gets promoted out of More and sits beside Import
  // save. It leaves the menu while promoted so the same verb never appears
  // twice, and both promotions open the same modal — only the framing differs:
  //
  //   victory — Championship earned; a clear to record.
  //   wipeout — everything in R.I.P. and nothing left alive to play. Graveyard
  //             must be non-empty so a brand-new empty board doesn't qualify.
  //   restart — already ended and no new run started; the only thing left.
  //
  // Victory wins if victory and wipeout somehow both hold. Restart outranks
  // both: once the run is closed neither of the open-run prompts still applies.
  // Restart is the one that actually resets a board, so it keeps the danger
  // tone and calls startNewRun directly; the other two open the End Run modal.
  const wipedOut =
    graveyardCount > 0 && main.length === 0 && reservesCount === 0;
  const endRunPromotion: "victory" | "wipeout" | "restart" | null = !canEdit
    ? null
    : runEnded
      ? "restart"
      : championshipEarned
        ? "victory"
        : wipedOut
          ? "wipeout"
          : null;
  const promoteEndRun = endRunPromotion != null;
  const endRunPromo = endRunPromotion
    ? {
        victory: {
          label: "Mark run completed",
          title: "All badges earned — record this run as complete",
          tone: "border-accent/55 bg-accent/10 text-accent-deep hover:border-accent hover:bg-accent/16",
          restart: false,
        },
        wipeout: {
          label: "End this run",
          title: "No Pokémon left alive — record this run as ended",
          tone: "border-danger/40 bg-danger/10 text-danger hover:border-danger/70 hover:bg-danger/16",
          restart: false,
        },
        restart: {
          label: "Start new run",
          title: "This run is closed — start a fresh run",
          tone: "border-danger/40 bg-danger/10 text-danger hover:border-danger/70 hover:bg-danger/16",
          restart: true,
        },
      }[endRunPromotion]
    : null;
  const boardActionSlots: Record<
    TrainerBoardActionKey,
    {
      shortcut: ReactNode;
      toolbar: ReactNode;
      menu: TrainerBoardMenuItem | null;
    }
  > = {
    copy: {
      shortcut: null,
      toolbar: null,
      menu: {
        key: "copy",
        label: "Copy link",
        icon: <CopyLinkIcon className="h-4 w-4" />,
        disabled: pending || wiping,
        title: "Copy shareable board link",
        onClick: () => {
          void copyBoardLink();
        },
      },
    },
    export: {
      shortcut: null,
      toolbar: null,
      menu: {
        key: "export",
        label: "Export team",
        icon: <ExportTeamIcon className="h-4 w-4" />,
        disabled: pending || wiping,
        title: "Copy living roster for LLM / notes",
        onClick: () => setTeamExportOpen(true),
      },
    },
    history: {
      shortcut: null,
      toolbar: null,
      menu:
        !isDemo && (isGm || showCompetitiveDetails)
          ? {
              key: "history",
              label: "Trainer history",
              icon: <BoardHistoryIcon className="h-4 w-4" />,
              disabled: pending || wiping,
              title: "Runs, badge archives, and board snapshots",
              onClick: () => setBoardHistoryOpen(true),
            }
          : null,
    },
    import: {
      shortcut: canEdit && (
        <ShortcutActionTile
          disabled={pending || wiping}
          icon={<ImportSaveIcon className="h-4 w-4" />}
          label="Import save"
          onClick={() => setSaveImportOpen(true)}
          tone="import"
          firstImport={importSaveGlow}
        />
      ),
      toolbar: canEdit && (
        <button
          className={`pressable cta-import-save inline-flex h-9 items-center gap-1.5 border-frame bg-surface px-3 text-xs font-semibold tracking-tight text-ink disabled:opacity-60${
            importSaveGlow ? " is-first-import" : ""
          }`}
          data-tour="import-save"
          disabled={pending || wiping}
          onClick={() => setSaveImportOpen(true)}
          type="button"
        >
          <ImportSaveIcon />
          <span>Import save</span>
        </button>
      ),
      menu: null,
    },
    reset: {
      shortcut: null,
      toolbar: null,
      menu:
        isGm && !isDemo
          ? {
              key: "reset",
              label: "Reset board",
              icon: <ResetBoardIcon className="h-4 w-4" />,
              disabled: pending || wiping,
              title: "GM hard reset — zeros wipe count",
              tone: "danger",
              onClick: () => {
                void resetTrainerBoard();
              },
            }
          : null,
    },
    // Owners normally sync revive via Import save. Manual mark + GM reset stay
    // in More as escape hatches — not top-strip CTAs.
    revive: {
      shortcut: null,
      toolbar: null,
      menu:
        canEdit && !isDemo && !reviveUsed && !runEnded
          ? {
              key: "revive",
              label: "Mark revive used",
              icon: <ReviveShortcutIcon className="h-4 w-4" />,
              disabled: pending || wiping,
              title: "Manual escape hatch — prefer syncing via Import save",
              onClick: () => {
                void spendReviveToken();
              },
            }
          : isGm && !isDemo && reviveUsed
            ? {
                key: "revive",
                label: "Reset revive",
                icon: <ReviveShortcutIcon className="h-4 w-4" />,
                disabled: pending || wiping,
                title: "Reset revive token",
                tone: "danger",
                onClick: () => {
                  void resetReviveToken();
                },
              }
            : null,
    },
    // One control, two states: a run in progress ends here; a run that already
    // ended only has one thing left to do. "End run" opens a modal and destroys
    // nothing, so the danger tone is saved for the restart that does.
    endRun: {
      shortcut: null,
      toolbar: endRunPromo ? (
        <button
          className={`pressable inline-flex h-9 items-center gap-1.5 border px-3 text-xs font-semibold tracking-tight disabled:opacity-60 ${endRunPromo.tone}`}
          disabled={pending || wiping}
          onClick={() => {
            if (endRunPromo.restart) void startNewRun();
            else setEndRunOpen(true);
          }}
          title={endRunPromo.title}
          type="button"
        >
          {endRunPromo.restart ? (
            <WipeIcon className="h-4 w-4" />
          ) : (
            <EndRunIcon className="h-4 w-4" />
          )}
          <span>{endRunPromo.label}</span>
        </button>
      ) : null,
      menu:
        // Only reachable mid-run: an ended run always promotes to "Start new
        // run" in the strip, so this entry no longer needs that branch.
        canEdit && !promoteEndRun
          ? {
              key: "endRun",
              label: "End run",
              icon: <EndRunIcon className="h-4 w-4" />,
              disabled: pending || wiping,
              tone: "neutral",
              onClick: () => setEndRunOpen(true),
            }
          : null,
    },
  };

  const overflowMenuItems = TRAINER_BOARD_OVERFLOW_ACTIONS.map(
    (action) => boardActionSlots[action].menu,
  ).filter((item): item is TrainerBoardMenuItem => item != null);

  const primaryShortcutTiles = TRAINER_BOARD_PRIMARY_ACTIONS.map(
    (action) => boardActionSlots[action].shortcut,
  ).filter(Boolean);

  const ripReviveStatus = !isDemo ? (
    <>
      {reviveSave.status.kind !== "idle" && (
        <SaveStatus status={reviveSave.status} />
      )}
      <ReviveToken used={reviveUsed} size="sm" />
    </>
  ) : null;

  return (
    <div className={`space-y-4 ${showMobileSaveBar ? "pb-20 sm:pb-0" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={leagueBoardHref}
          className="pressable inline-flex h-9 items-center gap-1.5 border-frame/70 bg-surface-2/60 px-3 text-xs font-semibold tracking-tight text-muted hover:border-frame hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden>←</span>
          {leagueBoardLabel}
        </Link>
        <div className="flex flex-nowrap items-center gap-2">
          {TRAINER_BOARD_PRIMARY_ACTIONS.map((action) => (
            <Fragment key={action}>{boardActionSlots[action].toolbar}</Fragment>
          ))}
          <TrainerBoardActionsMenu items={overflowMenuItems} />
        </div>
      </div>

      {canEdit && wipeSave.status.kind !== "idle" && (
        <div className="flex justify-end">
          <SaveStatus status={wipeSave.status} />
        </div>
      )}
      {isGm && !isDemo && resetSave.status.kind !== "idle" && (
        <div className="flex justify-end">
          <SaveStatus status={resetSave.status} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {canEdit
            ? "Your board — profile saves explicitly; party and badges save as you go."
            : "Trainer board"}
        </p>
        {canEdit && (
          <div className="hidden sm:block">
            <SaveStatus status={partySave.status} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="space-y-6">
          <Frame
            data-tour="player"
            title="Trainer"
            cardBackgroundKey={
              editingPlayer ? null : committed.cardBackgroundKey
            }
            actions={
              canEdit ? (
                editingPlayer ? (
                  <>
                    <SaveStatus status={playerSave.status} onAccent />
                    <HeaderButton
                      tone="primary"
                      disabled={pending || !handle.trim()}
                      onClick={savePlayerProfile}
                    >
                      <SaveIcon />
                      Save
                    </HeaderButton>
                    <HeaderButton onClick={cancelEditingPlayer}>
                      Cancel
                    </HeaderButton>
                  </>
                ) : (
                  <>
                    <SaveStatus status={playerSave.status} onAccent />
                    <HeaderButton
                      aria-label="Customize trainer profile"
                      onClick={startEditingPlayer}
                    >
                      <PencilIcon />
                      Customize
                    </HeaderButton>
                  </>
                )
              ) : null
            }
          >
            {editingPlayer ? (
              <PlayerCustomizationEditor
                avatarSpriteKey={avatarSpriteKey}
                onAvatarChange={setAvatarSpriteKey}
                avatarBackgroundKey={avatarBackgroundKey}
                onAvatarBackgroundChange={setAvatarBackgroundKey}
                savedCustomAvatarBg={savedCustomAvatarBg}
                onSavedCustomAvatarBgChange={setSavedCustomAvatarBg}
                cardBackgroundKey={cardBackgroundKey}
                onCardBackgroundChange={setCardBackgroundKey}
                savedCustomCardBg={savedCustomCardBg}
                onSavedCustomCardBgChange={setSavedCustomCardBg}
                handle={handle}
                onHandleChange={setHandle}
                realName={realName}
                onRealNameChange={setRealName}
                statusEmoji={statusEmoji}
                onStatusEmojiChange={setStatusEmoji}
                statusText={statusText}
                onStatusTextChange={setStatusText}
                discordUsername={trainer.discordUsername}
                discordDisplayName={trainer.discordDisplayName}
                disabled={pending}
                leaguePreview={{
                  challengeSlug,
                  badges,
                  trainer: {
                    ...boardTrainer,
                    earnedBadgeKeys,
                    reviveUsed,
                  },
                }}
              />
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <AvatarPortrait
                  avatarSpriteKey={committed.avatarSpriteKey}
                  backgroundKey={committed.avatarBackgroundKey}
                  sizeClass="h-24 w-24"
                  width={96}
                  height={96}
                />
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {committed.realName
                      ? `${committed.handle} (${committed.realName})`
                      : committed.handle}
                  </h1>
                  {(trainer.discordUsername || trainer.discordDisplayName) && (
                    <p className="mt-1 text-sm text-muted">
                      Discord{" "}
                      <span className="font-semibold text-ink">
                        {trainer.discordUsername
                          ? `@${trainer.discordUsername}`
                          : trainer.discordDisplayName}
                      </span>
                      {trainer.discordUsername &&
                        trainer.discordDisplayName &&
                        trainer.discordDisplayName.toLowerCase() !==
                          trainer.discordUsername.toLowerCase() && (
                          <span> · {trainer.discordDisplayName}</span>
                        )}
                    </p>
                  )}
                  {(mainSquadLocked || isDemo) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {mainSquadLocked && (
                        <span className="rounded-lg border border-frame bg-accent-2/25 px-2 py-1 font-display text-[10px] font-semibold tracking-tight">
                          Main Squad locked
                        </span>
                      )}
                      {isDemo && (
                        <span className="rounded-lg border border-frame bg-surface-2 px-2 py-1 font-display text-[10px] font-semibold tracking-tight">
                          Demo example
                        </span>
                      )}
                    </div>
                  )}
                  <StatusLine
                    emoji={committed.statusEmoji}
                    text={committed.statusText}
                    className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base"
                  />
                  {isDemo && (
                    <p className="mt-3 text-sm text-muted">
                      This isn&apos;t a real player slot.{" "}
                      {myBoardHref ? (
                        <>
                          <Link
                            href={myBoardHref}
                            className="font-bold text-accent-deep underline"
                          >
                            Open your board
                          </Link>{" "}
                          to edit your own.
                        </>
                      ) : (
                        <>
                          <Link
                            href={joinHref}
                            className="font-bold text-accent-deep underline"
                          >
                            Sign in with Discord
                          </Link>{" "}
                          to get your own editable board.
                        </>
                      )}
                    </p>
                  )}
                  {canEdit && boardPokemon.length === 0 && (
                    <p className="mt-3 text-sm text-muted">
                      Your board is ready — customize your profile, then use{" "}
                      <span className="font-semibold text-ink">
                        Import save
                      </span>{" "}
                      at the top once you have a file from Afterplay. You can
                      also tap party slots and badges by hand.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Frame>

          {canEdit ? (
            <PartyBoardDnd
              key={boardPokemon
                .map((p) => `${p.id}:${p.slot}:${p.partyIndex}`)
                .join("|")}
              pokemon={boardPokemon}
              mainSquadLocked={(mainSquadLocked && !isGm) || wiping}
              onSelect={openPokemon}
              onSelectEmptyMain={(partyIndex) =>
                openAddPokemon("MAIN", partyIndex)
              }
              onRelocate={async (updates) => {
                if (wiping) return false;
                partySave.markSaving("Updating party…");
                const result = await relocatePokemonAction({
                  trainerId: trainer.id,
                  updates,
                });
                if (result.ok) {
                  partySave.markSaved(result.message ?? "Party updated");
                  return true;
                }
                partySave.markError(result.error);
                return false;
              }}
              mainActions={
                firstOpenMainPartyIndex(boardPokemon) != null ? (
                  <button
                    type="button"
                    disabled={wiping}
                    className="pressable rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold tracking-tight text-[var(--on-accent)] disabled:opacity-60"
                    onClick={() => openAddPokemon("MAIN")}
                  >
                    + Add
                  </button>
                ) : null
              }
              reservesActions={
                <button
                  type="button"
                  disabled={wiping}
                  className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight disabled:opacity-60"
                  onClick={() => openAddPokemon("RESERVE")}
                >
                  + Add
                </button>
              }
              graveyardActions={
                <button
                  type="button"
                  disabled={wiping}
                  className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight disabled:opacity-60"
                  onClick={() => openAddPokemon("GRAVEYARD")}
                >
                  + Add
                </button>
              }
              graveyardHeaderActions={ripReviveStatus}
              reservesDeferred={{
                open: reservesOpen,
                onOpenChange: onReservesOpenChange,
                loading: reservesLoading,
                error: reservesError,
                ready: reservesPokemon != null,
                count: reservesCount,
              }}
              graveyardDeferred={{
                open: graveyardOpen,
                onOpenChange: onGraveyardOpenChange,
                loading: graveyardLoading,
                error: graveyardError,
                ready: graveyardPokemon != null,
                count: graveyardCount,
              }}
            />
          ) : (
            <>
              <Frame
                title={frameCountTitle("Main Squad", main.length)}
                data-tour="pokemon"
              >
                <PartyStrip
                  pokemon={main}
                  slots={6}
                  selectHint="Details"
                  showCompetitiveDetails={showCompetitiveDetails}
                  onSelect={openPokemon}
                />
              </Frame>

              <Frame
                title={frameCountTitle("The Reserves", reservesCount)}
                collapsible
                open={reservesOpen}
                onOpenChange={onReservesOpenChange}
              >
                {reservesLoading && reservesPokemon == null ? (
                  <div
                    className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                    aria-busy="true"
                    aria-label="Loading reserves"
                  >
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton
                        key={i}
                        className="min-h-28 rounded-lg border border-frame/40 bg-surface"
                      />
                    ))}
                  </div>
                ) : reservesError && reservesPokemon == null ? (
                  <p className="text-sm text-muted">{reservesError}</p>
                ) : reservesPokemon == null ? null : reserves.length > 0 ? (
                  <PartyStrip
                    pokemon={reserves}
                    selectHint="Details"
                    showCompetitiveDetails={showCompetitiveDetails}
                    onSelect={openPokemon}
                  />
                ) : (
                  <p className="text-sm text-muted">No reserves logged yet.</p>
                )}
              </Frame>

              <Frame
                title={frameCountTitle("R.I.P.", graveyardCount)}
                tone="rip"
                actions={ripReviveStatus}
                collapsible
                open={graveyardOpen}
                onOpenChange={onGraveyardOpenChange}
              >
                {graveyardLoading && graveyardPokemon == null ? (
                  <div
                    className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                    aria-busy="true"
                    aria-label="Loading memorial"
                  >
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton
                        key={i}
                        className="min-h-28 rounded-lg border border-frame/40 bg-surface"
                      />
                    ))}
                  </div>
                ) : graveyardError && graveyardPokemon == null ? (
                  <p className="text-sm text-muted">{graveyardError}</p>
                ) : graveyardPokemon == null ? null : graveyard.length > 0 ? (
                  <PartyStrip
                    pokemon={graveyard}
                    memorial
                    selectHint="Details"
                    showCompetitiveDetails={showCompetitiveDetails}
                    onSelect={openPokemon}
                  />
                ) : (
                  <p className="mt-0 text-sm text-muted">
                    Memorial is empty. May it stay that way.
                  </p>
                )}
              </Frame>
            </>
          )}

          <Frame
            title={frameCountTitle("Encountered", encounteredCount)}
            collapsible
            open={encounteredOpen}
            onOpenChange={onEncounteredOpenChange}
          >
            {encounteredLoading && encounteredPokemon == null ? (
              <div
                className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8"
                aria-busy="true"
                aria-label="Loading encounters"
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton
                    key={i}
                    className="min-h-24 rounded-lg border border-frame/40 bg-surface"
                  />
                ))}
              </div>
            ) : encounteredError && encounteredPokemon == null ? (
              <p className="text-sm text-muted">{encounteredError}</p>
            ) : encounteredPokemon == null ? null : canEdit ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    {encountered.length === 0
                      ? "No extra encounters logged."
                      : "Caught / seen outside the active party."}
                  </p>
                  <button
                    type="button"
                    disabled={wiping}
                    className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight disabled:opacity-60"
                    onClick={() => openAddPokemon("ENCOUNTERED")}
                  >
                    + Add
                  </button>
                </div>
                {encountered.length > 0 && (
                  <EncounteredSpeciesStrip
                    pokemon={encountered}
                    onSelect={openPokemon}
                  />
                )}
              </div>
            ) : encountered.length > 0 ? (
              <EncounteredSpeciesStrip
                pokemon={encountered}
                onSelect={openPokemon}
              />
            ) : (
              <p className="text-sm text-muted">No encounters logged yet.</p>
            )}
          </Frame>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">
          <Frame title="Stats">
            <TrainerStatsSummary
              caught={main.length + reservesCount}
              fallen={graveyardCount}
              badgesEarned={earnedBadgeKeys.length}
              badgesTotal={badges.length}
              runNumber={runNumber}
              runEnded={runEnded}
              completions={completionCount}
              money={boardTrainer.money}
              playTimeSeconds={boardTrainer.playTimeSeconds}
              updatedAt={trainer.updatedAt}
            />
          </Frame>

          <Frame title="Badge case">
            {canEdit ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  {/* A finished board is the archived record of a run; only a
                      GM correcting it should still be able to edit badges. */}
                  {runEnded && !isGm
                    ? "This run is finished — badges are locked in."
                    : "Tap a badge to toggle it."}
                </p>
                <BadgeCaseEditor
                  key={`badges-${badgeEditorKey}-${wipeCount}`}
                  trainerId={trainer.id}
                  badges={badges}
                  earnedKeys={earnedBadgeKeys}
                  wipeCount={wipeCount}
                  disabled={wiping || (runEnded && !isGm)}
                  layout="tray"
                  onEarnedKeysChange={setEarnedBadgeKeys}
                />
              </div>
            ) : (
              <BadgeCase
                badges={badges}
                earnedKeys={earnedBadgeKeys}
                layout="tray"
              />
            )}
          </Frame>
        </aside>
      </div>

      <Frame title="Shortcuts">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {seasonLinkTiles.map((item) => (
              <ShortcutLinkTile
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>

          {primaryShortcutTiles.length > 0 && (
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
              {TRAINER_BOARD_PRIMARY_ACTIONS.map((action) => (
                <Fragment key={action}>
                  {boardActionSlots[action].shortcut}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </Frame>

      {canEdit &&
        (pokemonInspect?.mode === "view" || searchPokemonLoading) && (
          <PokemonDetailsModal
            open
            loading={searchPokemonLoading && pokemonInspect == null}
            slug={challengeSlug}
            pokemon={
              pokemonInspect?.mode === "view"
                ? pokemonFormToEntry(pokemonInspect.form)
                : null
            }
            onClose={dismissSearchPokemon}
            onEdit={
              pokemonInspect?.mode === "view"
                ? () =>
                    setPokemonInspect({ ...pokemonInspect, mode: "edit" })
                : undefined
            }
            survivalMarketsEnabled={survivalMarketsEnabled}
            viewerUserId={viewerUserId}
            trainer={{
              id: trainer.id,
              handle: trainer.handle,
              avatarSpriteKey: trainer.avatarSpriteKey,
              avatarBackgroundKey: trainer.avatarBackgroundKey,
            }}
          />
        )}

      {canEdit && pokemonInspect?.mode === "edit" && (
        <PokemonFormModal
          open
          initial={pokemonInspect.form}
          teamPokemon={boardPokemon}
          pending={pending}
          onClose={() => setPokemonInspect(null)}
          onPreview={(form) => setPokemonInspect({ mode: "view", form })}
          onSave={(form) => {
            partySave.markSaving("Saving Pokémon…");
            startTransition(async () => {
              const moves = [
                form.move1,
                form.move2,
                form.move3,
                form.move4,
              ].filter(Boolean);
              const result = await upsertPokemonAction({
                id: form.id,
                trainerId: trainer.id,
                slot: form.slot,
                partyIndex: form.partyIndex,
                nickname: form.nickname || null,
                species: form.species.trim(),
                isShiny: form.isShiny,
                types: [],
                nature: form.nature || null,
                level: form.level ? Number(form.level) : null,
                ability: form.ability || null,
                catchRoute: form.catchRoute || null,
                heldItem: form.heldItem || null,
                moves,
                ivs: isEmptySpread(form.ivs) ? null : form.ivs,
                evs: isEmptySpread(form.evs) ? null : form.evs,
                friendship: form.friendship,
                causeOfDeath: form.causeOfDeath || null,
              });
              if (result.ok) {
                partySave.markSaved(result.message ?? "Pokémon saved");
                setPokemonInspect(null);
              } else {
                partySave.markError(result.error);
              }
            });
          }}
          onDelete={(pokemonId) => {
            partySave.markSaving("Removing Pokémon…");
            startTransition(async () => {
              const result = await deletePokemonAction({
                trainerId: trainer.id,
                pokemonId,
              });
              if (result.ok) {
                partySave.markSaved(result.message ?? "Pokémon removed");
                setPokemonInspect(null);
              } else {
                partySave.markError(result.error);
              }
            });
          }}
        />
      )}

      {canEdit && (
        <EndRunModal
          open={endRunOpen}
          onClose={() => setEndRunOpen(false)}
          runNumber={runNumber}
          completionCount={completionCount}
          championshipEarned={championshipEarned}
          missingChampionshipLabels={missingChampionshipLabels}
          pending={pending || wiping}
          onImportSave={() => {
            setEndRunOpen(false);
            setSaveImportOpen(true);
          }}
          onMarkFinalTeam={() => {
            void markFinalTeam();
          }}
          onStartNewRun={() => {
            void startNewRun();
          }}
        />
      )}

      {canEdit && importModalOpen && (
        <SaveImportModal
          open
          pending={pending}
          onClose={closeSaveImport}
          onApply={(payload) => {
            partySave.markSaving("Importing save…");
            startTransition(async () => {
              const result = await importFromSaveAction({
                trainerId: trainer.id,
                pokemon: payload.pokemon.map((m) => ({
                  nickname: m.nickname || null,
                  species: m.species.trim(),
                  pokedexId: m.pokedexId,
                  level: m.level ? Number(m.level) : null,
                  isShiny: m.isShiny,
                  nature: m.nature,
                  ability: m.ability,
                  catchRoute: m.catchRoute,
                  heldItem: m.heldItem,
                  moves: m.moves,
                  ivs: m.ivs,
                  evs: m.evs,
                  friendship: m.friendship,
                  slot: m.slot,
                })),
                trainerName: payload.trainerName,
                applyTrainerName: payload.applyTrainerName,
                badgeKeys: payload.badgeKeys,
                applyBadges: payload.applyBadges,
                reviveUsed: payload.reviveUsed,
                applyRevive: payload.applyRevive,
                money: payload.money,
                applyMoney: payload.applyMoney,
                playTimeSeconds: payload.playTimeSeconds,
                applyPlayTime: payload.applyPlayTime,
                saveBytesBase64: payload.saveBytesBase64,
                safariZoneAreas: payload.safariZoneAreas,
                // Living + Encountered mirror this save. Memorial is season-wide:
                // imported R.I.P. appends (deduped); prior graves are kept.
                replaceSlots: ["MAIN", "RESERVE", "ENCOUNTERED"],
              });
              if (result.ok) {
                partySave.markSaved(result.message ?? "Save imported");
                setImportSaveGlow(false);
                closeSaveImport();
                // Mirror server gate: non-GMs may only spend a revive via import.
                if (
                  payload.applyRevive &&
                  payload.reviveUsed != null &&
                  (payload.reviveUsed || isGm)
                ) {
                  setReviveUsed(payload.reviveUsed);
                }
                router.refresh();
              } else {
                partySave.markError(result.error);
              }
            });
          }}
        />
      )}

      <TeamExportModal
        open={exportModalOpen}
        onClose={closeTeamExport}
        challengeSlug={challengeSlug}
        challengeName={challengeName}
        challengeGame={challengeGame}
        trainer={{
          id: boardTrainer.id,
          handle: boardTrainer.handle,
          runNumber: runNumber,
          wipeCount: boardTrainer.wipeCount,
          completionCount,
          earnedBadgeKeys,
          pokemon: boardTrainer.pokemon,
        }}
        badges={badges}
        showCompetitiveDetails={showCompetitiveDetails}
        canEdit={canEdit}
      />

      {!isDemo && (isGm || showCompetitiveDetails) && boardHistoryOpen && (
        <BoardHistoryModal
          open
          onClose={() => setBoardHistoryOpen(false)}
          trainerId={trainer.id}
          trainerHandle={trainer.handle}
          trainerAvatarSpriteKey={trainer.avatarSpriteKey}
          trainerAvatarBackgroundKey={trainer.avatarBackgroundKey}
          challengeSlug={challengeSlug}
          challengeName={challengeName}
          challengeGame={challengeGame}
          badges={badges}
          showCompetitiveDetails={showCompetitiveDetails}
          canClearSnapshots={isGm}
          canRestoreMemorial={isGm}
          onMemorialRestored={() => {
            router.refresh();
          }}
        />
      )}

      {!canEdit && (
        <PokemonDetailsModal
          open={detailsPokemon != null || searchPokemonLoading}
          loading={searchPokemonLoading && detailsPokemon == null}
          slug={challengeSlug}
          pokemon={detailsPokemon}
          showCompetitiveDetails={showCompetitiveDetails}
          survivalMarketsEnabled={survivalMarketsEnabled}
          viewerUserId={viewerUserId}
          trainer={{
            id: trainer.id,
            handle: trainer.handle,
            avatarSpriteKey: trainer.avatarSpriteKey,
            avatarBackgroundKey: trainer.avatarBackgroundKey,
          }}
          onClose={dismissSearchPokemon}
        />
      )}

      {showMobileSaveBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-frame bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_var(--shadow)] backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              {mobileSaveStatus.kind !== "idle" && (
                <SaveStatus status={mobileSaveStatus} />
              )}
            </div>
            {editingPlayer && (
              <button
                type="button"
                disabled={pending || !handle.trim()}
                className={`${CTA_PRIMARY_SM} shrink-0 gap-1.5 disabled:opacity-60`}
                onClick={savePlayerProfile}
              >
                <SaveIcon />
                Save profile
              </button>
            )}
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
