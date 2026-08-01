"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  deletePokemonAction,
  gmResetTrainerBoardAction,
  importFromSaveAction,
  recordWipeAction,
  relocatePokemonAction,
  updateTrainerBoardAction,
  upsertPokemonAction,
} from "@/app/actions/challenge";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { BadgeCase } from "@/components/BadgeCase";
import { BadgeCaseEditor } from "@/components/BadgeCaseEditor";
import { BoardHistoryModal } from "@/components/BoardHistoryModal";
import { Frame } from "@/components/Frame";
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
import { PlayerCustomizationEditor } from "@/components/PlayerCustomizationEditor";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { ReviveControl } from "@/components/ReviveControl";
import { SaveImportModal } from "@/components/SaveImportModal";
import { SaveStatus, useSaveStatus } from "@/components/SaveStatus";
import { StatusLine } from "@/components/StatusLine";
import { TrainerStatsSummary } from "@/components/TrainerStatsSummary";
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
import { pokemonInSlot } from "@/lib/trainer-display";
import { RulesIcon } from "@/components/nav-icons";
import { CTA_PRIMARY_SM } from "@/lib/cta";
import { isEmptySpread } from "@/lib/stats";

type TrainerBoardProps = {
  leagueBoardHref: string;
  leagueBoardLabel: string;
  joinHref: string;
  /** When set, demo boards point signed-in players at their own board instead of login. */
  myBoardHref?: string | null;
  challengeSlug: string;
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

function BoardHistoryIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

function MemorialShortcutIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M8 20V9.5a4 4 0 018 0V20" strokeLinecap="round" />
      <path d="M6 20h12" strokeLinecap="round" />
      <path d="M12 5.5V4" strokeLinecap="round" />
    </svg>
  );
}

