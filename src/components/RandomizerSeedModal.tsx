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
  checkSeedAgainstCatches,
  describeSettings,
  indexBySpecies,
  rollWildTables,
  type EncounterKind,
  type RolledArea,
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

/** Rows rendered at once before the search box has to narrow things down. */
const SPECIES_PAGE = 60;

type View = "species" | "route";

type Parsed = {
  format: string;
  trainerName: string | null;
  randomizer: ParsedSaveRandomizer;
  areas: RolledArea[];
  species: SpeciesSighting[];
  check: SeedCheck;
};

function speciesName(pokedexId: number): string {
  return findPokemonById(pokedexId)?.name ?? `#${pokedexId}`;
}

function formatChance(chance: number): string {
  return `${chance % 1 === 0 ? chance : chance.toFixed(1)}%`;
}

function Sprite({ pokedexId, size = 40 }: { pokedexId: number; size?: number }) {
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

function SourceLine({
  label,
  kind,
  chance,
  minLevel,
  maxLevel,
  rods,
}: {
  label: string;
  kind: EncounterKind;
  chance: number;
  minLevel: number;
  maxLevel: number;
  rods?: readonly string[];
}) {
  const rodNote = rods?.length
    ? ` · ${rods.map((r) => ROD_LABELS[r] ?? r).join(" / ")}`
    : "";
  return (
    <span className="text-xs text-muted">
      <strong className="font-semibold text-ink">{label}</strong> ·{" "}
      {KIND_LABELS[kind]}
      {rodNote} · {formatChance(chance)} · Lv{minLevel}
      {maxLevel !== minLevel ? `–${maxLevel}` : ""}
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
      const areas =
        randomizer.reliable && !randomizer.chaos
          ? rollWildTables(randomizer.otId, randomizer)
          : [];
      setParsed({
        format: result.format,
        trainerName: result.trainer?.name ?? null,
        randomizer,
        areas,
        species: indexBySpecies(areas),
        check: checkSeedAgainstCatches(
          areas,
          [...result.party, ...result.box, ...result.rip].map((mon) => ({
            pokedexId: mon.pokedexId,
            species: mon.species,
            catchRoute: mon.catchRoute,
          })),
        ),
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
          save and this replays that mapping offline, so you can tell them where
          a Pokémon actually lives in their run. Afterplay’s{" "}
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
            ) : !rz.wildPokemon ? (
              <p className="rounded-lg border border-frame bg-surface-2 px-3 py-2 text-muted">
                Wild Pokémon randomization is off in this save — encounters are
                vanilla Emerald tables. Nothing to remap.
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

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 rounded-lg border border-frame bg-surface-2 p-1">
                    {(
                      [
                        ["species", "By Pokémon"],
                        ["route", "By route"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`pressable rounded-md px-3 py-1.5 text-xs font-semibold tracking-tight ${
                          view === id
                            ? "bg-accent text-[var(--on-accent)]"
                            : "text-muted"
                        }`}
                        onClick={() => setView(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="search"
                    value={query}
                    placeholder="Filter by Pokémon or route…"
                    className="min-w-0 flex-1 rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                {view === "species" ? (
                  <SpeciesView entries={filteredSpecies} total={parsed.species.length} />
                ) : (
                  <RouteView areas={filteredAreas} total={parsed.areas.length} />
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
}: {
  entries: SpeciesSighting[];
  total: number;
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
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {entry.sources.slice(0, 4).map((source, i) => (
                  <li key={`${source.mapsec}-${source.kind}-${i}`}>
                    <SourceLine {...source} />
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

function RouteView({ areas, total }: { areas: RolledArea[]; total: number }) {
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
            className="rounded-lg border border-frame bg-surface-2 p-2"
          >
            <p className="text-xs font-semibold tracking-wide text-muted">
              {area.label} · {KIND_LABELS[area.kind]}
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
