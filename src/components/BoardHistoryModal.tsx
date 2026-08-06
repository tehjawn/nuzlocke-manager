"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getTrainerBoardSnapshotAction,
  gmApplyMemorialBackfillAction,
  gmClearTrainerBoardHistoryAction,
  listTrainerHistoryAction,
  previewMemorialBackfillAction,
  type MemorialBackfillPreviewItem,
  type TrainerHistoryGrave,
  type TrainerHistoryRunSummary,
} from "@/app/actions/challenge";
import { BadgeCase } from "@/components/BadgeCase";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Frame, frameCountTitle } from "@/components/Frame";
import { Modal } from "@/components/Modal";
import { PartyStrip } from "@/components/PartyStrip";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { TeamExportModal } from "@/components/TeamExportModal";
import { TombstoneIcon } from "@/components/TombstoneIcon";
import type {
  BadgeDefinition,
  PokemonEntry,
} from "@/lib/challenge-types";
import type { TrainerBoardSnapshotPayload } from "@/lib/board-snapshot";
import { snapshotTriggerLabel } from "@/lib/board-snapshot";

type TrainerHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  trainerId: string;
  trainerHandle: string;
  trainerAvatarSpriteKey?: string;
  trainerAvatarBackgroundKey?: string | null;
  /** Challenge context for the past-board team export. */
  challengeSlug: string;
  challengeName: string;
  challengeGame: string;
  badges: BadgeDefinition[];
  showCompetitiveDetails?: boolean;
  /** GM-only clear control; owners can still browse. */
  canClearSnapshots?: boolean;
  /** GM-only: restore missing memorial rows from snapshots. */
  canRestoreMemorial?: boolean;
  /** Called after a successful memorial restore so the board can refresh. */
  onMemorialRestored?: () => void;
};

