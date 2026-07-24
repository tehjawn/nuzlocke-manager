"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  deletePokemonAction,
  setBadgeProgressAction,
  updateTrainerBoardAction,
  upsertPokemonAction,
} from "@/app/actions/challenge";
import { AvatarPicker } from "@/components/AvatarPicker";
import {
  EMPTY_POKEMON_FORM,
  PokemonFormModal,
  pokemonEntryToForm,
  type PokemonFormState,
} from "@/components/PokemonFormModal";
import type {
  BadgeDefinition,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { getEmeraldBadgeMeta } from "@/lib/emerald-badges";
import { pokemonSpriteUrl, trainerSpriteUrl } from "@/lib/sprites";

type TrainerEditorProps = {
  trainer: TrainerProfile;
  badges: BadgeDefinition[];
  canEdit: boolean;
  isGm: boolean;
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
  const [pokemonOpen, setPokemonOpen] = useState(false);
  const [pokemonForm, setPokemonForm] =
    useState<PokemonFormState>(EMPTY_POKEMON_FORM);

  if (!canEdit) return null;

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

  function openAddPokemon(slot: PokemonEntry["slot"] = "MAIN") {
    const used = new Set(
      trainer.pokemon.filter((p) => p.slot === slot).map((p) => p.partyIndex),
    );
    let partyIndex = 0;
    while (used.has(partyIndex) && partyIndex < 12) partyIndex += 1;
    setPokemonForm({ ...EMPTY_POKEMON_FORM, slot, partyIndex });
    setPokemonOpen(true);
  }

  function openEditPokemon(mon: PokemonEntry) {
    setPokemonForm(pokemonEntryToForm(mon));
    setPokemonOpen(true);
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
          Emerald badge case
        </header>
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4">
          {badges.map((badge) => {
            const earned = trainer.earnedBadgeKeys.includes(badge.key);
            const meta = getEmeraldBadgeMeta(badge.key);
            const title = meta?.badgeName ?? badge.label;
            return (
              <button
                key={badge.key}
                type="button"
                disabled={pending}
                className={`flex items-center gap-3 rounded-sm border-2 border-frame px-2 py-2 text-left ${
                  earned ? "bg-accent-2/35" : "bg-surface-2 opacity-75"
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
                {meta ? (
                  <Image
                    src={trainerSpriteUrl(meta.leaderSpriteKey)}
                    alt=""
                    width={56}
                    height={56}
                    className="pixelated h-14 w-14 shrink-0 object-contain"
                    unoptimized
                  />
                ) : null}
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-display text-[9px] font-bold uppercase"
                  style={{
                    background: earned
                      ? `radial-gradient(circle at 35% 30%, #fff6d5, ${meta?.accent ?? "#e8c56a"})`
                      : "var(--surface)",
                    borderColor: meta?.accent ?? "var(--frame)",
                  }}
                >
                  {(meta?.shortName ?? title).slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {badge.leaderName ?? meta?.shortName}
                    {meta?.city ? ` · ${meta.city}` : ""}
                    {" · "}
                    {earned ? "Earned — tap to revoke" : "Tap to earn"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="gba-frame">
        <header className="gba-frame-title flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <span>Pokémon party</span>
          <button
            type="button"
            className="pressable rounded-sm bg-white/20 px-3 py-1 text-xs font-bold uppercase"
            onClick={() => openAddPokemon("MAIN")}
          >
            Add Pokémon
          </button>
        </header>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="pressable rounded-sm bg-accent px-3 py-2 text-xs font-bold text-white uppercase"
              onClick={() => openAddPokemon("MAIN")}
            >
              + Main Squad
            </button>
            <button
              type="button"
              className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-2 text-xs font-bold uppercase"
              onClick={() => openAddPokemon("RESERVE")}
            >
              + Reserve
            </button>
            <button
              type="button"
              className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-2 text-xs font-bold uppercase"
              onClick={() => openAddPokemon("GRAVEYARD")}
            >
              + Memorial
            </button>
          </div>

          <ul className="divide-y-2 divide-frame/20 rounded-sm border-2 border-frame">
            {trainer.pokemon.length === 0 ? (
              <li className="px-3 py-4 text-sm text-muted">
                No Pokémon yet — add your first catch to start the board.
              </li>
            ) : (
              trainer.pokemon.map((mon) => (
                <li
                  key={mon.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Image
                      src={pokemonSpriteUrl(mon.species, {
                        shiny: mon.isShiny,
                        pokedexId: mon.pokedexId,
                      })}
                      alt=""
                      width={40}
                      height={40}
                      className="pixelated h-10 w-10 object-contain"
                      unoptimized
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {mon.nickname || mon.species}
                      </span>
                      <span className="text-xs text-muted">
                        {mon.species} · {mon.slot.toLowerCase()} #
                        {mon.partyIndex}
                        {mon.level != null ? ` · Lv${mon.level}` : ""}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pressable shrink-0 rounded-sm bg-surface px-3 py-1 text-xs font-bold uppercase"
                    onClick={() => openEditPokemon(mon)}
                  >
                    Edit
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

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

      {message ? (
        <p className="text-sm font-semibold text-accent-deep">{message}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
