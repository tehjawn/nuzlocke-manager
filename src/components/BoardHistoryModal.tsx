"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getTrainerBoardSnapshotAction,
  gmClearTrainerBoardHistoryAction,
  listTrainerHistoryAction,
  type TrainerHistoryRunSummary,
} from "@/app/actions/challenge";
import { BadgeCase } from "@/components/BadgeCase";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Frame } from "@/components/Frame";
import { Modal } from "@/components/Modal";
import { PartyStrip } from "@/components/PartyStrip";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
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
  badges: BadgeDefinition[];
  showCompetitiveDetails?: boolean;
  /** GM-only clear control; owners can still browse. */
  canClearSnapshots?: boolean;
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

function runHeadline(run: TrainerHistoryRunSummary): string {
  if (run.status === "ACTIVE") return `Run ${run.runNumber} · Active`;
  const reason =
    run.endReason === "GM_RESET"
      ? "GM reset"
      : run.endReason === "WIPE"
        ? "Wiped"
        : "Closed";
  return `Run ${run.runNumber} · ${reason}`;
}

function TrainerHistoryBody({
  onClose,
  trainerId,
  trainerHandle,
  badges,
  showCompetitiveDetails = true,
  canClearSnapshots = false,
}: Omit<TrainerHistoryModalProps, "open">) {
  const [pending, startTransition] = useTransition();
  const [clearing, setClearing] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    payload: TrainerBoardSnapshotPayload;
  } | null>(null);
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );
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

  function openSnapshot(id: string) {
    setSelectedId(id);
    setError(null);
    setDetailsPokemon(null);
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
        payload: result.snapshot.payload,
      });
    });
  }

  function backToList() {
    setDetail(null);
    setSelectedId(null);
    setDetailsPokemon(null);
  }

  async function clearHistory() {
    const count = runs.reduce((sum, run) => sum + run.snapshots.length, 0);
    const ok = await confirm({
      title: "Clear board snapshots?",
      description: (
        <>
          Permanently deletes all {count} board snapshot
          {count === 1 ? "" : "s"} for {trainerHandle}. Run ledger (revive /
          badge archives) stays. This cannot be undone.
        </>
      ),
      confirmLabel: "Clear snapshots",
      tone: "danger",
    });
    if (!ok) return;

    setError(null);
    setClearing(true);
    startTransition(async () => {
      try {
        const result = await gmClearTrainerBoardHistoryAction({ trainerId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setRuns((prev) =>
          prev.map((run) => ({ ...run, snapshots: [] })),
        );
        setDetail(null);
        setSelectedId(null);
        setDetailsPokemon(null);
      } finally {
        setClearing(false);
      }
    });
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
  const canClearHistory =
    allowClear &&
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
            <button
              type="button"
              className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
              onClick={backToList}
            >
              ← All runs
            </button>
          ) : canClearHistory ? (
            <button
              type="button"
              disabled={clearing || pending}
              className="pressable border-danger/35 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger disabled:opacity-60"
              onClick={() => {
                void clearHistory();
              }}
            >
              {clearing ? "Clearing…" : "Clear snapshots"}
            </button>
          ) : null
        }
      >
        {error ? (
          <p className="mb-3 text-sm text-danger" role="alert">
            {error}
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
                      size="sm"
                      selectHint="Details"
                      showCompetitiveDetails={showCompetitiveDetails}
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
              reset).
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
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-bold text-muted">
                          {expanded ? "▾" : "▸"}
                        </span>
                      </button>

                      {expanded ? (
                        <div className="space-y-3 border-t border-frame/30 px-3 py-3">
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
                                      onClick={() => openSnapshot(snap.id)}
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
          pokemon={detailsPokemon}
          showCompetitiveDetails={showCompetitiveDetails}
          onClose={() => setDetailsPokemon(null)}
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
  badges,
  showCompetitiveDetails = true,
  canClearSnapshots = false,
}: TrainerHistoryModalProps) {
  if (!open) return null;

  return (
    <TrainerHistoryBody
      key={trainerId}
      onClose={onClose}
      trainerId={trainerId}
      trainerHandle={trainerHandle}
      badges={badges}
      showCompetitiveDetails={showCompetitiveDetails}
      canClearSnapshots={canClearSnapshots}
    />
  );
}