function EncountersShortcutIcon({ className = "h-6 w-6" }: { className?: string }) {
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
) {
  switch (tone) {
    case "accent":
      return "border-accent/35 bg-accent/15 text-accent-deep hover:brightness-105";
    case "danger":
      return "border-danger/35 bg-danger/15 text-danger hover:brightness-105";
    case "import":
      return "cta-import-save border-frame bg-surface text-ink shadow-sm";
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
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "accent" | "danger" | "import" | "neutral";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`${shortcutActionButtonBase} ${shortcutActionToneClass(tone)}`}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function ShortcutStatusTile({
  label,
  icon,
  tone = "neutral",
}: {
  label: string;
  icon: ReactNode;
  tone?: "accent" | "danger" | "import" | "neutral";
}) {
  return (
    <div
      role="status"
      className={`${shortcutActionRowBase} ${shortcutActionToneClass(tone)} cursor-default opacity-90`}
    >
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </div>
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
  trainer,
  badges,
  canEdit,
  showCompetitiveDetails = canEdit,
  isGm,
  isDemo,
}: TrainerBoardProps) {
  const [editingPlayer, setEditingPlayer] = useState(
    canEdit && trainer.pokemon.length === 0,
  );

  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const playerSave = useSaveStatus();
  const partySave = useSaveStatus();
  const reviveSave = useSaveStatus();
  const wipeSave = useSaveStatus();
  const resetSave = useSaveStatus();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const serverStamp = `${trainer.updatedAt ?? ""}|${trainer.handle}|${trainer.statusText ?? ""}|${trainer.statusEmoji ?? ""}|${trainer.realName ?? ""}|${trainer.avatarSpriteKey}|${trainer.avatarBackgroundKey ?? ""}|${trainer.cardBackgroundKey ?? ""}|${trainer.reviveUsed}|${trainer.wipeCount}|${trainer.mainSquadLocked}|${trainer.earnedBadgeKeys.join("|")}|${trainer.pokemon.map((p) => p.id).join(",")}`;
  const [seenStamp, setSeenStamp] = useState(serverStamp);

  /** Optimistic board after wipe until RSC refresh lands. */
  const [boardOverride, setBoardOverride] = useState<{
    wipeCount: number;
    pokemon: PokemonEntry[];
    mainSquadLocked: boolean;
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
  const searchParams = useSearchParams();
  const jumpPokemonId = searchParams.get("pokemon");
  const [openedJumpPokemonId, setOpenedJumpPokemonId] = useState<string | null>(
    null,
  );

  if (serverStamp !== seenStamp) {
    setSeenStamp(serverStamp);
    setCommitted({
      handle: trainer.handle,
      statusText: trainer.statusText ?? "",
      statusEmoji: trainer.statusEmoji ?? null,
      realName: trainer.realName ?? "",
      avatarSpriteKey: trainer.avatarSpriteKey,
      avatarBackgroundKey: parseAvatarBackgroundKey(trainer.avatarBackgroundKey),
      cardBackgroundKey: parseCardBackgroundKey(trainer.cardBackgroundKey),
      reviveUsed: trainer.reviveUsed,
    });
    const nextAvatarBg = parseAvatarBackgroundKey(trainer.avatarBackgroundKey);
    if (nextAvatarBg && !isAvatarBackgroundKey(nextAvatarBg)) {
      setSavedCustomAvatarBg(nextAvatarBg);
    }
    const nextCardBg = parseCardBackgroundKey(trainer.cardBackgroundKey);
    if (nextCardBg && !isCardBackgroundKey(nextCardBg)) {
      setSavedCustomCardBg(nextCardBg);
    }
    setReviveUsed(trainer.reviveUsed);
    setEarnedBadgeKeys(trainer.earnedBadgeKeys);
    setBoardOverride(null);
  }

  const boardPokemon = boardOverride?.pokemon ?? trainer.pokemon;
  const wipeCount = boardOverride?.wipeCount ?? trainer.wipeCount ?? 0;
  const mainSquadLocked =
    boardOverride?.mainSquadLocked ?? trainer.mainSquadLocked;
  const boardTrainer = {
    ...trainer,
    pokemon: boardPokemon,
    wipeCount,
    mainSquadLocked,
  };

  const main = pokemonInSlot(boardTrainer, "MAIN");
  const reserves = pokemonInSlot(boardTrainer, "RESERVE");
  const graveyard = pokemonInSlot(boardTrainer, "GRAVEYARD");
  const encountered = pokemonInSlot(boardTrainer, "ENCOUNTERED");
  const wipeButtonClass =
    "pressable inline-flex h-9 items-center justify-center gap-1.5 border-danger/25 bg-danger/10 px-3 text-xs font-semibold tracking-tight text-danger disabled:opacity-60";
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
      href: `${leagueBoardHref}/memorial`,
      label: "Memorial",
      icon: <MemorialShortcutIcon />,
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

  async function spendReviveToken() {
    const ok = await confirm({
      title: "Use revive token?",
      description:
        "This spends your one revive for the season. You can’t undo it without a GM reset.",
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
      description: "This restores the trainer’s revive so they can use it again.",
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

  async function recordWipe() {
    const nextWipe = wipeCount + 1;
    const previousBadges = earnedBadgeKeys;
    const previousBoard = boardOverride;
    const ok = await confirm({
      title: "Restart this run?",
      description: (
        <>
          Clears Main Squad, Reserves, and Encountered, and resets badges. R.I.P.
          memorial, revive token, and your profile (name, avatar, backdrops,
          status) stay. Locked Main Squad unlocks so you can rebuild. This counts
          as wipe #{nextWipe}. A board history snapshot is saved for GMs first.
        </>
      ),
      confirmLabel: "Record wipe",
      tone: "danger",
    });
    if (!ok) return;

    setBadgeEditorKey((k) => k + 1);
    setEarnedBadgeKeys([]);
    setBoardOverride({
      wipeCount: nextWipe,
      pokemon: boardPokemon.filter((p) => p.slot === "GRAVEYARD"),
      mainSquadLocked: false,
    });
    setPokemonInspect(null);
    setDetailsPokemon(null);
    setSaveImportOpen(false);

    wipeSave.markSaving("Recording wipe…");
    startTransition(async () => {
      const result = await recordWipeAction({ trainerId: trainer.id });
      if (result.ok) {
        wipeSave.markSaved(result.message ?? "Wipe recorded");
        router.refresh();
      } else {
        setBoardOverride(previousBoard);
        setEarnedBadgeKeys(previousBadges);
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
          GM hard reset: clears Main, Reserves, Encountered, and R.I.P. memorial,
          and resets badges, wipe count, and revive token. Profile stays (name,
          avatar, backdrops, status). A board history snapshot is saved first.
          Use for an official fresh start — not a mid-run wipe.
        </>
      ),
      confirmLabel: "Reset board",
      tone: "danger",
    });
    if (!ok) return;

    setBadgeEditorKey((k) => k + 1);
    setEarnedBadgeKeys([]);
    setBoardOverride({
      wipeCount: 0,
      pokemon: [],
      mainSquadLocked: false,
    });
    setCommitted((prev) => ({
      ...prev,
      reviveUsed: false,
    }));
    setReviveUsed(false);
    setPokemonInspect(null);
    setDetailsPokemon(null);
    setSaveImportOpen(false);

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
    if (partyIndex == null) {
      const used = new Set(
        boardPokemon.filter((p) => p.slot === slot).map((p) => p.partyIndex),
      );
      partyIndex = 0;
      // MAIN is fixed 0–5; other sections can grow with drag-and-drop densifying.
      const limit = slot === "MAIN" ? 6 : 1000;
      while (used.has(partyIndex) && partyIndex < limit) partyIndex += 1;
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

  // League Jump deep-link: /trainers/:id?pokemon=:pokemonId opens that mon.
  if (!jumpPokemonId && openedJumpPokemonId) {
    setOpenedJumpPokemonId(null);
  } else if (jumpPokemonId && jumpPokemonId !== openedJumpPokemonId) {
    const mon = boardPokemon.find((p) => p.id === jumpPokemonId) ?? null;
    setOpenedJumpPokemonId(jumpPokemonId);
    if (mon) {
      if (canEdit) {
        setPokemonInspect({
          mode: "view",
          form: pokemonEntryToForm(mon),
        });
      } else {
        setDetailsPokemon(mon);
      }
    }
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
    canEdit &&
    (editingPlayer || mobileSaveStatus.kind !== "idle");

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
        <div className="flex flex-wrap items-center gap-2">
          {!isDemo ? (
            <ReviveControl
              used={reviveUsed}
              canUse={canEdit}
              canReset={isGm}
              disabled={pending}
              onUse={spendReviveToken}
              onReset={resetReviveToken}
              status={
                canEdit || isGm ? (
                  <SaveStatus status={reviveSave.status} />
                ) : null
              }
            />
          ) : null}
          {canEdit ? (
            <button
              type="button"
              data-tour="import-save"
              className="pressable cta-import-save inline-flex h-9 items-center gap-1.5 border-frame bg-surface px-3 text-xs font-semibold tracking-tight text-ink disabled:opacity-60"
              disabled={pending || wiping}
              onClick={() => setSaveImportOpen(true)}
            >
              <ImportSaveIcon />
              <span>Import save</span>
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              disabled={pending || wiping}
              className={wipeButtonClass}
              onClick={() => {
                void recordWipe();
              }}
            >
              <WipeIcon />
              Record wipe
            </button>
          ) : null}
          {isGm && !isDemo ? (
            <button
              type="button"
              disabled={pending || wiping}
              className="pressable inline-flex h-9 items-center gap-1.5 border-frame bg-surface px-3 text-xs font-semibold tracking-tight text-ink disabled:opacity-60"
              onClick={() => setBoardHistoryOpen(true)}
            >
              <BoardHistoryIcon />
              Board history
            </button>
          ) : null}
          {isGm && !isDemo ? (
            <button
              type="button"
              disabled={pending || wiping}
              className={wipeButtonClass}
              onClick={() => {
                void resetTrainerBoard();
              }}
            >
              <ResetBoardIcon />
              Reset board
            </button>
          ) : null}
        </div>
      </div>

      {canEdit && wipeSave.status.kind !== "idle" ? (
        <div className="flex justify-end">
          <SaveStatus status={wipeSave.status} />
        </div>
      ) : null}
      {isGm && !isDemo && resetSave.status.kind !== "idle" ? (
        <div className="flex justify-end">
          <SaveStatus status={resetSave.status} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {canEdit
            ? "Your board — profile saves explicitly; party and badges save as you go."
            : "Trainer board"}
        </p>
        {canEdit ? (
          <div className="hidden sm:block">
            <SaveStatus status={partySave.status} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="space-y-6">
          <Frame
            data-tour="player"
            title="Player"
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
                      aria-label="Customize player profile"
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
                  {trainer.discordUsername || trainer.discordDisplayName ? (
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
                        trainer.discordUsername.toLowerCase() ? (
                        <span> · {trainer.discordDisplayName}</span>
                      ) : null}
                    </p>
                  ) : null}
                  {(mainSquadLocked || isDemo) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {mainSquadLocked ? (
                        <span className="rounded-lg border border-frame bg-accent-2/25 px-2 py-1 font-display text-[10px] font-semibold tracking-tight">
                          Main Squad locked
                        </span>
                      ) : null}
                      {isDemo ? (
                        <span className="rounded-lg border border-frame bg-surface-2 px-2 py-1 font-display text-[10px] font-semibold tracking-tight">
                          Demo example
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <StatusLine
                    emoji={committed.statusEmoji}
                    text={committed.statusText}
                    className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base"
                  />
                  {isDemo ? (
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
                  ) : null}
                  {canEdit && boardPokemon.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">
                      Your board is ready — customize your profile, then use{" "}
                      <span className="font-semibold text-ink">Import save</span>{" "}
                      at the top once you have a file from Afterplay. You can
                      also tap party slots and badges by hand.
                    </p>
                  ) : null}
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
                <button
                  type="button"
                  disabled={wiping}
                  className="pressable rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold tracking-tight text-[var(--on-accent)] disabled:opacity-60"
                  onClick={() => openAddPokemon("MAIN")}
                >
                  + Add
                </button>
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
            />
          ) : (
            <>
              <Frame title="Main Squad" data-tour="pokemon">
                <PartyStrip
                  pokemon={main}
                  slots={6}
                  selectHint="Details"
                  showCompetitiveDetails={showCompetitiveDetails}
                  onSelect={openPokemon}
                />
              </Frame>

              <Frame title="The Reserves">
                {reserves.length > 0 ? (
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

              <Frame title="R.I.P." tone="rip">
                {graveyard.length > 0 ? (
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

          <Frame title="Encountered">
            {canEdit ? (
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
                {encountered.length > 0 ? (
                  <PartyStrip
                    pokemon={encountered}
                    selectHint="View"
                    onSelect={openPokemon}
                  />
                ) : null}
              </div>
            ) : encountered.length > 0 ? (
              <PartyStrip
                pokemon={encountered}
                selectHint="Details"
                showCompetitiveDetails={showCompetitiveDetails}
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
              caught={main.length + reserves.length}
              fallen={graveyard.length}
              badgesEarned={earnedBadgeKeys.length}
              badgesTotal={badges.length}
              wipes={wipeCount}
              updatedAt={trainer.updatedAt}
            />
          </Frame>

          <Frame title="Badge case">
            {canEdit ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">Tap a badge to toggle it.</p>
                <BadgeCaseEditor
                  key={`badges-${badgeEditorKey}-${wipeCount}`}
                  trainerId={trainer.id}
                  badges={badges}
                  earnedKeys={earnedBadgeKeys}
                  wipeCount={wipeCount}
                  disabled={wiping}
                  layout="column"
                  onEarnedKeysChange={setEarnedBadgeKeys}
                />
              </div>
            ) : (
              <BadgeCase
                badges={badges}
                earnedKeys={earnedBadgeKeys}
                layout="column"
              />
            )}
          </Frame>
        </aside>
      </div>

      <Frame title="Shortcuts">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:grid-cols-5">
            {seasonLinkTiles.map((item) => (
              <ShortcutLinkTile
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>

          {canEdit || (isGm && !isDemo) ? (
            <div className="flex w-full flex-col gap-2 sm:w-52 sm:shrink-0 sm:self-stretch">
              {canEdit && !isDemo && !reviveUsed ? (
                <ShortcutActionTile
                  label="Use Revive Token"
                  icon={<ReviveShortcutIcon className="h-4 w-4" />}
                  tone="accent"
                  disabled={pending || wiping}
                  onClick={() => {
                    void spendReviveToken();
                  }}
                />
              ) : null}
              {isGm && !isDemo && reviveUsed ? (
                <ShortcutActionTile
                  label="Reset revive"
                  icon={<ReviveShortcutIcon className="h-4 w-4" />}
                  tone="danger"
                  disabled={pending || wiping}
                  title="Reset revive token"
                  onClick={() => {
                    void resetReviveToken();
                  }}
                />
              ) : null}
              {canEdit && !isDemo && reviveUsed && !isGm ? (
                <ShortcutStatusTile
                  label="Revive used"
                  icon={<ReviveShortcutIcon className="h-4 w-4" />}
                  tone="danger"
                />
              ) : null}
              {canEdit ? (
                <ShortcutActionTile
                  label="Import save"
                  icon={<ImportSaveIcon className="h-4 w-4" />}
                  tone="import"
                  disabled={pending || wiping}
                  onClick={() => setSaveImportOpen(true)}
                />
              ) : null}
              {canEdit ? (
                <ShortcutActionTile
                  label="Record wipe"
                  icon={<WipeIcon className="h-4 w-4" />}
                  tone="danger"
                  disabled={pending || wiping}
                  onClick={() => {
                    void recordWipe();
                  }}
                />
              ) : null}
              {isGm && !isDemo ? (
                <ShortcutActionTile
                  label="Board history"
                  icon={<BoardHistoryIcon className="h-4 w-4" />}
                  tone="neutral"
                  disabled={pending || wiping}
                  title="GM-only past boards"
                  onClick={() => setBoardHistoryOpen(true)}
                />
              ) : null}
              {isGm && !isDemo ? (
                <ShortcutActionTile
                  label="Reset board"
                  icon={<ResetBoardIcon className="h-4 w-4" />}
                  tone="danger"
                  disabled={pending || wiping}
                  title="GM hard reset — zeros wipe count"
                  onClick={() => {
                    void resetTrainerBoard();
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </Frame>

      {canEdit && pokemonInspect?.mode === "view" ? (
        <PokemonDetailsModal
          open
          pokemon={pokemonFormToEntry(pokemonInspect.form)}
          onClose={() => setPokemonInspect(null)}
          onEdit={() =>
            setPokemonInspect({ ...pokemonInspect, mode: "edit" })
          }
        />
      ) : null}

      {canEdit && pokemonInspect?.mode === "edit" ? (
        <PokemonFormModal
          open
          initial={pokemonInspect.form}
          teamPokemon={boardPokemon}
          pending={pending}
          onClose={() => setPokemonInspect(null)}
          onPreview={(form) =>
            setPokemonInspect({ mode: "view", form })
          }
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
      ) : null}

      {canEdit ? (
        <SaveImportModal
          open={saveImportOpen}
          pending={pending}
          onClose={() => setSaveImportOpen(false)}
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
                  slot: m.slot,
                })),
                trainerName: payload.trainerName,
                applyTrainerName: payload.applyTrainerName,
                badgeKeys: payload.badgeKeys,
                applyBadges: payload.applyBadges,
                reviveUsed: payload.reviveUsed,
                applyRevive: payload.applyRevive,
                // Each category mirrors this save: unchecked mons clear that
                // slot group (including Encountered / Pokédex seen).
                replaceSlots: [
                  "MAIN",
                  "RESERVE",
                  "GRAVEYARD",
                  "ENCOUNTERED",
                ],
              });
              if (result.ok) {
                partySave.markSaved(result.message ?? "Save imported");
                setSaveImportOpen(false);
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
      ) : null}

      {isGm && !isDemo && boardHistoryOpen ? (
        <BoardHistoryModal
          open
          onClose={() => setBoardHistoryOpen(false)}
          trainerId={trainer.id}
          trainerHandle={trainer.handle}
          badges={badges}
          showCompetitiveDetails={showCompetitiveDetails}
        />
      ) : null}

      {!canEdit ? (
        <PokemonDetailsModal
          open={detailsPokemon != null}
          pokemon={detailsPokemon}
          showCompetitiveDetails={showCompetitiveDetails}
          onClose={() => setDetailsPokemon(null)}
        />
      ) : null}

      {showMobileSaveBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-frame bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_var(--shadow)] backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              {mobileSaveStatus.kind !== "idle" ? (
                <SaveStatus status={mobileSaveStatus} />
              ) : null}
            </div>
            {editingPlayer ? (
              <button
                type="button"
                disabled={pending || !handle.trim()}
                className={`${CTA_PRIMARY_SM} shrink-0 gap-1.5 disabled:opacity-60`}
                onClick={savePlayerProfile}
              >
                <SaveIcon />
                Save profile
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  );
}
