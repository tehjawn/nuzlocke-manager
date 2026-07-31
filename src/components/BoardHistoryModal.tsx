"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getTrainerBoardSnapshotAction,
  listTrainerBoardSnapshotsAction,
} from "@/app/actions/challenge";
import { BadgeCase } from "@/components/BadgeCase";
import { Frame } from "@/components/Frame";
import { Modal } from "@/components/Modal";
import { PartyStrip } from "@/components/PartyStrip";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import type {
  BadgeDefinition,
  PokemonEntry,
} from "@/lib/challenge-types";
import type {
  TrainerBoardSnapshotPayload,
  TrainerBoardSnapshotSummary,
} from "@/lib/board-snapshot";
import { snapshotTriggerLabel } from "@/lib/board-snapshot";

type BoardHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  trainerId: string;
  trainerHandle: string;
  badges: BadgeDefinition[];
  showCompetitiveDetails?: boolean;
};

function slotPokemon(
  pokemon: PokemonEntry[],
  slot: PokemonEntry["slot"],
): PokemonEntry[] {
  return pokemon
    .filter((p) => p.slot === slot)
    .sort((a, b) => a.partyIndex - b.partyIndex);
}

function formatSnapshotWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function BoardHistoryModal({
  open,
  onClose,
  trainerId,
  trainerHandle,
  badges,
  showCompetitiveDetails = true,
}: BoardHistoryModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<
    TrainerBoardSnapshotSummary[] | null
  >(null);
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await listTrainerBoardSnapshotsAction({ trainerId });
      if (cancelled) return;
      if (!result.ok) {
        setSnapshots([]);
        setError(result.error);
        return;
      }
      setSnapshots(result.snapshots);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, trainerId]);

  if (!open) return null;

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

  return (
    <>
      <Modal
        open={open}
        title={viewingDetail ? "Past board" : "Board history"}
        subtitle={
          viewingDetail
            ? `${trainerHandle} · ${detail.label ?? detail.triggerLabel} · ${formatSnapshotWhen(detail.createdAt)}`
            : `${trainerHandle} · GM-only run archive`
        }
        size="wide"
        onClose={onClose}
        headerActions={
          viewingDetail ? (
            <button
              type="button"
              className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
              onClick={backToList}
            >
              ← All snapshots
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
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
                  />
                </Frame>
              </aside>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Snapshots are taken before imports, wipes, and GM resets. Players
              do not see this list.
            </p>
            {snapshots == null ? (
              <p className="text-sm text-muted">Loading history…</p>
            ) : null}
            {snapshots != null && snapshots.length === 0 && !error ? (
              <p className="text-sm text-muted">
                No snapshots yet for this trainer.
              </p>
            ) : null}
            {snapshots != null && snapshots.length > 0 ? (
              <ul className="divide-y divide-frame/25 border border-frame/40">
                {snapshots.map((snap) => {
                  const active = selectedId === snap.id && pending;
                  return (
                    <li key={snap.id}>
                      <button
                        type="button"
                        disabled={pending}
                        className="pressable flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-surface-2/70 disabled:opacity-60"
                        onClick={() => openSnapshot(snap.id)}
                      >
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-ink">
                            {snap.label ?? snapshotTriggerLabel(snap.trigger)}
                          </span>
                          <span className="text-xs text-muted">
                            {formatSnapshotWhen(snap.createdAt)}
                          </span>
                        </span>
                        <span className="text-xs text-muted">
                          {snapshotTriggerLabel(snap.trigger)} · {snap.summary}
                          {active ? " · Opening…" : null}
                        </span>
                      </button>
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
    </>
  );
}
