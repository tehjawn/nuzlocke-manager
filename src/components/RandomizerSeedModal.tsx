"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { findPokemonById } from "@/data/pokemon-index";
import { displayActionError } from "@/lib/action-error-display";
import {
  parsePokemonSaveAsync,
  type ParsedSaveRandomizer,
} from "@/lib/gen3-save";
import {
  buildCaughtIndex,
  buildUsedRouteIndex,
  checkSeedAgainstCatches,
  describeSettings,
  indexBySpecies,
  rollStarters,
  rollStatics,
  rollTrainerParties,
  rollWildTables,
  type CaughtState,
  type EncounterKind,
  type RolledArea,
  type RolledStarter,
  type RolledStatic,
  type RolledTrainer,
  type SeedCheck,
  type SpeciesSighting,
} from "@/lib/tx-randomizer";

const KIND_LABELS: Record<EncounterKind, string> = {
  land: "Grass",
  water: "Surf",
  "rock-smash": "Rock Smash",
  fishing: "Fishing",
};

const ROD_LABELS: Record<string, string> = {
  old_rod: "Old Rod",
  good_rod: "Good Rod",
  super_rod: "Super Rod",
};

const STATIC_KIND_LABELS: Record<RolledStatic["kind"], string> = {
  "wild-battle": "Static battle",
  gift: "Gift / fossil",
  event: "Event legendary",
};

/** Rows rendered at once before the search box has to narrow things down. */
const SPECIES_PAGE = 60;

type View = "species" | "route" | "trainers" | "statics";

const VIEW_TABS: Array<{ id: View; label: string }> = [
  { id: "species", label: "By Pokemon" },
  { id: "route", label: "By route" },
  { id: "trainers", label: "Trainers" },
  { id: "statics", label: "Statics & starter" },
];

type Parsed = {
  format: string;
  trainerName: string | null;
  randomizer: ParsedSaveRandomizer;
  areas: RolledArea[];
  species: SpeciesSighting[];
  trainers: RolledTrainer[];
  statics: RolledStatic[];
  starters: RolledStarter[];
  check: SeedCheck;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
  encounterFlagsReliable: boolean;
};

function speciesName(pokedexId: number): string {
  if (!pokedexId || pokedexId <= 0) return "Unknown species";
  return findPokemonById(pokedexId)?.name ?? `#${pokedexId}`;
}

function formatChance(chance: number): string {
  return `${chance % 1 === 0 ? chance : chance.toFixed(1)}%`;
}

/**
 * A species the catalog has no row for — ROM debug scaffolding, or a species
 * added upstream that `pokemon.json` has not caught up with.
 *
 * `pokemonSpriteUrl` falls back to a Showdown slug when it has no dex id, and
 * `showdownProxyUrl` *throws* on a slug it cannot parse. That happens during
 * render, so one unknown id takes the whole modal down with it. Draw a
 * placeholder instead: a gap in a reference table is survivable, a blank screen
 * is not.
 */
function Sprite({ pokedexId, size = 40 }: { pokedexId: number; size?: number }) {
  if (!pokedexId || pokedexId <= 0) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded border border-dashed border-frame text-xs text-muted"
        style={{ height: size, width: size }}
      >
        ?
      </span>
    );
  }
  const name = speciesName(pokedexId);
  return (
    <PokemonSpriteImage
      alt={name}
      className="pixelated shrink-0 object-contain"
      height={size}
      loading="lazy"
      pokedexId={pokedexId}
      species={name}
      width={size}
    />
  );
}

/**
 * "You already have this." Exact catches and evolution relatives read
 * differently on purpose — a relative still blocks a species clause, but only
 * the exact match means the dex entry is done.
 */
