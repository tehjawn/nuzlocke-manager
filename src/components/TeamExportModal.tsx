"use client";

import { useEffect, useId, useState } from "react";
import { Modal } from "@/components/Modal";
import { pushSnackbar } from "@/components/Snackbar";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import { copyText } from "@/lib/copy-text";
import type { BadgeDefinition, TrainerProfile } from "@/lib/challenge-types";
import {
  formatTrainerTeamExport,
  toolsChartPath,
  toolsGuidePath,
  trainerBoardPath,
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
  const [text, setText] = useState("");
  const [copied, setCopied] = useState<"team" | "link" | null>(null);

  useEffect(() => {
    if (!open) {
      setCopied(null);
      return;
    }
    const boardPath = trainerBoardPath(challengeSlug, trainer.id);
    setText(
      formatTrainerTeamExport(trainer, {
        challengeName,
        challengeGame,
        challengeSlug,
        boardUrl: absoluteUrl(boardPath),
        typeChartUrl: absoluteUrl(toolsChartPath(challengeSlug)),
        guideUrl: absoluteUrl(toolsGuidePath(challengeSlug)),
        showCompetitiveDetails,
        badges,
      }),
    );
  }, [
    open,
    challengeSlug,
    challengeName,
    challengeGame,
    trainer,
    badges,
    showCompetitiveDetails,
  ]);

  const boardUrl = absoluteUrl(trainerBoardPath(challengeSlug, trainer.id));

  async function handleCopyTeam() {
    const ok = await copyText(text);
    if (ok) {
      setCopied("team");
      pushSnackbar("Team copied", "success", 2200);
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
      subtitle="Paste into an LLM for Modern Emerald Nuzlocke team advice."
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
        <p className="text-sm text-muted">
          Living Main + Reserve only
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
