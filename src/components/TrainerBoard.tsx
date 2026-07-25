"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  deletePokemonAction,
  importFromSaveAction,
  updateTrainerBoardAction,
  upsertPokemonAction,
} from "@/app/actions/challenge";
import { AvatarPicker } from "@/components/AvatarPicker";
import { BadgeCase } from "@/components/BadgeCase";
import { BadgeCaseEditor } from "@/components/BadgeCaseEditor";
import { Frame } from "@/components/Frame";
import {
  EMPTY_POKEMON_FORM,
  PokemonFormModal,
  pokemonEntryToForm,
  pokemonFormToEntry,
  type PokemonFormState,
} from "@/components/PokemonFormModal";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PartyStrip } from "@/components/PartyStrip";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { ReviveControl } from "@/components/ReviveControl";
import { SaveImportModal } from "@/components/SaveImportModal";
import { SaveStatus, useSaveStatus } from "@/components/SaveStatus";
import { StatusEmojiPicker } from "@/components/StatusEmojiPicker";
import { StatusLine } from "@/components/StatusLine";
import { TrainerStatsSummary } from "@/components/TrainerStatsSummary";
import type {
  BadgeDefinition,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { pokemonInSlot } from "@/lib/trainer-display";
import { avatarImageClassName, avatarImageUrl } from "@/lib/sprites";
import { CTA_PRIMARY, CTA_PRIMARY_SM, CTA_SECONDARY } from "@/lib/cta";
import { isEmptySpread } from "@/lib/stats";

type TrainerBoardProps = {
  leagueBoardHref: string;
  leagueBoardLabel: string;
  joinHref: string;
  /** When set, demo boards point signed-in players at their own board instead of login. */
  myBoardHref?: string | null;
  trainer: TrainerProfile;
  badges: BadgeDefinition[];
  canEdit: boolean;
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

function ImportSaveIcon({ className = "h-4 w-4" }: { className?: string }) {
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
  trainer,
  badges,
  canEdit,
  isGm,
  isDemo,
}: TrainerBoardProps) {
  const [editingPlayer, setEditingPlayer] = useState(
    canEdit && trainer.pokemon.length === 0,
  );

  const [pending, startTransition] = useTransition();
  const playerSave = useSaveStatus();
  const partySave = useSaveStatus();
  const reviveSave = useSaveStatus();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const serverStamp = `${trainer.updatedAt ?? ""}|${trainer.handle}|${trainer.statusText ?? ""}|${trainer.statusEmoji ?? ""}|${trainer.realName ?? ""}|${trainer.avatarSpriteKey}|${trainer.reviveUsed}|${trainer.earnedBadgeKeys.join("|")}`;
  const [seenStamp, setSeenStamp] = useState(serverStamp);

  const [committed, setCommitted] = useState({
    handle: trainer.handle,
    statusText: trainer.statusText ?? "",
    statusEmoji: trainer.statusEmoji ?? null,
    realName: trainer.realName ?? "",
    avatarSpriteKey: trainer.avatarSpriteKey,
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
      reviveUsed: trainer.reviveUsed,
    });
    setReviveUsed(trainer.reviveUsed);
    setEarnedBadgeKeys(trainer.earnedBadgeKeys);
  }

  const main = pokemonInSlot(trainer, "MAIN");
  const reserves = pokemonInSlot(trainer, "RESERVE");
  const graveyard = pokemonInSlot(trainer, "GRAVEYARD");
  const encountered = pokemonInSlot(trainer, "ENCOUNTERED");

  function syncPlayerDraftFromCommitted() {
    setHandle(committed.handle);
    setStatusText(committed.statusText);
    setStatusEmoji(committed.statusEmoji);
    setRealName(committed.realName);
    setAvatarSpriteKey(committed.avatarSpriteKey);
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
          reviveUsed: trainer.reviveUsed,
        };
        setCommitted(rollback);
        setHandle(rollback.handle);
        setStatusText(rollback.statusText);
        setStatusEmoji(rollback.statusEmoji);
        setRealName(rollback.realName);
        setAvatarSpriteKey(rollback.avatarSpriteKey);
        setEditingPlayer(true);
        playerSave.markError(result.error);
      }
    });
  }

  async function useReviveToken() {
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

  function openAddPokemon(
    slot: PokemonEntry["slot"] = "MAIN",
    partyIndex?: number,
  ) {
    if (partyIndex == null) {
      const used = new Set(
        trainer.pokemon.filter((p) => p.slot === slot).map((p) => p.partyIndex),
      );
      partyIndex = 0;
      while (used.has(partyIndex) && partyIndex < 12) partyIndex += 1;
    }
    setPokemonInspect({
      mode: "edit",
      form: { ...EMPTY_POKEMON_FORM, slot, partyIndex },
    });
  }

  function openPokemon(mon: PokemonEntry) {
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
    const mon = trainer.pokemon.find((p) => p.id === jumpPokemonId) ?? null;
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
        : reviveSave.status;

  return (
    <div className={`space-y-4 ${canEdit ? "pb-20 sm:pb-0" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={leagueBoardHref} className={CTA_PRIMARY}>
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
              onUse={useReviveToken}
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
              className={`${CTA_SECONDARY} cta-import-save`}
              onClick={() => setSaveImportOpen(true)}
            >
              <ImportSaveIcon />
              <span>Import save</span>
            </button>
          ) : null}
        </div>
      </div>

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
                      aria-label="Edit player profile"
                      onClick={startEditingPlayer}
                    >
                      <PencilIcon />
                      Edit
                    </HeaderButton>
                  </>
                )
              ) : null
            }
          >
            {editingPlayer ? (
              <div className="space-y-4">
                <div>
                  <span className="mb-2 block text-sm font-bold text-muted">
                    Avatar
                  </span>
                  <AvatarPicker
                    value={avatarSpriteKey}
                    onChange={setAvatarSpriteKey}
                  />
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-muted">
                    Nickname
                  </span>
                  <input
                    className="w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                    value={handle}
                    maxLength={24}
                    placeholder="Your league nickname"
                    onChange={(e) => setHandle(e.target.value)}
                  />
                </label>
                {trainer.discordUsername || trainer.discordDisplayName ? (
                  <p className="text-sm text-muted">
                    Discord{" "}
                    <span className="font-semibold text-ink">
                      {trainer.discordUsername
                        ? `@${trainer.discordUsername}`
                        : trainer.discordDisplayName}
                    </span>
                  </p>
                ) : null}
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-muted">
                    Real name
                  </span>
                  <input
                    className="w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                    value={realName}
                    placeholder="Optional — e.g. John"
                    onChange={(e) => setRealName(e.target.value)}
                  />
                </label>
                <StatusEmojiPicker
                  value={statusEmoji}
                  onChange={setStatusEmoji}
                  disabled={pending}
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-muted">Status</span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                    value={statusText}
                    placeholder="Where you are in the run…"
                    onChange={(e) => setStatusText(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <Image
                  src={avatarImageUrl(committed.avatarSpriteKey)}
                  alt=""
                  width={96}
                  height={96}
                  className={avatarImageClassName(
                    committed.avatarSpriteKey,
                    "h-24 w-24",
                  )}
                  unoptimized
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
                  {(trainer.mainSquadLocked || isDemo) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {trainer.mainSquadLocked ? (
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
                  {canEdit && trainer.pokemon.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">
                      Your board is ready — edit your profile, then use{" "}
                      <span className="font-semibold text-ink">Import save</span>{" "}
                      at the top once you have a file from Afterplay. You can
                      also tap party slots and badges by hand.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </Frame>

          <Frame title="Main Squad">
            {canEdit ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Tap a Pokémon to view or edit; empty slots to add.
                  </p>
                  <button
                    type="button"
                    className="pressable rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold tracking-tight text-[var(--on-accent)]"
                    onClick={() => openAddPokemon("MAIN")}
                  >
                    + Add
                  </button>
                </div>
                {/*
                  Tour spotlight targets the slot grid (not the whole Frame) so
                  mobile coachmarks can keep empty "Tap to add" cards visible.
                */}
                <div data-tour="pokemon">
                  <PartyStrip
                    pokemon={main}
                    slots={6}
                    selectHint="View"
                    onSelect={openPokemon}
                    onSelectEmpty={(partyIndex) =>
                      openAddPokemon("MAIN", partyIndex)
                    }
                  />
                </div>
              </div>
            ) : (
              <div data-tour="pokemon">
                <PartyStrip
                  pokemon={main}
                  slots={6}
                  selectHint="Details"
                  onSelect={openPokemon}
                />
              </div>
            )}
          </Frame>

          <Frame title="The Reserves">
            {canEdit ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    {reserves.length === 0
                      ? "No reserves yet."
                      : "Tap a Pokémon to view or edit."}
                  </p>
                  <button
                    type="button"
                    className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight"
                    onClick={() => openAddPokemon("RESERVE")}
                  >
                    + Add
                  </button>
                </div>
                {reserves.length > 0 ? (
                  <PartyStrip
                    pokemon={reserves}
                    selectHint="View"
                    onSelect={openPokemon}
                  />
                ) : null}
              </div>
            ) : reserves.length > 0 ? (
              <PartyStrip
                pokemon={reserves}
                selectHint="Details"
                onSelect={openPokemon}
              />
            ) : (
              <p className="text-sm text-muted">No reserves logged yet.</p>
            )}
          </Frame>

          <Frame title="R.I.P." tone="rip">
            {canEdit ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    {graveyard.length === 0
                      ? "Memorial is empty."
                      : "Tap a Pokémon to view or edit."}
                  </p>
                  <button
                    type="button"
                    className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight"
                    onClick={() => openAddPokemon("GRAVEYARD")}
                  >
                    + Add
                  </button>
                </div>
                {graveyard.length > 0 ? (
                  <PartyStrip
                    pokemon={graveyard}
                    memorial
                    selectHint="View"
                    onSelect={openPokemon}
                  />
                ) : null}
              </div>
            ) : graveyard.length > 0 ? (
              <PartyStrip
                pokemon={graveyard}
                memorial
                selectHint="Details"
                onSelect={openPokemon}
              />
            ) : (
              <p className="mt-0 text-sm text-muted">
                Memorial is empty. May it stay that way.
              </p>
            )}
          </Frame>

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
                    className="pressable rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs font-semibold tracking-tight"
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
              updatedAt={trainer.updatedAt}
            />
          </Frame>

          <Frame title="Badge case">
            {canEdit ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">Tap a badge to toggle it.</p>
                <BadgeCaseEditor
                  trainerId={trainer.id}
                  badges={badges}
                  earnedKeys={earnedBadgeKeys}
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
          teamPokemon={trainer.pokemon}
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
                // Full category sync: unchecked mons clear that slot group.
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
              } else {
                partySave.markError(result.error);
              }
            });
          }}
        />
      ) : null}

      {!canEdit ? (
        <PokemonDetailsModal
          open={detailsPokemon != null}
          pokemon={detailsPokemon}
          onClose={() => setDetailsPokemon(null)}
        />
      ) : null}

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-frame bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_var(--shadow)] backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              {mobileSaveStatus.kind === "idle" ? (
                <p className="text-xs text-muted">
                  Party & badges save as you go
                </p>
              ) : (
                <SaveStatus status={mobileSaveStatus} />
              )}
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