function slotPokemon(
  pokemon: PokemonEntry[],
  slot: PokemonEntry["slot"],
): PokemonEntry[] {
  return pokemon
    .filter((p) => p.slot === slot)
    .sort((a, b) => a.partyIndex - b.partyIndex);
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Per-run memorial: live rows for the active run, snapshot-derived for closed. */
function RunGraves({ graves }: { graves: TrainerHistoryGrave[] }) {
  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {graves.map((grave) => (
        <li
          key={grave.key}
          className="flex gap-2 rounded-md border border-frame/35 bg-surface/65 p-2"
          title={
            grave.source === "snapshot"
              ? "Recovered from board history — this run was cleared by a wipe"
              : undefined
          }
        >
          <div className="relative h-10 w-10 shrink-0">
            <PokemonSpriteImage
              alt=""
              className="pixelated h-full w-full object-contain opacity-90"
              height={40}
              pokedexId={grave.pokedexId}
              shiny={grave.isShiny}
              species={grave.species}
              width={40}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-[11px] font-bold leading-tight">
              {grave.label}
              {grave.isShiny ? (
                <span className="ml-0.5 text-accent-2" title="Shiny">
                  ✦
                </span>
              ) : null}
            </p>
            <p className="truncate text-[10px] leading-tight text-muted">
              {grave.species}
              {grave.level != null ? ` · Lv.${grave.level}` : ""}
            </p>
            {grave.causeOfDeath ? (
              <p
                className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink/90"
                title={grave.causeOfDeath}
              >
                <TombstoneIcon className="mr-1 inline-block h-2.5 w-2.5 shrink-0 align-[-1px]" />
                {grave.causeOfDeath}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function runHeadline(run: TrainerHistoryRunSummary): string {
  if (run.status === "ACTIVE") return `Run ${run.runNumber} · Active`;
  const reason =
    run.endReason === "GM_RESET"
      ? "GM reset"
      : run.endReason === "WIPE"
        ? "Wiped"
        : run.endReason === "VICTORY"
          ? "Champion"
          : "Closed";
  return `Run ${run.runNumber} · ${reason}`;
}

function TrainerHistoryBody({
  onClose,
  trainerId,
  trainerHandle,
  trainerAvatarSpriteKey = "brendan",
  trainerAvatarBackgroundKey = null,
  challengeSlug,
  challengeName,
  challengeGame,
  badges,
  showCompetitiveDetails = true,
  canClearSnapshots = false,
  canRestoreMemorial = false,
  onMemorialRestored,
}: Omit<TrainerHistoryModalProps, "open">) {
  const [pending, startTransition] = useTransition();
  const [clearing, setClearing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [runs, setRuns] = useState<TrainerHistoryRunSummary[]>([]);
  const [allowClear, setAllowClear] = useState(canClearSnapshots);
  const [openRunIds, setOpenRunIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    id: string;
    label: string | null;
    triggerLabel: string;
    createdAt: string;
    summary: string;
    /** Run the snapshot sits under in the accordion. */
    runNumber: number;
    payload: TrainerBoardSnapshotPayload;
  } | null>(null);
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );
  const [exportOpen, setExportOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  useEffect(() => {
    let cancelled = false;

    void listTrainerHistoryAction({ trainerId })
      .then((result) => {
        if (cancelled) return;
        setListLoading(false);
        if (!result.ok) {
          setError(result.error);
          setRuns([]);
          return;
        }
        setRuns(result.runs);
        setAllowClear(result.canClearSnapshots);
        const initial = new Set<string>();
        const active = result.runs.find((run) => run.status === "ACTIVE");
        if (active) initial.add(active.id);
        else if (result.runs[0]) initial.add(result.runs[0].id);
        setOpenRunIds(initial);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setListLoading(false);
        setError(
          e instanceof Error ? e.message : "Could not load trainer history",
        );
        setRuns([]);
      });

    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  function toggleRun(id: string) {
    setOpenRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openSnapshot(id: string, runNumber: number) {
    setSelectedId(id);
    setError(null);
    setDetailsPokemon(null);
    setExportOpen(false);
    startTransition(async () => {
      const result = await getTrainerBoardSnapshotAction({ snapshotId: id });
      if (!result.ok) {
        setDetail(null);
        setError(result.error);
        return;
      }
      setDetail({
        id: result.snapshot.id,
        label: result.snapshot.label,
        triggerLabel: result.snapshot.triggerLabel,
        createdAt: result.snapshot.createdAt,
        summary: result.snapshot.summary,
        runNumber,
        payload: result.snapshot.payload,
      });
    });
  }

  function backToList() {
    setDetail(null);
    setSelectedId(null);
    setDetailsPokemon(null);
    setExportOpen(false);
  }

  async function clearHistory() {
    const ok = await confirm({
      title: "Clear board snapshots?",
      description: (
        <>
          Permanently deletes every board snapshot for {trainerHandle} (the
          list below may only show the most recent ones). Run ledger (revive /
          badge archives) stays, but graves from closed runs are read back from
          these snapshots — clearing them removes those partners from the
          Memorial for good. This cannot be undone.
        </>
      ),
      confirmLabel: "Clear snapshots",
      tone: "danger",
    });
    if (!ok) return;

    setError(null);
    setStatusMessage(null);
    setClearing(true);
    startTransition(async () => {
      try {
        const result = await gmClearTrainerBoardHistoryAction({ trainerId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Snapshot-derived graves are gone with the snapshots they came from.
        setRuns((prev) =>
          prev.map((run) => ({
            ...run,
            snapshots: [],
            graves: run.graves.filter((grave) => grave.source === "live"),
          })),
        );
        setDetail(null);
        setSelectedId(null);
        setDetailsPokemon(null);
        setExportOpen(false);
        setStatusMessage(result.message ?? "Snapshots cleared");
      } finally {
        setClearing(false);
      }
    });
  }

  async function restoreMemorial() {
    setError(null);
    setStatusMessage(null);
    setRestoring(true);
    try {
      const preview = await previewMemorialBackfillAction({ trainerId });
      if (!preview.ok) {
        setError(preview.error);
        return;
      }
      if (preview.candidates.length === 0) {
        setStatusMessage(
          "Memorial already has every recoverable R.I.P. from history.",
        );
        return;
      }

      const sample = preview.candidates
        .slice(0, 8)
        .map((c: MemorialBackfillPreviewItem) => {
          const run = `Run ${c.diedOnRun}`;
          return `${c.label} (${run})`;
        })
        .join(", ");
      const extra =
        preview.candidates.length > 8
          ? ` +${preview.candidates.length - 8} more`
          : "";

      const ok = await confirm({
        title: "Restore memorial from history?",
        description: (
          <>
            Adds {preview.candidates.length} missing R.I.P. entr
            {preview.candidates.length === 1 ? "y" : "ies"} for{" "}
            {trainerHandle} to the live board, from the current run&rsquo;s
            latest snapshot. Closed runs are not touched — their graves already
            show in the Memorial, read from history. Existing graves stay;
            duplicates (same species + nickname) are skipped.
            {preview.runsRestored.length > 0 ? (
              <>
                {" "}
                Runs covered: {preview.runsRestored.join(", ")}.
              </>
            ) : null}
            {preview.runsSkipped.length > 0 ? (
              <>
                {" "}
                No snapshot for run
                {preview.runsSkipped.length === 1 ? "" : "s"}{" "}
                {preview.runsSkipped.join(", ")}.
              </>
            ) : null}
            <span className="mt-2 block text-muted">
              {sample}
              {extra}
            </span>
          </>
        ),
        confirmLabel: `Restore ${preview.candidates.length}`,
        tone: "primary",
      });
      if (!ok) return;

      const result = await gmApplyMemorialBackfillAction({ trainerId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatusMessage(result.message ?? "Memorial restored");
      // The run rows now show per-run R.I.P., and router.refresh() only
      // re-renders server components — pull the accordion's data again. A
      // failure here must not read as a failed restore; the write is done.
      const refreshed = await listTrainerHistoryAction({ trainerId }).catch(
        () => null,
      );
      if (refreshed?.ok) setRuns(refreshed.runs);
      onMemorialRestored?.();
    } finally {
      setRestoring(false);
    }
  }

  const viewingDetail = detail != null;
  const main = detail ? slotPokemon(detail.payload.pokemon, "MAIN") : [];
  const reserves = detail
    ? slotPokemon(detail.payload.pokemon, "RESERVE")
    : [];
  const graveyard = detail
    ? slotPokemon(detail.payload.pokemon, "GRAVEYARD")
    : [];
  const encountered = detail
    ? slotPokemon(detail.payload.pokemon, "ENCOUNTERED")
    : [];
  /** Nothing to paste when a snapshot captured an already-empty roster. */
  const canExportDetail = main.length > 0 || reserves.length > 0;
  const canClearHistory =
    allowClear &&
    !listLoading &&
    runs.some((run) => run.snapshots.length > 0) &&
    !viewingDetail;
  const canRestore =
    canRestoreMemorial &&
    !listLoading &&
    runs.some((run) => run.snapshots.length > 0) &&
    !viewingDetail;

  return (
    <>
      <Modal
        open
        title={viewingDetail ? "Past board" : "Trainer history"}
        subtitle={
          viewingDetail
            ? `${trainerHandle} · ${detail.label ?? detail.triggerLabel} · ${formatWhen(detail.createdAt)}`
            : `${trainerHandle} · runs & board snapshots`
        }
        size="fullscreen"
        onClose={onClose}
        headerActions={
          viewingDetail ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
                onClick={backToList}
              >
                ← All runs
              </button>
              {canExportDetail ? (
                <button
                  type="button"
                  className="pressable border-frame bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
                  onClick={() => setExportOpen(true)}
                  title="Copy this past roster for LLM / notes"
                >
                  Export team
                </button>
              ) : null}
            </div>
          ) : canRestore || canClearHistory ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canRestore ? (
                <button
                  type="button"
                  disabled={restoring || clearing || pending}
                  className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink disabled:opacity-60"
                  onClick={() => {
                    void restoreMemorial();
                  }}
                >
                  {restoring ? "Restoring…" : "Restore memorial"}
                </button>
              ) : null}
              {canClearHistory ? (
                <button
                  type="button"
                  disabled={clearing || restoring || pending}
                  className="pressable border-danger/35 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger disabled:opacity-60"
                  onClick={() => {
                    void clearHistory();
                  }}
                >
                  {clearing ? "Clearing…" : "Clear snapshots"}
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {error ? (
          <p className="mb-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="mb-3 text-sm text-interactive" role="status">
            {statusMessage}
          </p>
        ) : null}

        {viewingDetail && detail ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Read-only snapshot · {detail.summary}
              {detail.payload.wipeCount > 0
                ? ` · recorded at wipe #${detail.payload.wipeCount}`
                : null}
              {detail.payload.reviveUsed ? " · revive used" : null}
            </p>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <Frame title="Main Squad">
                  <PartyStrip
                    pokemon={main}
                    slots={6}
                    selectHint="Details"
                    showCompetitiveDetails={showCompetitiveDetails}
                    onSelect={setDetailsPokemon}
                  />
                </Frame>
                <Frame title="The Reserves">
                  {reserves.length > 0 ? (
                    <PartyStrip
                      pokemon={reserves}
                      selectHint="Details"
                      showCompetitiveDetails={showCompetitiveDetails}
                      onSelect={setDetailsPokemon}
                    />
                  ) : (
                    <p className="text-sm text-muted">No reserves.</p>
                  )}
                </Frame>
                <Frame title="R.I.P." tone="rip">
                  {graveyard.length > 0 ? (
                    <PartyStrip
                      pokemon={graveyard}
                      memorial
                      selectHint="Details"
                      showCompetitiveDetails={showCompetitiveDetails}
                      onSelect={setDetailsPokemon}
                    />
                  ) : (
                    <p className="text-sm text-muted">Memorial empty.</p>
                  )}
                </Frame>
                {encountered.length > 0 ? (
                  <Frame title="Encountered">
                    <PartyStrip
                      pokemon={encountered}
                      speciesOnly
                      onSelect={setDetailsPokemon}
                    />
                  </Frame>
                ) : null}
              </div>
              <aside>
                <Frame title="Badges">
                  <BadgeCase
                    badges={badges}
                    earnedKeys={detail.payload.earnedBadgeKeys}
                    layout="column"
                    dense
                  />
                </Frame>
              </aside>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Each run keeps its revive + badge archive. Board snapshots sit
              inside the run they were taken from (before wipe, import, or GM
              reset). A wipe clears the live board, so graves from closed runs
              are read back from that run&rsquo;s snapshot.
              {canRestoreMemorial
                ? " GMs can restore missing R.I.P. for the current run from those snapshots."
                : null}
            </p>
            {listLoading ? (
              <p className="text-sm text-muted">Loading history…</p>
            ) : null}
            {!listLoading && runs.length === 0 && !error ? (
              <p className="text-sm text-muted">
                No runs recorded for this trainer yet.
              </p>
            ) : null}
            {!listLoading && runs.length > 0 ? (
              <ul className="space-y-2">
                {runs.map((run) => {
                  const expanded = openRunIds.has(run.id);
                  return (
                    <li
                      key={run.id}
                      className="overflow-hidden rounded-md border border-frame/40 bg-surface/50"
                    >
                      <button
                        type="button"
                        className="pressable flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2/60"
                        onClick={() => toggleRun(run.id)}
                        aria-expanded={expanded}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink">
                            {runHeadline(run)}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted">
                            {run.reviveUsed ? "Revive used" : "Revive unused"}
                            {" · "}
                            {run.status === "ACTIVE"
                              ? "Badges live on the board"
                              : `${run.earnedBadgeKeys.length} badge${run.earnedBadgeKeys.length === 1 ? "" : "s"} archived`}
                            {" · "}
                            {run.snapshots.length} snapshot
                            {run.snapshots.length === 1 ? "" : "s"}
                            {" · "}
                            {run.graves.length} R.I.P.
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-bold text-muted">
                          {expanded ? "▾" : "▸"}
                        </span>
                      </button>

                      {expanded ? (
                        <div className="space-y-3 border-t border-frame/30 px-3 py-3">
                          {run.graves.length > 0 ? (
                            <Frame
                              title={frameCountTitle(
                                "R.I.P.",
                                run.graves.length,
                              )}
                              tone="rip"
                              dense
                            >
                              <RunGraves graves={run.graves} />
                            </Frame>
                          ) : null}

                          {run.status === "CLOSED" &&
                          run.earnedBadgeKeys.length > 0 ? (
                            <Frame title="Badges at close" dense>
                              <BadgeCase
                                badges={badges}
                                earnedKeys={run.earnedBadgeKeys}
                                layout="column"
                                dense
                              />
                            </Frame>
                          ) : null}

                          {run.snapshots.length === 0 ? (
                            <p className="text-xs text-muted">
                              No board snapshots for this run.
                            </p>
                          ) : (
                            <ul className="divide-y divide-frame/25 border border-frame/35">
                              {run.snapshots.map((snap) => {
                                const active =
                                  selectedId === snap.id && pending;
                                return (
                                  <li key={snap.id}>
                                    <button
                                      type="button"
                                      disabled={pending || clearing}
                                      className="pressable flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-2/70 disabled:opacity-60"
                                      onClick={() =>
                                        openSnapshot(snap.id, run.runNumber)
                                      }
                                    >
                                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="text-sm font-semibold text-ink">
                                          {snap.label ??
                                            snapshotTriggerLabel(snap.trigger)}
                                        </span>
                                        <span className="text-xs text-muted">
                                          {formatWhen(snap.createdAt)}
                                        </span>
                                      </span>
                                      <span className="text-xs text-muted">
                                        {snapshotTriggerLabel(snap.trigger)} ·{" "}
                                        {snap.summary}
                                        {active ? " · Opening…" : null}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        )}
      </Modal>

      {detailsPokemon ? (
        <PokemonDetailsModal
          open
          slug={challengeSlug}
          pokemon={detailsPokemon}
          showCompetitiveDetails={showCompetitiveDetails}
          trainer={{
            id: trainerId,
            handle: trainerHandle,
            avatarSpriteKey: trainerAvatarSpriteKey,
            avatarBackgroundKey: trainerAvatarBackgroundKey,
          }}
          onClose={() => setDetailsPokemon(null)}
        />
      ) : null}

      {detail && exportOpen ? (
        <TeamExportModal
          open
          onClose={() => setExportOpen(false)}
          challengeSlug={challengeSlug}
          challengeName={challengeName}
          challengeGame={challengeGame}
          trainer={{
            id: trainerId,
            handle: trainerHandle,
            runNumber: detail.runNumber,
            wipeCount: detail.payload.wipeCount,
            earnedBadgeKeys: detail.payload.earnedBadgeKeys,
            pokemon: detail.payload.pokemon,
          }}
          badges={badges}
          showCompetitiveDetails={showCompetitiveDetails}
          snapshot={{
            label: detail.label ?? detail.triggerLabel,
            capturedAt: formatWhen(detail.createdAt),
          }}
        />
      ) : null}

      {confirmDialog}
    </>
  );
}

/** @deprecated Prefer TrainerHistoryModal — kept as alias for existing imports. */
export function BoardHistoryModal(props: TrainerHistoryModalProps) {
  return <TrainerHistoryModal {...props} />;
}

export function TrainerHistoryModal({
  open,
  onClose,
  trainerId,
  trainerHandle,
  trainerAvatarSpriteKey,
  trainerAvatarBackgroundKey,
  challengeSlug,
  challengeName,
  challengeGame,
  badges,
  showCompetitiveDetails = true,
  canClearSnapshots = false,
  canRestoreMemorial = false,
  onMemorialRestored,
}: TrainerHistoryModalProps) {
  if (!open) return null;

  return (
    <TrainerHistoryBody
      key={trainerId}
      onClose={onClose}
      trainerId={trainerId}
      trainerHandle={trainerHandle}
      trainerAvatarSpriteKey={trainerAvatarSpriteKey}
      trainerAvatarBackgroundKey={trainerAvatarBackgroundKey}
      challengeSlug={challengeSlug}
      challengeName={challengeName}
      challengeGame={challengeGame}
      badges={badges}
      showCompetitiveDetails={showCompetitiveDetails}
      canClearSnapshots={canClearSnapshots}
      canRestoreMemorial={canRestoreMemorial}
      onMemorialRestored={onMemorialRestored}
    />
  );
}
