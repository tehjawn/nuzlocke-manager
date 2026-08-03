"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/Modal";
import { pushSnackbar } from "@/components/Snackbar";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import { copyText } from "@/lib/copy-text";
import type { BadgeDefinition, TrainerProfile } from "@/lib/challenge-types";
import {
  formatTrainerTeam,
  toolsChartPath,
  toolsGuidePath,
  trainerBoardPath,
  type TeamExportFormat,
} from "@/lib/team-export";

type TeamExportModalProps = {
  open: boolean;
  onClose: () => void;
  challengeSlug: string;
  challengeName: string;
  challengeGame: string;
  trainer: TrainerProfile;
  badges: BadgeDefinition[];
  showCompetitiveDetails: boolean;
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

export function TeamExportModal({
  open,
  onClose,
  challengeSlug,
  challengeName,
  challengeGame,
  trainer,
  badges,
  showCompetitiveDetails,
}: TeamExportModalProps) {
  const textareaId = useId();
  const formatTabId = useId();
  const [format, setFormat] = useState<TeamExportFormat>("llm");
  const [copied, setCopied] = useState<"team" | "link" | null>(null);
  const [seenOpen, setSeenOpen] = useState(open);

  // Reset format/feedback when the modal opens (render-time adjust, not an effect).
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setFormat("llm");
      setCopied(null);
    }
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
      })
    : "";

  const activeHint =
    FORMAT_OPTIONS.find((o) => o.id === format)?.hint ?? FORMAT_OPTIONS[0].hint;

  async function handleCopyTeam() {
    const ok = await copyText(text);
    if (ok) {
      setCopied("team");
      pushSnackbar(
        format === "showdown" ? "Showdown paste copied" : "Team copied",
        "success",
        2200,
      );
      window.setTimeout(() => setCopied((c) => (c === "team" ? null : c)), 2000);
    } else {
      pushSnackbar("Couldn’t copy — select the text instead", "error");
    }
  }

  async function handleCopyLink() {
    const ok = await copyText(boardUrl);
    if (ok) {
      setCopied("link");
      pushSnackbar("Board link copied", "success", 2200);
      window.setTimeout(() => setCopied((c) => (c === "link" ? null : c)), 2000);
    } else {
      pushSnackbar("Couldn’t copy link", "error");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Export team"
      subtitle={activeHint}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className={CTA_SECONDARY_SM}
            onClick={() => {
              void handleCopyLink();
            }}
          >
            {copied === "link" ? "Link copied!" : "Copy board link"}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={CTA_SECONDARY_SM} onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className={CTA_PRIMARY_SM}
              onClick={() => {
                void handleCopyTeam();
              }}
            >
              {copied === "team" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
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
