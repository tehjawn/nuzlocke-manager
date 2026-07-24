"use client";

import Image from "next/image";
import Link from "next/link";
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
  type PokemonFormState,
} from "@/components/PokemonFormModal";
import { PartyStrip } from "@/components/PartyStrip";
import { ReviveToken } from "@/components/ReviveToken";
import { SaveImportModal } from "@/components/SaveImportModal";
import { SaveStatus, useSaveStatus } from "@/components/SaveStatus";
import { TrainerStatsSummary } from "@/components/TrainerStatsSummary";
import type {
  BadgeDefinition,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { pokemonInSlot } from "@/lib/trainer-display";
import { avatarImageUrl } from "@/lib/sprites";
import { isEmptySpread } from "@/lib/stats";

type TrainerBoardProps = {
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
  tone?: "ghost" | "solid";
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`pressable inline-flex items-center gap-1 rounded-sm px-2 py-1 font-display text-[10px] font-bold tracking-wide uppercase disabled:opacity-60 ${
        tone === "solid"
          ? "bg-[var(--on-accent)] text-[var(--accent-ink)]"
          : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
    </button>
  );
}

export function TrainerBoard({
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

  const serverStamp = `${trainer.updatedAt ?? ""}|${trainer.handle}|${trainer.statusText ?? ""}|${trainer.realName ?? ""}|${trainer.avatarSpriteKey}|${trainer.reviveUsed}|${trainer.earnedBadgeKeys.join("|")}`;
  const [seenStamp, setSeenStamp] = useState(serverStamp);

  const [committed, setCommitted] = useState({
    handle: trainer.handle,
    statusText: trainer.statusText ?? "",
    realName: trainer.realName ?? "",
    avatarSpriteKey: trainer.avatarSpriteKey,
    reviveUsed: trainer.reviveUsed,
  });

  const [handle, setHandle] = useState(trainer.handle);
  const [statusText, setStatusText] = useState(trainer.statusText ?? "");
  const [realName, setRealName] = useState(trainer.realName ?? "");
  const [avatarSpriteKey, setAvatarSpriteKey] = useState(
    trainer.avatarSpriteKey,
  );
  const [reviveUsed, setReviveUsed] = useState(trainer.reviveUsed);
  const [earnedBadgeKeys, setEarnedBadgeKeys] = useState(
    trainer.earnedBadgeKeys,
  );

  const [pokemonOpen, setPokemonOpen] = useState(false);
  const [pokemonForm, setPokemonForm] =
    useState<PokemonFormState>(EMPTY_POKEMON_FORM);
  const [saveImportOpen, setSaveImportOpen] = useState(false);

  if (serverStamp !== seenStamp) {
    setSeenStamp(serverStamp);
    setCommitted({
      handle: trainer.handle,
      statusText: trainer.statusText ?? "",
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
        realName: next.realName || null,
        avatarSpriteKey: next.avatarSpriteKey,
      });
      if (result.ok) {
        playerSave.markSaved(result.message ?? "Profile saved");
      } else {
        const rollback = {
          handle: trainer.handle,
          statusText: trainer.statusText ?? "",
          realName: trainer.realName ?? "",
          avatarSpriteKey: trainer.avatarSpriteKey,
          reviveUsed: trainer.reviveUsed,
        };
        setCommitted(rollback);
        setHandle(rollback.handle);
        setStatusText(rollback.statusText);
        setRealName(rollback.realName);
        setAvatarSpriteKey(rollback.avatarSpriteKey);
        setEditingPlayer(true);
        playerSave.markError(result.error);
      }
    });
  }

  function useReviveToken() {
    if (
      !confirm("Spend your Revive Token? This cannot be undone.")
    ) {
      return;
    }
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

  function resetReviveToken() {
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
    setPokemonForm({ ...EMPTY_POKEMON_FORM, slot, partyIndex });
    setPokemonOpen(true);
  }

  function openEditPokemon(mon: PokemonEntry) {
    setPokemonForm(pokemonEntryToForm(mon));
    setPokemonOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {canEdit
            ? "Your board — profile saves explicitly; party and badges save as you go."
            : "Trainer board"}
        </p>
        {canEdit ? <SaveStatus status={partySave.status} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="space-y-6">
          <Frame
            title="Player"
            actions={
              canEdit ? (
                editingPlayer ? (
                  <>
                    <SaveStatus status={playerSave.status} onAccent />
                    <HeaderButton
                      tone="solid"
                      disabled={pending || !handle.trim()}
                      onClick={savePlayerProfile}
                    >
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
                    className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2 text-sm"
                    value={handle}
                    maxLength={24}
                    placeholder="Your league nickname"
                    onChange={(e) => setHandle(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-muted">
                    Real name
                  </span>
                  <input
                    className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2 text-sm"
                    value={realName}
                    placeholder="Optional — e.g. John"
                    onChange={(e) => setRealName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-bold text-muted">Status</span>
                  <textarea
                    className="min-h-20 w-full rounded-sm border-2 border-frame bg-surface px-3 py-2 text-sm"
                    value={statusText}
                    placeholder="Where you are in the run…"
                    onChange={(e) => setStatusText(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <ReviveToken used={reviveUsed} size="sm" />
                  {!reviveUsed ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="inline-flex items-center rounded-sm border-2 border-frame bg-danger px-2 py-1 font-display text-[10px] font-bold tracking-wide text-white uppercase disabled:opacity-60"
                      onClick={useReviveToken}
                    >
                      Use revive
                    </button>
                  ) : isGm ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="inline-flex items-center rounded-sm border-2 border-frame bg-surface px-2 py-1 font-display text-[10px] font-bold tracking-wide uppercase disabled:opacity-60"
                      onClick={resetReviveToken}
                    >
                      GM: reset revive
                    </button>
                  ) : null}
                  <SaveStatus status={reviveSave.status} />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <Image
                  src={avatarImageUrl(committed.avatarSpriteKey)}
                  alt=""
                  width={96}
                  height={96}
                  className="pixelated h-24 w-24 object-contain"
                  unoptimized
                />
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-3xl font-extrabold tracking-tight">
                    {committed.realName
                      ? `${committed.handle} (${committed.realName})`
                      : committed.handle}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ReviveToken used={reviveUsed} size="sm" />
                    {canEdit ? (
                      <>
                        {!reviveUsed ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="inline-flex items-center rounded-sm border-2 border-frame bg-danger px-2 py-1 font-display text-[10px] font-bold tracking-wide text-white uppercase disabled:opacity-60"
                            onClick={useReviveToken}
                          >
                            Use revive
                          </button>
                        ) : isGm ? (
                          <button
                            type="button"
                            disabled={pending}
                            className="inline-flex items-center rounded-sm border-2 border-frame bg-surface px-2 py-1 font-display text-[10px] font-bold tracking-wide uppercase disabled:opacity-60"
                            onClick={resetReviveToken}
                          >
                            GM: reset
                          </button>
                        ) : null}
                        <SaveStatus status={reviveSave.status} />
                      </>
                    ) : null}
                    {trainer.mainSquadLocked ? (
                      <span className="rounded-sm border-2 border-frame bg-accent-2/25 px-2 py-1 font-display text-[10px] font-bold tracking-wide uppercase">
                        Main Squad locked
                      </span>
                    ) : null}
                    {isDemo ? (
                      <span className="rounded-sm border-2 border-frame bg-surface-2 px-2 py-1 font-display text-[10px] font-bold tracking-wide uppercase">
                        Demo example
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                    {committed.statusText || "No status update yet."}
                  </p>
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
                      Your board is ready — edit your profile, tap party slots
                      to add Pokémon, and toggle badges as you earn them.
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
                    Tap a slot to add or edit.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-1.5 text-xs font-bold uppercase"
                      onClick={() => setSaveImportOpen(true)}
                    >
                      Import save
                    </button>
                    <button
                      type="button"
                      className="pressable rounded-sm bg-accent px-3 py-1.5 text-xs font-bold text-white uppercase"
                      onClick={() => openAddPokemon("MAIN")}
                    >
                      + Add
                    </button>
                  </div>
                </div>
                <PartyStrip
                  pokemon={main}
                  slots={6}
                  onSelect={openEditPokemon}
                  onSelectEmpty={(partyIndex) =>
                    openAddPokemon("MAIN", partyIndex)
                  }
                />
              </div>
            ) : (
              <PartyStrip pokemon={main} slots={6} />
            )}
          </Frame>

          <Frame title="The Reserves">
            {canEdit ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    {reserves.length === 0
                      ? "No reserves yet."
                      : "Tap a Pokémon to edit."}
                  </p>
                  <button
                    type="button"
                    className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-1.5 text-xs font-bold uppercase"
                    onClick={() => openAddPokemon("RESERVE")}
                  >
                    + Add
                  </button>
                </div>
                {reserves.length > 0 ? (
                  <PartyStrip pokemon={reserves} onSelect={openEditPokemon} />
                ) : null}
              </div>
            ) : reserves.length > 0 ? (
              <PartyStrip pokemon={reserves} />
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
                      : "Tap a Pokémon to edit."}
                  </p>
                  <button
                    type="button"
                    className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-1.5 text-xs font-bold uppercase"
                    onClick={() => openAddPokemon("GRAVEYARD")}
                  >
                    + Add
                  </button>
                </div>
                {graveyard.length > 0 ? (
                  <PartyStrip
                    pokemon={graveyard}
                    memorial
                    onSelect={openEditPokemon}
                  />
                ) : null}
              </div>
            ) : graveyard.length > 0 ? (
              <PartyStrip pokemon={graveyard} memorial />
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
                    className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-1.5 text-xs font-bold uppercase"
                    onClick={() => openAddPokemon("ENCOUNTERED")}
                  >
                    + Add
                  </button>
                </div>
                {encountered.length > 0 ? (
                  <PartyStrip
                    pokemon={encountered}
                    onSelect={openEditPokemon}
                  />
                ) : null}
              </div>
            ) : encountered.length > 0 ? (
              <PartyStrip pokemon={encountered} />
            ) : (
              <p className="text-sm text-muted">No encounters logged yet.</p>
            )}
          </Frame>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">
          <Frame title="Stats">
            <TrainerStatsSummary
              caught={trainer.pokemon.length}
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

      {canEdit ? (
        <>
          <PokemonFormModal
            open={pokemonOpen}
            initial={pokemonForm}
            pending={pending}
            onClose={() => setPokemonOpen(false)}
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
                  setPokemonOpen(false);
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
                  setPokemonOpen(false);
                } else {
                  partySave.markError(result.error);
                }
              });
            }}
          />
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
        </>
      ) : null}
    </div>
  );
}
