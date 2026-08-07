"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { pushSnackbar } from "@/components/Snackbar";
import {
  findMissingHeldItems,
  type MissingHeldItemMon,
} from "@/lib/board-warnings";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import { copyText } from "@/lib/copy-text";
import type { BadgeDefinition } from "@/lib/challenge-types";
import {
  formatTrainerTeam,
  toolsChartPath,
  toolsGuidePath,
  trainerBoardPath,
  type TeamExportFormat,
  type TeamExportSnapshotMeta,
  type TeamExportTrainer,
} from "@/lib/team-export";

type TeamExportModalProps = {
  open: boolean;
  onClose: () => void;
  challengeSlug: string;
  challengeName: string;
  challengeGame: string;
  trainer: TeamExportTrainer;
  badges: BadgeDefinition[];
  showCompetitiveDetails: boolean;
  /** Set when the roster came from Trainer history instead of the live board. */
  snapshot?: TeamExportSnapshotMeta | null;
  /** Only nudge about missing held items when the viewer can go fix them. */
  canEdit?: boolean;
};

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

const FORMAT_OPTIONS: Array<{
  id: TeamExportFormat;
  label: string;
  hint: string;
}> = [
  {
    id: "llm",
    label: "LLM advice",
    hint: "Framed paste for Modern Emerald Nuzlocke team advice.",
  },
  {
    id: "showdown",
    label: "Showdown / PokePaste",
    hint: "Main Squad only — paste into Showdown or pokepaste.ovh.",
  },
];

/** Name at most this many item-less mons inline; the rest collapse to "+N more". */
const MAX_NAMED_MISSING = 4;

function missingItemNames(mons: MissingHeldItemMon[]): string {
  const named = mons.slice(0, MAX_NAMED_MISSING).map((m) => m.label);
  const rest = mons.length - named.length;
  return rest > 0 ? `${named.join(", ")} +${rest} more` : named.join(", ");
}

