"use client";

import type { ReactNode } from "react";

import { Modal } from "@/components/Modal";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import { CHAMPIONSHIP_BADGE_KEYS } from "@/lib/championship";

type EndRunModalProps = {
  open: boolean;
  onClose: () => void;
  /** Attempt being ended, e.g. 2 for "Run 2". */
  runNumber: number;
  /** Championship finishes already recorded this season. */
  completionCount: number;
  /** Elite Four + Champion are all on the board (server re-checks). */
  championshipEarned: boolean;
  /** Championship badges the board is still missing, in badge-case order. */
  missingChampionshipLabels: string[];
  pending: boolean;
  onImportSave: () => void;
  onMarkFinalTeam: () => void;
  onStartNewRun: () => void;
};

function ChoiceCard({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  action: ReactNode;
  tone?: "neutral" | "accent" | "danger";
}) {
  const frame =
    tone === "accent"
      ? "border-accent/40 bg-accent/5"
      : tone === "danger"
        ? "border-danger/30 bg-danger/5"
        : "border-frame/60 bg-surface-2/50";
  return (
    <div className={`gba-inset space-y-2 border p-3 ${frame}`}>
      <div className="space-y-1">
        <p className="text-sm font-bold tracking-tight">{title}</p>
        <p className="text-xs leading-relaxed text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * The one place a run ends. Every attempt closes here, whether it ended in a
 * team wipe or a Championship win — and the win is not a restart, so the two
 * outcomes are offered as separate choices rather than one button whose label
 * changes underneath the player.
 */
export function EndRunModal({
  open,
  onClose,
  runNumber,
  completionCount,
  championshipEarned,
  missingChampionshipLabels,
  pending,
  onImportSave,
  onMarkFinalTeam,
  onStartNewRun,
}: EndRunModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`End run ${runNumber}`}
      subtitle="Get the board right first, then choose how this attempt closes."
      size="md"
    >
      <div className="space-y-3">
        <ChoiceCard
          title="Import your final save"
          body="Bring the board in line with your last save file so whatever you archive is the team you actually finished with. Nothing is recorded yet."
          action={
            <button
              type="button"
              className={`${CTA_SECONDARY_SM} w-full disabled:opacity-60`}
              disabled={pending}
              onClick={onImportSave}
            >
              Import save
            </button>
          }
        />

        <ChoiceCard
          tone="accent"
          title="This is my final team"
          body={
            championshipEarned
              ? "You beat the Championship. Archives this run as a completion, keeps every Pokémon exactly where it is, and locks the board as your tournament roster. Nothing is cleared."
              : `Unlocks once the board shows the full Championship run — still missing ${missingChampionshipLabels.join(", ")}.`
          }
          action={
            <button
              type="button"
              className={`${
                championshipEarned ? CTA_PRIMARY_SM : CTA_SECONDARY_SM
              } w-full disabled:opacity-60`}
              disabled={pending || !championshipEarned}
              onClick={onMarkFinalTeam}
              title={
                championshipEarned
                  ? undefined
                  : `Requires ${CHAMPIONSHIP_BADGE_KEYS.length} badges: Elite Four + Champion`
              }
            >
              {championshipEarned
                ? "This is my final team"
                : "Championship not earned yet"}
            </button>
          }
        />

        <ChoiceCard
          tone="danger"
          title="Start a new run"
          body={`Ends this attempt and begins run ${runNumber + 1}. Clears Main Squad, Reserves, Encountered, and R.I.P. from the live board, resets badges, money, and playtime, and refreshes your revive token. A history snapshot is saved first.`}
          action={
            <button
              type="button"
              className="pressable btn-cta btn-cta-sm w-full border-danger/40 bg-danger text-white hover:brightness-105 disabled:opacity-60"
              disabled={pending}
              onClick={onStartNewRun}
            >
              Start run {runNumber + 1}
            </button>
          }
        />

        {completionCount > 0 ? (
          <p className="text-xs text-muted">
            {completionCount} completion{completionCount === 1 ? "" : "s"} on
            record this season.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
