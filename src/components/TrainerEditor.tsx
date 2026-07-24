"use client";

import { useState, useTransition } from "react";
import {
  deletePokemonAction,
  setBadgeProgressAction,
  updateTrainerBoardAction,
  upsertPokemonAction,
} from "@/app/actions/challenge";
import { AvatarPicker } from "@/components/AvatarPicker";
import { SpeciesCombobox } from "@/components/SpeciesCombobox";
import type {
  BadgeDefinition,
  PokemonEntry,
  PokemonSlot,
  TrainerProfile,
} from "@/lib/challenge-types";

type TrainerEditorProps = {
  trainer: TrainerProfile;
  badges: BadgeDefinition[];
  canEdit: boolean;
  isGm: boolean;
};

const EMPTY_FORM = {
  id: undefined as string | undefined,
  slot: "MAIN" as PokemonSlot,
  partyIndex: 0,
  nickname: "",
  species: "",
  isShiny: false,
  nature: "",
  level: "",
  ability: "",
  catchRoute: "",
  heldItem: "",
  move1: "",
  move2: "",
  move3: "",
  move4: "",
  causeOfDeath: "",
};

export function TrainerEditor({
  trainer,
  badges,
  canEdit,
  isGm,
}: TrainerEditorProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState(trainer.handle);
  const [statusText, setStatusText] = useState(trainer.statusText ?? "");
  const [realName, setRealName] = useState(trainer.realName ?? "");
  const [avatarSpriteKey, setAvatarSpriteKey] = useState(
    trainer.avatarSpriteKey,
  );
  const [form, setForm] = useState(EMPTY_FORM);

  if (!canEdit) return null;

  function flash(result: { ok: true; message?: string } | { ok: false; error: string }) {
    if (result.ok) {
      setError(null);
      setMessage(result.message ?? "Saved");
    } else {
      setMessage(null);
      setError(result.error);
    }
  }

  function editPokemon(mon: PokemonEntry) {
    setForm({
      id: mon.id,
      slot: mon.slot,
      partyIndex: mon.partyIndex,
      nickname: mon.nickname ?? "",
      species: mon.species,
      isShiny: mon.isShiny,
      nature: mon.nature ?? "",
      level: mon.level != null ? String(mon.level) : "",
      ability: mon.ability ?? "",
      catchRoute: mon.catchRoute ?? "",
      heldItem: mon.heldItem ?? "",
      move1: mon.moves[0] ?? "",
      move2: mon.moves[1] ?? "",
      move3: mon.moves[2] ?? "",
      move4: mon.moves[3] ?? "",
      causeOfDeath: mon.causeOfDeath ?? "",
    });
  }

  return (
    <div id="edit-board" className="scroll-mt-4 space-y-6">
      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">
          Edit profile
        </header>
        <div className="space-y-4 p-3 sm:p-4">
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-muted">Nickname</span>
            <input
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2 text-sm"
              value={handle}
              maxLength={24}
              placeholder="Your league nickname"
              onChange={(e) => setHandle(e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">
              Shown on the league board. Letters, numbers, spaces, and hyphens.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-muted">Real name</span>
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
          <div>
            <span className="mb-2 block text-sm font-bold text-muted">
              Avatar
            </span>
            <AvatarPicker
              value={avatarSpriteKey}
              onChange={setAvatarSpriteKey}
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
            {!trainer.reviveUsed ? (
              <button
                type="button"
                disabled={pending}
                className="pressable rounded-sm bg-danger px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
                onClick={() => {
                  if (!confirm("Spend your Revive Token? This cannot be undone.")) {
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
                Use revive token
              </button>
            ) : isGm ? (
              <button
                type="button"
                disabled={pending}
                className="pressable rounded-sm bg-surface px-4 py-2 font-display text-xs font-bold tracking-wide uppercase disabled:opacity-60"
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
        </div>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">
          Badge case
        </header>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-4">
          {badges.map((badge) => {
            const earned = trainer.earnedBadgeKeys.includes(badge.key);
            return (
              <button
                key={badge.key}
                type="button"
                disabled={pending}
                className={`rounded-sm border-2 border-frame px-2 py-3 text-left text-xs font-bold ${
                  earned ? "bg-accent-2/35" : "bg-surface-2 opacity-70"
                }`}
                onClick={() => {
                  startTransition(async () => {
                    flash(
                      await setBadgeProgressAction({
                        trainerId: trainer.id,
                        badgeKey: badge.key,
                        earned: !earned,
                      }),
                    );
                  });
                }}
              >
                {badge.label}
                <span className="mt-1 block text-[10px] font-normal text-muted">
                  {earned ? "Earned — tap to revoke" : "Tap to earn"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">
          {form.id ? "Edit Pokémon" : "Add Pokémon"}
        </header>
        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-bold text-muted">Species</span>
            <SpeciesCombobox
              value={form.species}
              onChange={(species) => setForm((f) => ({ ...f, species }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Nickname</span>
            <input
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.nickname}
              onChange={(e) =>
                setForm((f) => ({ ...f, nickname: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Slot</span>
            <select
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.slot}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slot: e.target.value as PokemonSlot,
                }))
              }
            >
              <option value="MAIN">Main Squad</option>
              <option value="RESERVE">Reserves</option>
              <option value="GRAVEYARD">R.I.P.</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Party index</span>
            <input
              type="number"
              min={0}
              max={11}
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.partyIndex}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  partyIndex: Number(e.target.value) || 0,
                }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Level</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.level}
              onChange={(e) =>
                setForm((f) => ({ ...f, level: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Nature</span>
            <input
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.nature}
              onChange={(e) =>
                setForm((f) => ({ ...f, nature: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Ability</span>
            <input
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.ability}
              onChange={(e) =>
                setForm((f) => ({ ...f, ability: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Route</span>
            <input
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.catchRoute}
              onChange={(e) =>
                setForm((f) => ({ ...f, catchRoute: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-muted">Held item</span>
            <input
              className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
              value={form.heldItem}
              onChange={(e) =>
                setForm((f) => ({ ...f, heldItem: e.target.value }))
              }
            />
          </label>
          {(["move1", "move2", "move3", "move4"] as const).map((key, i) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-bold text-muted">
                Move {i + 1}
              </span>
              <input
                className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          {form.slot === "GRAVEYARD" ? (
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-bold text-muted">
                Cause of death
              </span>
              <textarea
                className="min-h-16 w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
                value={form.causeOfDeath}
                onChange={(e) =>
                  setForm((f) => ({ ...f, causeOfDeath: e.target.value }))
                }
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isShiny}
              onChange={(e) =>
                setForm((f) => ({ ...f, isShiny: e.target.checked }))
              }
            />
            <span className="font-bold">Shiny</span>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={pending || !form.species.trim()}
              className="pressable rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
              onClick={() => {
                startTransition(async () => {
                  const moves = [
                    form.move1,
                    form.move2,
                    form.move3,
                    form.move4,
                  ].filter(Boolean);
                  flash(
                    await upsertPokemonAction({
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
                    }),
                  );
                  setForm(EMPTY_FORM);
                });
              }}
            >
              {form.id ? "Update Pokémon" : "Add Pokémon"}
            </button>
            {form.id ? (
              <>
                <button
                  type="button"
                  className="pressable rounded-sm bg-surface px-4 py-2 font-display text-xs font-bold tracking-wide uppercase"
                  onClick={() => setForm(EMPTY_FORM)}
                >
                  Cancel edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="pressable rounded-sm bg-danger px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
                  onClick={() => {
                    if (!confirm("Delete this Pokémon entry?")) return;
                    startTransition(async () => {
                      flash(
                        await deletePokemonAction({
                          trainerId: trainer.id,
                          pokemonId: form.id!,
                        }),
                      );
                      setForm(EMPTY_FORM);
                    });
                  }}
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title px-3 py-2 text-sm">
          Quick edit existing
        </header>
        <ul className="divide-y-2 divide-frame/20 p-2">
          {trainer.pokemon.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted">
              No Pokémon yet — add your Main Squad above.
            </li>
          ) : (
            trainer.pokemon.map((mon) => (
              <li
                key={mon.id}
                className="flex items-center justify-between gap-2 px-2 py-2 text-sm"
              >
                <span>
                  <span className="font-bold">{mon.nickname || mon.species}</span>
                  <span className="text-muted">
                    {" "}
                    · {mon.slot.toLowerCase()} #{mon.partyIndex}
                  </span>
                </span>
                <button
                  type="button"
                  className="pressable rounded-sm bg-surface px-3 py-1 text-xs font-bold uppercase"
                  onClick={() => editPokemon(mon)}
                >
                  Edit
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {message ? (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