export function TeamExportModal({
  open,
  onClose,
  challengeSlug,
  challengeName,
  challengeGame,
  trainer,
  badges,
  showCompetitiveDetails,
  snapshot = null,
  canEdit = false,
}: TeamExportModalProps) {
  const textareaId = useId();
  const formatTabId = useId();
  const missingItemsId = useId();
  const [format, setFormat] = useState<TeamExportFormat>("llm");
  const [copied, setCopied] = useState<"team" | "link" | null>(null);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [seenOpen, setSeenOpen] = useState(open);

  // Reset format/feedback when the modal opens (render-time adjust, not an effect).
  if (open !== seenOpen) {
    setSeenOpen(open);
    setConfirmArmed(false);
    if (open) {
      setFormat("llm");
      setCopied(null);
    }
  }

  // Arming/disarming swaps the focused button out of the DOM. Keep focus on the
  // replacement control so keyboard users aren't stranded on <body>.
  const focusOnMount = useCallback((node: HTMLButtonElement | null) => {
    node?.focus();
  }, []);
  const restoreCopyFocus = useRef(false);
  const copyButtonRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node || !restoreCopyFocus.current) return;
    restoreCopyFocus.current = false;
    node.focus();
  }, []);

  /** Disarm from inside the strip, moving focus back to the Copy button. */
  function disarmConfirm() {
    restoreCopyFocus.current = true;
    setConfirmArmed(false);
  }

  const boardPath = trainerBoardPath(challengeSlug, trainer.id);
  const boardUrl = absoluteUrl(boardPath);
  const text = open
    ? formatTrainerTeam(trainer, {
        format,
        challengeName,
        challengeGame,
        challengeSlug,
        boardUrl,
        typeChartUrl: absoluteUrl(toolsChartPath(challengeSlug)),
        guideUrl: absoluteUrl(toolsGuidePath(challengeSlug)),
        showCompetitiveDetails,
        badges,
        snapshot,
      })
    : "";

  const activeHint =
    FORMAT_OPTIONS.find((o) => o.id === format)?.hint ?? FORMAT_OPTIONS[0].hint;

  // Both formats carry the Main Squad, so the nudge is the same either way —
  // but a past snapshot is as unfixable as someone else's board, so neither
  // is worth interrupting.
  const canFixHeldItems = canEdit && !snapshot;
  const missingItems =
    open && canFixHeldItems ? findMissingHeldItems(trainer.pokemon) : [];
  // Keep the two footer branches exact complements — if the board refreshes
  // mid-confirm and empties `missingItems`, the Copy button must come back.
  const showConfirm = confirmArmed && missingItems.length > 0;

  async function copyTeamText() {
    disarmConfirm();
    const ok = await copyText(text);
    if (ok) {
      setCopied("team");
      pushSnackbar(
        format === "showdown" ? "Showdown paste copied" : "Team copied",
        "success",
        2200,
      );
      window.setTimeout(
        () => setCopied((c) => (c === "team" ? null : c)),
        2000,
      );
    } else {
      pushSnackbar("Couldn’t copy — select the text instead", "error");
    }
  }

  /** First click arms the held-item nudge; the confirm CTA does the copy. */
  function handleCopyTeam() {
    if (missingItems.length > 0 && !confirmArmed) {
      setConfirmArmed(true);
      return;
    }
    void copyTeamText();
  }

  async function handleCopyLink() {
    const ok = await copyText(boardUrl);
    if (ok) {
      setCopied("link");
      pushSnackbar("Board link copied", "success", 2200);
      window.setTimeout(
        () => setCopied((c) => (c === "link" ? null : c)),
        2000,
      );
    } else {
      pushSnackbar("Couldn’t copy link", "error");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={snapshot ? "Export past team" : "Export team"}
      subtitle={activeHint}
      footer={
        <div className="space-y-2">
          {showConfirm && (
            <div
              className="space-y-1.5 rounded-lg border border-accent-2/40 bg-accent-2/10 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                // Back out of the nudge without closing the whole modal.
                if (e.key !== "Escape") return;
                e.stopPropagation();
                disarmConfirm();
              }}
            >
              <p id={missingItemsId} role="status">
                <span className="font-semibold text-accent-ink">
                  {missingItems.length === 1
                    ? "1 Main Squad Pokémon has no held item:"
                    : `${missingItems.length} Main Squad Pokémon have no held item:`}
                </span>{" "}
                <span className="text-muted">
                  {missingItemNames(missingItems)}.
                </span>
              </p>
              <p className="text-[11px] text-muted">
                Soft warning only — export anyway, or close and set their items
                first.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  ref={focusOnMount}
                  aria-describedby={missingItemsId}
                  className={CTA_PRIMARY_SM}
                  onClick={() => {
                    void copyTeamText();
                  }}
                >
                  Export anyway
                </button>
                <button
                  type="button"
                  className={CTA_SECONDARY_SM}
                  onClick={disarmConfirm}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className={CTA_SECONDARY_SM}
              onClick={() => {
                void handleCopyLink();
              }}
              title={
                snapshot
                  ? "Copies the trainer's live board URL (snapshots have no link)"
                  : "Copy shareable trainer board URL"
              }
            >
              {copied === "link" ? "Link copied!" : "Copy board link"}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={CTA_SECONDARY_SM}
                onClick={onClose}
              >
                Close
              </button>
              {!showConfirm && (
                <button
                  type="button"
                  ref={copyButtonRef}
                  className={CTA_PRIMARY_SM}
                  onClick={handleCopyTeam}
                >
                  {copied === "team" ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {snapshot && (
          <p className="border border-frame/50 bg-surface-2/40 px-3 py-2 text-xs text-muted">
            Past board · <span className="text-ink">{snapshot.label}</span> ·
            captured {snapshot.capturedAt}. Run {trainer.runNumber} as it stood
            then — not the live board.
          </p>
        )}
        <div
          role="tablist"
          aria-label="Export format"
          className="flex flex-wrap gap-2"
        >
          {FORMAT_OPTIONS.map((option) => {
            const selected = format === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                id={`${formatTabId}-${option.id}`}
                aria-selected={selected}
                className={`pressable border px-3 py-1.5 text-xs font-semibold tracking-tight ${
                  selected
                    ? "border-interactive bg-interactive-soft text-ink"
                    : "border-frame bg-surface text-muted hover:border-frame hover:text-ink"
                }`}
                onClick={() => {
                  setFormat(option.id);
                  setCopied(null);
                  // Not disarmConfirm() — focus belongs to the tab just clicked.
                  setConfirmArmed(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted">
          {format === "showdown"
            ? "Main Squad only (no reserves)"
            : "Living Main + Reserve"}
          {showCompetitiveDetails
            ? " — includes nature, moves, and spreads you can see on this board."
            : " — competitive details hidden (same as the public board view)."}
        </p>
        <label htmlFor={textareaId} className="sr-only">
          Team export text
        </label>
        <textarea
          id={textareaId}
          readOnly
          value={text}
          rows={16}
          className="w-full resize-y border border-frame bg-surface-2/40 px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </Modal>
  );
}
