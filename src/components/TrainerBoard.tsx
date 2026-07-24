"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deletePokemonAction,
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
import { TrainerStatsSummary } from "@/components/TrainerStatsSummary";
import type {
  BadgeDefinition,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { displayName, pokemonInSlot } from "@/lib/challenges";
import { avatarImageUrl } from "@/lib/sprites";

type BoardMode = "view" | "edit";

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

export function TrainerBoard({
  joinHref,
  myBoardHref = null,
  trainer,
  badges,
  canEdit,
  isGm,
  isDemo,
}: TrainerBoardProps) {
  const [mode, setMode] = useState<BoardMode>(
    canEdit && trainer.pokemon.length === 0 ? "edit" : "view",
  );
  const editing = canEdit && mode === "edit";

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [handle, setHandle] = useState(trainer.handle);
  const [statusText, setStatusText] = useState(trainer.statusText ?? "");
  const [realName, setRealName] = useState(trainer.realName ?? "");
  const [avatarSpriteKey, setAvatarSpriteKey] = useState(
    trainer.avatarSpriteKey,
  );

  const [pokemonOpen, setPokemonOpen] = useState(false);
  const [pokemonForm, setPokemonForm] =
    useState<PokemonFormState>(EMPTY_POKEMON_FORM);

  const main = pokemonInSlot(trainer, "MAIN");
  const reserves = pokemonInSlot(trainer, "RESERVE");
  const graveyard = pokemonInSlot(trainer, "GRAVEYARD");

  function flash(
    result: { ok: true; message?: string } | { ok: false; error: string },
  ) {
    if (result.ok) {
      setError(null);
      setMessage(result.message ?? "Saved");
    } else {
      setMessage(null);
      setError(result.error);
    }
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
          {editing
            ? "Editing your board — changes save per section."
            : "Trainer board"}
        </p>
        {canEdit ? (
          <div
            className="inline-flex rounded-sm border-2 border-frame bg-surface-2 p-0.5"
            role="group"
            aria-label="Board mode"
          >
            <button
              type="button"
              className={`pressable rounded-sm px-3 py-1.5 font-display text-xs font-bold tracking-wide uppercase ${
                mode === "view"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-ink"
              }`}
              aria-pressed={mode === "view"}
              onClick={() => setMode("view")}
            >
              View
            </button>
            <button
              type="button"
              className={`pressable rounded-sm px-3 py-1.5 font-display text-xs font-bold tracking-wide uppercase ${
                mode === "edit"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-ink"
              }`}
              aria-pressed={mode === "edit"}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="text-sm font-semibold text-accent-deep" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <div className="space-y-6">
          <Frame title="Player">
            {editing ? (
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
                  <ReviveToken used={trainer.reviveUsed} size="sm" />
                  {!trainer.reviveUsed ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="pressable rounded-sm bg-danger px-3 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
                      onClick={() => {
                        if (
                          !confirm(
                            "Spend your Revive Token? This cannot be undone.",
                          )
                        ) {
                          return;
                        }
                        startTransition(async () => {
                          flash(
                            await updateTrainerBoardAction({
                              trainerId: trainer.id,
                              reviveUsed: true,
                            }),
                          );
                        });
                      }}
                    >
                      Use revive
                    </button>
                  ) : isGm ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="pressable rounded-sm bg-surface px-3 py-2 font-display text-xs font-bold tracking-wide uppercase disabled:opacity-60"
                      onClick={() => {
                        startTransition(async () => {
                          flash(
                            await updateTrainerBoardAction({
                              trainerId: trainer.id,
                              reviveUsed: false,
                            }),
                          );
                        });
                      }}
                    >
                      GM: reset revive
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending || !handle.trim()}
                  className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
                  onClick={() => {
                    startTransition(async () => {
                      flash(
                        await updateTrainerBoardAction({
                          trainerId: trainer.id,
                          handle: handle.trim(),
                          statusText,
                          realName: realName || null,
                          avatarSpriteKey,
                        }),
                      );
                    });
                  }}
                >
                  Save profile
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <Image
                  src={avatarImageUrl(trainer.avatarSpriteKey)}
                  alt=""
                  width={96}
                  height={96}
                  className="pixelated h-24 w-24 object-contain"
                  unoptimized
                />
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-3xl font-extrabold tracking-tight">
                    {displayName(trainer)}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ReviveToken used={trainer.reviveUsed} size="sm" />
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
                    {trainer.statusText ?? "No status update yet."}
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
                      Your board is ready — switch to Edit to set a nickname,
                      avatar, badges, and party.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </Frame>

          <Frame title="Main Squad">
            {editing ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Tap a slot to add or edit.
                  </p>
                  <button
                    type="button"
                    className="pressable rounded-sm bg-accent px-3 py-1.5 text-xs font-bold text-white uppercase"
                    onClick={() => openAddPokemon("MAIN")}
                  >
                    + Add
                  </button>
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
            {editing ? (
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
            {editing ? (
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
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4">
          <Frame title="Stats">
            <TrainerStatsSummary
              caught={trainer.pokemon.length}
              fallen={graveyard.length}
              badgesEarned={trainer.earnedBadgeKeys.length}
              badgesTotal={badges.length}
              updatedAt={trainer.updatedAt}
            />
          </Frame>

          <Frame title="Badge case">
            {editing ? (
              <BadgeCaseEditor
                trainerId={trainer.id}
                badges={badges}
                earnedKeys={trainer.earnedBadgeKeys}
                layout="column"
              />
            ) : (
              <BadgeCase
                badges={badges}
                earnedKeys={trainer.earnedBadgeKeys}
                layout="column"
              />
            )}
          </Frame>
        </aside>
      </div>

      {editing ? (
        <PokemonFormModal
          open={pokemonOpen}
          initial={pokemonForm}
          pending={pending}
          onClose={() => setPokemonOpen(false)}
          onSave={(form) => {
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
                causeOfDeath: form.causeOfDeath || null,
              });
              flash(result);
              if (result.ok) setPokemonOpen(false);
            });
          }}
          onDelete={(pokemonId) => {
            startTransition(async () => {
              const result = await deletePokemonAction({
                trainerId: trainer.id,
                pokemonId,
              });
              flash(result);
              if (result.ok) setPokemonOpen(false);
            });
          }}
        />
      ) : null}
    </div>
  );
}