function CaughtPill({ state }: { state: CaughtState }) {
  if (!state) return null;
  return (
    <span
      className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold ${
        state === "caught"
          ? "bg-accent/20 text-accent-deep"
          : "border border-frame text-muted"
      }`}
      title={
        state === "caught"
          ? "This trainer already has this species"
          : "This trainer already has something in this evolution line"
      }
    >
      {state === "caught" ? "Caught" : "Line"}
    </span>
  );
}

/** The ROM's own encounter flag for the area — the slot is spent. */
function UsedPill({ used }: { used: boolean }) {
  if (!used) return null;
  return (
    <span
      className="ml-1.5 shrink-0 rounded-full border border-frame px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold text-muted"
      title="The ROM has this encounter slot flagged as already spent"
    >
      Slot used
    </span>
  );
}

function SourceLine({
  label,
  kind,
  chance,
  minLevel,
  maxLevel,
  rods,
  used,
}: {
  label: string;
  kind: EncounterKind;
  chance: number;
  minLevel: number;
  maxLevel: number;
  rods?: readonly string[];
  used: boolean;
}) {
  const rodNote = rods?.length
    ? ` · ${rods.map((r) => ROD_LABELS[r] ?? r).join(" / ")}`
    : "";
  return (
    <span className={`text-xs ${used ? "text-muted/60" : "text-muted"}`}>
      <strong className={`font-semibold ${used ? "text-muted" : "text-ink"}`}>
        {label}
      </strong>{" "}
      · {KIND_LABELS[kind]}
      {rodNote} · {formatChance(chance)} · Lv{minLevel}
      {maxLevel !== minLevel ? `–${maxLevel}` : ""}
      <UsedPill used={used} />
    </span>
  );
}

export function RandomizerSeedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [view, setView] = useState<View>("species");
  const [query, setQuery] = useState("");

  const filteredSpecies = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    if (!q) return parsed.species;
    return parsed.species.filter(
      (entry) =>
        speciesName(entry.pokedexId).toLowerCase().includes(q) ||
        entry.sources.some((source) => source.label.toLowerCase().includes(q)),
    );
  }, [parsed, query]);

  const filteredAreas = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    if (!q) return parsed.areas;
    return parsed.areas.filter(
      (area) =>
        area.label.toLowerCase().includes(q) ||
        area.slots.some((slot) =>
          speciesName(slot.pokedexId).toLowerCase().includes(q),
        ),
    );
  }, [parsed, query]);

  const filteredTrainers = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    if (!q) return parsed.trainers;
    return parsed.trainers.filter(
      (trainer) =>
        trainer.name.toLowerCase().includes(q) ||
        trainer.className.toLowerCase().includes(q) ||
        trainer.locations.some((loc) => loc.toLowerCase().includes(q)) ||
        trainer.party.some((mon) =>
          speciesName(mon.pokedexId).toLowerCase().includes(q),
        ),
    );
  }, [parsed, query]);

  const filteredStatics = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    if (!q) return parsed.statics;
    return parsed.statics.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        speciesName(entry.pokedexId).toLowerCase().includes(q) ||
        speciesName(entry.vanillaPokedexId).toLowerCase().includes(q),
    );
  }, [parsed, query]);

  if (!open) return null;

  function reset() {
    setParsing(false);
    setError(null);
    setParsed(null);
    setView("species");
    setQuery("");
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setError(null);
    setParsed(null);
    try {
      const result = await parsePokemonSaveAsync(new Uint8Array(await file.arrayBuffer()));
      if (!result.ok) {
        setError(displayActionError(result.error));
        return;
      }
      const randomizer = result.randomizer;
      const playable = randomizer.reliable && !randomizer.chaos;
      const areas = playable ? rollWildTables(randomizer.otId, randomizer) : [];
      const owned = [...result.party, ...result.box, ...result.rip];
      setParsed({
        format: result.format,
        trainerName: result.trainer?.name ?? null,
        randomizer,
        areas,
        species: indexBySpecies(areas),
        trainers: playable ? rollTrainerParties(randomizer.otId, randomizer) : [],
        statics: playable ? rollStatics(randomizer.otId, randomizer) : [],
        starters: playable ? rollStarters(randomizer.otId, randomizer) : [],
        check: checkSeedAgainstCatches(
          areas,
          owned.map((mon) => ({
            pokedexId: mon.pokedexId,
            species: mon.species,
            catchRoute: mon.catchRoute,
          })),
        ),
        caughtState: buildCaughtIndex(owned),
        isRouteUsed: buildUsedRouteIndex(result.encounterFlags.usedBits),
        encounterFlagsReliable: result.encounterFlags.reliable,
      });
    } catch (e) {
      setError(
        displayActionError(
          e instanceof Error ? e.message : "Failed to read save file",
        ),
      );
    } finally {
      setParsing(false);
    }
  }

  const rz = parsed?.randomizer;
  const check = parsed?.check;
  // Below ~70% the pools almost certainly came from a different ROM build than
  // the player's, and every mapping shown would be wrong in the same silent way.
  const confidence =
    check && check.checked > 0 ? check.matched / check.checked : null;
  const lowConfidence = confidence != null && confidence < 0.7;

  return (
    <Modal
      open={open}
      title="Randomizer seed parser"
      size="fullscreen"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Read-only — nothing here writes to the season.
          </p>
          <button
            type="button"
            className="pressable rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Modern Emerald doesn’t rewrite encounter tables — it rerolls each
          species as it spawns, seeded by the player’s trainer ID. Drop in their
          save and this replays that mapping offline: where a Pokémon actually
          lives in their run, what each route holds, and what the key trainers,
          scripted encounters, and starter bag rolled. Species they already own
          and route slots they have already spent are marked. Afterplay’s{" "}
          <code className="text-ink">.sav</code> /{" "}
          <code className="text-ink">.srm</code> export is the most reliable
          source; emulator states work too.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-muted">
            Save file
          </span>
          <input
            type="file"
            accept=".state,.sav,.srm,.ss0,.ss1,.ss2,.ss3,.ss4,.ss5,.ss6,.ss7,.ss8,.ss9,.s0,.s1,.s2,.s3,.s4,.s5,.s6,.s7,.s8,.s9,.sr0,.sr1,.sr2,.sr3,.sr4,.sr5,.sr6,.sr7,.sr8,.sr9,application/octet-stream"
            disabled={parsing}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-frame file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {parsing ? <p className="text-muted">Reading save…</p> : null}
        {error ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-danger">
            {error}
          </p>
        ) : null}

        {parsed && rz ? (
          <>
            <div className="space-y-2 rounded-lg border border-frame bg-surface-2 p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-xs font-semibold tracking-wide text-muted">
                  Seed
                </p>
                <p className="font-mono text-ink">
                  {rz.otId.toString(16).toUpperCase().padStart(8, "0")}
                </p>
                <p className="text-xs text-muted">
                  {parsed.trainerName ? `${parsed.trainerName} · ` : ""}
                  {parsed.format}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {describeSettings(rz).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-frame bg-surface px-2 py-0.5 text-xs text-muted"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {!rz.reliable ? (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-danger">
                Couldn’t read the trainer ID or the randomizer settings from this
                save. Ask for an Afterplay <code>.sav</code> / <code>.srm</code>{" "}
                export instead of an emulator state.
              </p>
            ) : rz.chaos ? (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-danger">
                Chaos mode is on. The ROM rerolls from live RNG on every
                encounter rather than from the seed, so no mapping can be
                predicted for this run — not by this tool and not by anything
                else.
              </p>
            ) : (
              <>
                {check && check.checked > 0 ? (
                  <p
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      lowConfidence
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-frame bg-surface-2 text-muted"
                    }`}
                  >
                    <strong className="font-semibold">
                      {check.matched}/{check.checked}
                    </strong>{" "}
                    of this trainer’s own catches land on the species this seed
                    predicts for those routes
                    {check.skipped > 0
                      ? ` (${check.skipped} skipped — gifts, fossils, and trades have no wild table)`
                      : ""}
                    .{" "}
                    {lowConfidence
                      ? "That is too low to trust: the tables here are pinned to one Modern Emerald build, and this save looks like a different one. Treat everything below as unverified."
                      : "Evolved catches count when the seed rolls a relative — high-level slots spawn already-evolved."}
                  </p>
                ) : null}

                {!parsed.encounterFlagsReliable ? (
                  <p className="rounded-lg border border-frame bg-surface-2 px-3 py-2 text-xs text-muted">
                    Couldn’t read this run’s encounter flags, so spent route
                    slots aren’t marked below. Caught species still are.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1 rounded-lg border border-frame bg-surface-2 p-1">
                    {VIEW_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`pressable rounded-md px-3 py-1.5 text-xs font-semibold tracking-tight ${
                          view === tab.id
                            ? "bg-accent text-[var(--on-accent)]"
                            : "text-muted"
                        }`}
                        onClick={() => setView(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="search"
                    value={query}
                    placeholder="Filter by Pokémon, route, or trainer…"
                    className="min-w-0 flex-1 rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                {(view === "species" || view === "route") && !rz.wildPokemon ? (
                  <p className="rounded-lg border border-frame bg-surface-2 px-3 py-2 text-muted">
                    Wild Pokémon randomization is off in this save — encounters
                    are vanilla Emerald tables. Nothing to remap.
                  </p>
                ) : view === "species" ? (
                  <SpeciesView
                    entries={filteredSpecies}
                    total={parsed.species.length}
                    caughtState={parsed.caughtState}
                    isRouteUsed={parsed.isRouteUsed}
                  />
                ) : view === "route" ? (
                  <RouteView
                    areas={filteredAreas}
                    total={parsed.areas.length}
                    caughtState={parsed.caughtState}
                    isRouteUsed={parsed.isRouteUsed}
                  />
                ) : view === "trainers" ? (
                  <TrainerView
                    trainers={filteredTrainers}
                    total={parsed.trainers.length}
                    randomized={rz.trainers}
                    mapBased={rz.mapBased}
                    caughtState={parsed.caughtState}
                  />
                ) : (
                  <StaticView
                    statics={filteredStatics}
                    total={parsed.statics.length}
                    starters={parsed.starters}
                    randomized={rz.statics}
                    starterRandomized={rz.starter}
                    oneTypeChallenge={rz.oneTypeChallenge}
                    caughtState={parsed.caughtState}
                  />
                )}
              </>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function SpeciesView({
  entries,
  total,
  caughtState,
  isRouteUsed,
}: {
  entries: SpeciesSighting[];
  total: number;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
}) {
  const shown = entries.slice(0, SPECIES_PAGE);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {entries.length} of {total} species are catchable somewhere in this seed
        {shown.length < entries.length
          ? ` — showing the first ${shown.length}, keep typing to narrow it down`
          : ""}
        . Best route first.
      </p>
      <ul className="space-y-1.5">
        {shown.map((entry) => (
          <li
            key={entry.pokedexId}
            className="flex items-start gap-3 rounded-lg border border-frame bg-surface-2 p-2"
          >
            <Sprite pokedexId={entry.pokedexId} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-tight text-ink">
                {speciesName(entry.pokedexId)}
                <CaughtPill state={caughtState(entry.pokedexId)} />
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {entry.sources.slice(0, 4).map((source, i) => (
                  <li key={`${source.mapsec}-${source.kind}-${i}`}>
                    <SourceLine {...source} used={isRouteUsed(source.label)} />
                  </li>
                ))}
              </ul>
              {entry.sources.length > 4 ? (
                <p className="mt-0.5 text-xs text-muted">
                  +{entry.sources.length - 4} more area
                  {entry.sources.length - 4 === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {entries.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}

function RouteView({
  areas,
  total,
  caughtState,
  isRouteUsed,
}: {
  areas: RolledArea[];
  total: number;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {areas.length} of {total} wild tables. Each row is{" "}
        <em>vanilla species → what this seed spawns instead</em>.
      </p>
      <ul className="space-y-2">
        {areas.map((area) => (
          <li
            key={`${area.mapsec}-${area.kind}`}
            className={`rounded-lg border border-frame bg-surface-2 p-2 ${
              isRouteUsed(area.label) ? "opacity-70" : ""
            }`}
          >
            <p className="text-xs font-semibold tracking-wide text-muted">
              {area.label} · {KIND_LABELS[area.kind]}
              <UsedPill used={isRouteUsed(area.label)} />
            </p>
            <ul className="mt-1 space-y-0.5">
              {area.slots.map((slot, i) => (
                <li
                  key={`${slot.vanillaSpecies}-${i}`}
                  className="flex items-center gap-2"
                >
                  <Sprite pokedexId={slot.pokedexId} size={28} />
                  <span className="text-xs">
                    <span className="text-muted line-through">
                      {speciesName(slot.vanillaPokedexId)}
                    </span>{" "}
                    <span className="font-semibold text-ink">
                      {speciesName(slot.pokedexId)}
                    </span>
                    <CaughtPill state={caughtState(slot.pokedexId)} />
                    {slot.unchanged ? (
                      <span className="text-muted"> (not randomized)</span>
                    ) : null}
                    <span className="text-muted">
                      {" "}
                      · {formatChance(slot.chance)} · Lv{slot.minLevel}
                      {slot.maxLevel !== slot.minLevel
                        ? `–${slot.maxLevel}`
                        : ""}
                      {slot.rods?.length
                        ? ` · ${slot.rods
                            .map((r) => ROD_LABELS[r] ?? r)
                            .join(" / ")}`
                        : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {areas.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}

function MonSwap({
  vanillaPokedexId,
  pokedexId,
  unchanged,
  trailing,
  caughtState,
}: {
  vanillaPokedexId: number;
  pokedexId: number;
  unchanged: boolean;
  trailing?: string;
  caughtState: (pokedexId: number) => CaughtState;
}) {
  return (
    <span className="flex items-center gap-2">
      <Sprite pokedexId={pokedexId} size={28} />
      <span className="text-xs">
        <span className="text-muted line-through">
          {speciesName(vanillaPokedexId)}
        </span>{" "}
        <span className="font-semibold text-ink">{speciesName(pokedexId)}</span>
        <CaughtPill state={caughtState(pokedexId)} />
        {unchanged ? (
          <span className="text-muted"> (not randomized)</span>
        ) : null}
        {trailing ? <span className="text-muted"> · {trailing}</span> : null}
      </span>
    </span>
  );
}

function TrainerView({
  trainers,
  total,
  randomized,
  mapBased,
  caughtState,
}: {
  trainers: RolledTrainer[];
  total: number;
  randomized: boolean;
  mapBased: boolean;
  caughtState: (pokedexId: number) => CaughtState;
}) {
  if (!randomized) {
    return (
      <p className="rounded-lg border border-frame bg-surface-2 px-3 py-2 text-muted">
        Trainer randomization is off in this save — every gym leader, Elite Four
        member, and rival battle runs its vanilla Modern Emerald team.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {trainers.length} of {total} key battles — gym leaders, Elite Four,
        champion, rival, and both teams. Levels are the ROM’s base values;{" "}
        <code className="text-ink">GetScaledLevel</code> shifts them by 1–10
        depending on difficulty and badge count.
        {mapBased
          ? " Map-based rolls depend on where the battle happens, so a trainer with no script of their own can’t be pinned."
          : ""}
      </p>
      <ul className="space-y-2">
        {trainers.map((trainer) => (
          <li
            key={trainer.id}
            className="rounded-lg border border-frame bg-surface-2 p-2"
          >
            <p className="text-xs font-semibold tracking-wide text-muted">
              {trainer.name} · {trainer.className.replaceAll("_", " ")}
              {trainer.locations.length > 0
                ? ` · ${trainer.locations.join(" / ")}`
                : ""}
            </p>
            {trainer.locationUnknown ? (
              <p className="mt-0.5 text-xs text-danger">
                No battle script places this trainer, so the map half of the seed
                is unknown — this party is a guess.
              </p>
            ) : trainer.variesByLocation ? (
              <p className="mt-0.5 text-xs text-muted">
                Fought in more than one place, and the roll differs between them;
                the party below is for {trainer.locations[0]}.
              </p>
            ) : null}
            <ul className="mt-1 space-y-0.5">
              {trainer.party.map((mon, i) => (
                <li key={`${mon.vanillaSpecies}-${i}`}>
                  <MonSwap
                    vanillaPokedexId={mon.vanillaPokedexId}
                    pokedexId={mon.pokedexId}
                    unchanged={mon.unchanged}
                    trailing={`Lv${mon.level}`}
                    caughtState={caughtState}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {trainers.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}

function StaticView({
  statics,
  total,
  starters,
  randomized,
  starterRandomized,
  oneTypeChallenge,
  caughtState,
}: {
  statics: RolledStatic[];
  total: number;
  starters: RolledStarter[];
  randomized: boolean;
  starterRandomized: boolean;
  oneTypeChallenge: boolean;
  caughtState: (pokedexId: number) => CaughtState;
}) {
  const rerolled = statics.filter((entry) => entry.randomized);
  const fixed = statics.filter((entry) => !entry.randomized);
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-frame bg-surface-2 p-2">
        <p className="text-xs font-semibold tracking-wide text-muted">
          Birch’s bag — Route 101
        </p>
        {!starterRandomized ? (
          <p className="text-xs text-muted">
            Starter randomization is off; the bag holds the vanilla trio.
          </p>
        ) : oneTypeChallenge ? (
          <p className="text-xs text-danger">
            A one-type challenge is active, which sends the starter through a
            separate type-filtered picker this tool does not model.
          </p>
        ) : (
          <p className="text-xs text-muted">
            Picked by a different algorithm from everything else here — the pool
            is shuffled with a fixed seed and read at a stride of 27. Unlike the
            wild tables, this one has no independent check against the run.
          </p>
        )}
        {!oneTypeChallenge ? (
          <ul className="space-y-0.5">
            {starters.map((starter) => (
              <li key={starter.starterId}>
                <MonSwap
                  vanillaPokedexId={starter.vanillaPokedexId}
                  pokedexId={starter.pokedexId}
                  unchanged={!starterRandomized}
                  trailing={`Lv5 · slot ${starter.starterId + 1}`}
                  caughtState={caughtState}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted">
          {statics.length} of {total} scripted encounters.{" "}
          {randomized
            ? "Static battles and gifts reroll; event legendaries do not."
            : "Static randomization is off — everything below is vanilla."}
        </p>
        {rerolled.length > 0 ? (
          <ul className="space-y-1.5">
            {rerolled.map((entry, i) => (
              <li
                key={`${entry.mapsec}-${entry.vanillaSpecies}-${i}`}
                className="rounded-lg border border-frame bg-surface-2 p-2"
              >
                <p className="text-xs font-semibold tracking-wide text-muted">
                  {entry.label} · {STATIC_KIND_LABELS[entry.kind]}
                </p>
                <div className="mt-1">
                  <MonSwap
                    vanillaPokedexId={entry.vanillaPokedexId}
                    pokedexId={entry.pokedexId}
                    unchanged={false}
                    trailing={`Lv${entry.level}`}
                    caughtState={caughtState}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {fixed.length > 0 ? (
          <div className="rounded-lg border border-frame bg-surface-2 p-2">
            <p className="text-xs font-semibold tracking-wide text-muted">
              Never rerolled — {fixed.length} event encounter
              {fixed.length === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              These use <code className="text-ink">seteventmon</code>, which
              reaches <code className="text-ink">CreateMon</code> without ever
              calling the randomizer. The Regis, Rayquaza, and the rest of the
              braille-puzzle legendaries are exactly who the ROM says, even with
              static randomization on.
            </p>
            <ul className="mt-1 space-y-0.5">
              {fixed.map((entry, i) => (
                <li
                  key={`${entry.mapsec}-${entry.vanillaSpecies}-${i}`}
                  className="flex items-center gap-2"
                >
                  <Sprite pokedexId={entry.pokedexId} size={24} />
                  <span className="text-xs text-muted">
                    <strong className="font-semibold text-ink">
                      {speciesName(entry.pokedexId)}
                    </strong>
                    <CaughtPill state={caughtState(entry.pokedexId)} /> ·{" "}
                    {entry.label} · Lv{entry.level}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {statics.length === 0 ? (
          <p className="text-muted">Nothing matches that filter.</p>
        ) : null}
      </div>
    </div>
  );
}
