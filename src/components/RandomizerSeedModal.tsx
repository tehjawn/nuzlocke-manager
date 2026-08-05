"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { findPokemonById } from "@/data/pokemon-index";
import { displayActionError } from "@/lib/action-error-display";
import {
  competitiveTierFor,
  competitiveTierToneClass,
} from "@/lib/competitive-tiers";
import {
  parsePokemonSaveAsync,
  type ParsedSaveRandomizer,
} from "@/lib/gen3-save";
import { evolutionFamily } from "@/lib/species-evolutions";
import {
  STAT_RANKS_BEST_FIRST,
  type StatRank,
} from "@/lib/species-ranks";
import { toolsHref } from "@/lib/tools-routes";
import {
  buildCaughtIndex,
  buildSlotPokemonIndex,
  buildUsedRouteIndex,
  checkSeedAgainstCatches,
  describeSettings,
  indexBySpecies,
  rollStatics,
  rollWildTables,
  type CaughtState,
  type EncounterKind,
  type RolledArea,
  type RolledStatic,
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

type View = "species" | "route" | "statics";

/** Empty selection = all tiers. */
type CompTierKey = StatRank | "untiered";

const COMP_TIER_FILTERS: Array<{ id: CompTierKey; label: string }> = [
  ...STAT_RANKS_BEST_FIRST.map((rank) => ({ id: rank, label: rank })),
  { id: "untiered", label: "–" },
];

const VIEW_TABS: Array<{ id: View; label: string }> = [
  { id: "species", label: "By Pokemon" },
  { id: "route", label: "By route" },
  { id: "statics", label: "Statics" },
];

type Parsed = {
  format: string;
  trainerName: string | null;
  randomizer: ParsedSaveRandomizer;
  areas: RolledArea[];
  species: SpeciesSighting[];
  statics: RolledStatic[];
  check: SeedCheck;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
  /** Present after a fresh parse; optional so HMR of an open modal stays safe. */
  slotPokemon?: (label: string) => number | null;
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
 * Heat-map the encounter % so common slots pop while 1–5% fillers stay quiet.
 * Breaks sit on Gen 3 table shapes (60/30 surf, 20/20 land, 5/4/1 rares).
 */
function chanceTone(chance: number): string {
  if (chance >= 40) return "text-accent-deep";
  if (chance >= 20) return "text-accent-2";
  if (chance >= 10) return "text-ink";
  return "text-muted";
}

function speciesHoverPreview(pokedexId: number) {
  const entry = competitiveTierFor(pokedexId);
  return {
    species: speciesName(pokedexId),
    pokedexId,
    subtitle:
      entry?.tier != null
        ? `Comp ${entry.tier}`
        : "Untiered — not curated yet",
    detail: entry?.reason ?? undefined,
  };
}

function CompTierStamp({
  pokedexId,
  className = "",
}: {
  pokedexId: number;
  className?: string;
}) {
  const entry = competitiveTierFor(pokedexId);
  const tone =
    entry?.tier != null
      ? competitiveTierToneClass(entry.tier)
      : "border-frame/40 bg-surface-2/70 text-muted";
  const label = entry?.tier ?? "–";
  return (
    <span
      className={`inline-flex items-center rounded border px-1 py-px text-[9px] font-bold leading-none ${tone} ${className}`}
      title={
        entry?.tier != null && entry.reason
          ? `Comp ${entry.tier}: ${entry.reason}`
          : "Untiered — not curated yet"
      }
    >
      {label}
    </span>
  );
}

function matchesCompTier(
  pokedexId: number,
  selected: readonly CompTierKey[],
): boolean {
  if (selected.length === 0) return true;
  const tier = competitiveTierFor(pokedexId)?.tier ?? null;
  return selected.includes(tier ?? "untiered");
}

function toggleCompTier(
  selected: readonly CompTierKey[],
  key: CompTierKey,
): CompTierKey[] {
  return selected.includes(key)
    ? selected.filter((entry) => entry !== key)
    : [...selected, key];
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

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M3.5 8.2 6.2 11l6.3-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fixed tile width — `1fr` columns were stretching cards wider than the content. */
const SLOT_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(5.75rem,5.75rem))] justify-start gap-2";

const ROD_SHORT: Record<string, string> = {
  old_rod: "Old",
  good_rod: "Good",
  super_rod: "Super",
};

const NO_SLOT_POKEMON = (_label: string): number | null => null;

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
  slug,
}: {
  open: boolean;
  onClose: () => void;
  /** Challenge slug — used to deep-link species into the Pokédex tool. */
  slug: string;
}) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [view, setView] = useState<View>("species");
  const [query, setQuery] = useState("");
  const [compTiers, setCompTiers] = useState<CompTierKey[]>([]);

  const filteredSpecies = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    return parsed.species.filter((entry) => {
      if (!matchesCompTier(entry.pokedexId, compTiers)) return false;
      if (!q) return true;
      return (
        speciesName(entry.pokedexId).toLowerCase().includes(q) ||
        entry.sources.some((source) => source.label.toLowerCase().includes(q))
      );
    });
  }, [parsed, query, compTiers]);

  const filteredAreas = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    const out: RolledArea[] = [];
    for (const area of parsed.areas) {
      const labelMatch = !q || area.label.toLowerCase().includes(q);
      const slots = area.slots.filter((slot) => {
        if (!matchesCompTier(slot.pokedexId, compTiers)) return false;
        if (!q || labelMatch) return true;
        return speciesName(slot.pokedexId).toLowerCase().includes(q);
      });
      if (slots.length === 0) continue;
      out.push(slots === area.slots ? area : { ...area, slots });
    }
    return out;
  }, [parsed, query, compTiers]);

  const filteredStatics = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    return parsed.statics.filter((entry) => {
      if (!matchesCompTier(entry.pokedexId, compTiers)) return false;
      if (!q) return true;
      return (
        entry.label.toLowerCase().includes(q) ||
        speciesName(entry.pokedexId).toLowerCase().includes(q) ||
        speciesName(entry.vanillaPokedexId).toLowerCase().includes(q)
      );
    });
  }, [parsed, query, compTiers]);

  if (!open) return null;

  function reset() {
    setParsing(false);
    setError(null);
    setParsed(null);
    setView("species");
    setQuery("");
    setCompTiers([]);
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
      // Encountered buffer can still carry a met-location for a just-battled
      // wild mon; include those so a spent slot can show who burned it.
      const withRoutes = [
        ...owned,
        ...result.encountered.filter((mon) => mon.catchRoute),
      ];
      setParsed({
        format: result.format,
        trainerName: result.trainer?.name ?? null,
        randomizer,
        areas,
        species: indexBySpecies(areas),
        statics: playable ? rollStatics(randomizer.otId, randomizer) : [],
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
        slotPokemon: buildSlotPokemonIndex(withRoutes),
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
          lives in their run, what each route holds, and what the scripted
          encounters rolled. Species they already own and route slots they have
          already spent are marked. Afterplay’s{" "}
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
                    placeholder="Filter by Pokémon or route…"
                    className="min-w-0 flex-1 rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[0.65rem] font-semibold tracking-wide text-muted">
                    Comp
                  </span>
                  {COMP_TIER_FILTERS.map((tier) => {
                    const active = compTiers.includes(tier.id);
                    const tone =
                      tier.id === "untiered"
                        ? "border-frame/40 bg-surface-2/70 text-muted"
                        : competitiveTierToneClass(tier.id);
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        aria-pressed={active}
                        title={
                          tier.id === "untiered"
                            ? "Untiered — not curated yet"
                            : `Competitive ${tier.id}`
                        }
                        className={`pressable inline-flex min-w-7 items-center justify-center rounded border px-1.5 py-0.5 text-[0.7rem] font-bold leading-none ${
                          active
                            ? tone
                            : "border-frame/50 bg-surface text-muted opacity-55 hover:opacity-90"
                        }`}
                        onClick={() =>
                          setCompTiers((prev) => toggleCompTier(prev, tier.id))
                        }
                      >
                        {tier.label}
                      </button>
                    );
                  })}
                  {compTiers.length > 0 ? (
                    <button
                      type="button"
                      className="pressable ml-0.5 text-[0.65rem] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => setCompTiers([])}
                    >
                      Clear
                    </button>
                  ) : (
                    <span className="text-[0.65rem] text-muted">All tiers</span>
                  )}
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
                    slug={slug}
                    onNavigate={onClose}
                  />
                ) : view === "route" ? (
                  <RouteView
                    areas={filteredAreas}
                    totalTables={parsed.areas.length}
                    caughtState={parsed.caughtState}
                    isRouteUsed={parsed.isRouteUsed}
                    slotPokemon={parsed.slotPokemon ?? NO_SLOT_POKEMON}
                    slug={slug}
                    onNavigate={onClose}
                  />
                ) : (
                  <StaticView
                    statics={filteredStatics}
                    total={parsed.statics.length}
                    randomized={rz.statics}
                    caughtState={parsed.caughtState}
                    slug={slug}
                    onNavigate={onClose}
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
  slug,
  onNavigate,
}: {
  entries: SpeciesSighting[];
  total: number;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
  slug: string;
  onNavigate: () => void;
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
          <li key={entry.pokedexId}>
            <PokemonHoverPreview
              className="block"
              speciesPreview={speciesHoverPreview(entry.pokedexId)}
            >
              <Link
                href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
                onClick={onNavigate}
                aria-label={`Open ${speciesName(entry.pokedexId)} in Pokédex`}
                className="pressable flex items-start gap-3 rounded-lg border border-frame bg-surface-2 p-2 hover:border-interactive/40"
              >
                <span className="relative shrink-0">
                  <Sprite pokedexId={entry.pokedexId} />
                  <CompTierStamp
                    pokedexId={entry.pokedexId}
                    className="absolute -right-1 -top-1"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-tight text-ink">
                    {speciesName(entry.pokedexId)}
                    <CaughtPill state={caughtState(entry.pokedexId)} />
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {entry.sources.slice(0, 4).map((source, i) => (
                      <li key={`${source.mapsec}-${source.kind}-${i}`}>
                        <SourceLine
                          {...source}
                          used={isRouteUsed(source.label)}
                        />
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
              </Link>
            </PokemonHoverPreview>
          </li>
        ))}
      </ul>
      {entries.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}

type RouteGroup = {
  label: string;
  used: boolean;
  slotPokedexId: number | null;
  areas: RolledArea[];
};

function groupAreasByRoute(
  areas: readonly RolledArea[],
  isRouteUsed: (label: string) => boolean,
  slotPokemon: (label: string) => number | null,
): RouteGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, RolledArea[]>();
  for (const area of areas) {
    const list = byLabel.get(area.label);
    if (list) list.push(area);
    else {
      byLabel.set(area.label, [area]);
      order.push(area.label);
    }
  }
  return order.map((label) => ({
    label,
    used: isRouteUsed(label),
    slotPokedexId: slotPokemon(label),
    areas: byLabel.get(label) ?? [],
  })).sort((a, b) => Number(a.used) - Number(b.used));
}

function RouteSlotTile({
  pokedexId,
  vanillaPokedexId,
  chance,
  minLevel,
  maxLevel,
  rods,
  kind,
  unchanged,
  caughtState,
  routeSlotPokedexId,
  slug,
  onNavigate,
}: {
  pokedexId: number;
  vanillaPokedexId: number;
  chance: number;
  minLevel: number;
  maxLevel: number;
  rods?: readonly string[];
  kind: EncounterKind;
  unchanged: boolean;
  caughtState: (pokedexId: number) => CaughtState;
  /** Dex id caught on this route, if any — greens family members on this route. */
  routeSlotPokedexId: number | null;
  slug: string;
  onNavigate: () => void;
}) {
  const state = caughtState(pokedexId);
  const caughtHere =
    routeSlotPokedexId != null &&
    (routeSlotPokedexId === pokedexId ||
      evolutionFamily(routeSlotPokedexId).includes(pokedexId));
  const owned = state != null;
  const tone = caughtHere
    ? "border-accent/50 bg-accent/15"
    : owned
      ? "border-frame/50 bg-surface opacity-45"
      : "border-frame/70 bg-surface";
  const method =
    kind === "fishing" && rods?.length
      ? rods.map((r) => ROD_SHORT[r] ?? ROD_LABELS[r] ?? r).join("/")
      : KIND_LABELS[kind];
  const levelLabel =
    maxLevel !== minLevel ? `Lv${minLevel}–${maxLevel}` : `Lv${minLevel}`;
  const name = speciesName(pokedexId);

  return (
    <li className="w-[5.75rem]">
      <PokemonHoverPreview
        className="h-full w-full"
        speciesPreview={speciesHoverPreview(pokedexId)}
      >
        <Link
          href={toolsHref(slug, "pokedex", { id: pokedexId })}
          onClick={onNavigate}
          aria-label={`Open ${name} in Pokédex`}
          title={
            unchanged
              ? `${name} (not randomized)`
              : `${speciesName(vanillaPokedexId)} → ${name}`
          }
          className={`pressable flex w-full flex-col items-center rounded-lg border px-1 py-1.5 text-center hover:border-interactive/50 ${tone}`}
        >
          <span className="relative">
            <Sprite pokedexId={pokedexId} size={64} />
            <CompTierStamp
              pokedexId={pokedexId}
              className="absolute -right-1 -top-0.5"
            />
          </span>
          <p
            className={`mt-0.5 w-full truncate text-xs font-semibold leading-tight tracking-tight ${
              caughtHere ? "text-accent-deep" : owned ? "text-muted" : "text-ink"
            }`}
          >
            {name}
          </p>
          <p
            className={`mt-0.5 text-sm font-bold tabular-nums leading-none ${
              caughtHere
                ? "text-accent-deep"
                : owned
                  ? "text-muted"
                  : chanceTone(chance)
            }`}
          >
            {formatChance(chance)}
          </p>
          <p className="mt-0.5 w-full truncate text-[0.65rem] leading-tight text-muted">
            {levelLabel}
          </p>
          <p className="w-full truncate text-[0.65rem] leading-tight text-muted">
            {method}
          </p>
          {caughtHere ? (
            <span className="mt-0.5 text-[0.65rem] font-semibold leading-none text-accent-deep">
              {state === "caught" ? "Caught here" : "Line here"}
            </span>
          ) : state ? (
            <span className="mt-0.5 text-[0.65rem] font-semibold leading-none text-muted">
              {state === "caught" ? "Caught" : "Line"}
            </span>
          ) : null}
        </Link>
      </PokemonHoverPreview>
    </li>
  );
}

function RouteView({
  areas,
  totalTables,
  caughtState,
  isRouteUsed,
  slotPokemon,
  slug,
  onNavigate,
}: {
  areas: RolledArea[];
  totalTables: number;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
  slotPokemon: (label: string) => number | null;
  slug: string;
  onNavigate: () => void;
}) {
  const resolveSlot =
    typeof slotPokemon === "function" ? slotPokemon : NO_SLOT_POKEMON;
  const groups = useMemo(
    () => groupAreasByRoute(areas, isRouteUsed, resolveSlot),
    [areas, isRouteUsed, resolveSlot],
  );
  const usedCount = groups.filter((g) => g.used).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {groups.length} route{groups.length === 1 ? "" : "s"}
        {areas.length !== totalTables
          ? ` matching filter (${totalTables} wild tables in seed)`
          : ` · ${totalTables} wild tables`}
        {usedCount > 0
          ? ` · ${usedCount} slot${usedCount === 1 ? "" : "s"} spent`
          : ""}
        . Collapsed by default — expand to scan the pool.
      </p>
      <ul className="space-y-1.5">
        {groups.map((group) => (
          <li key={group.label}>
            <details
              className={`group/route overflow-hidden rounded-lg border ${
                group.used
                  ? "border-accent/50 bg-accent/10"
                  : "border-frame bg-surface-2"
              }`}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] transition group-open/route:rotate-90 ${
                    group.used
                      ? "border-accent/50 text-accent-deep"
                      : "border-frame text-muted"
                  }`}
                  aria-hidden
                >
                  ▸
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-semibold tracking-tight ${
                      group.used ? "text-accent-deep" : "text-ink"
                    }`}
                  >
                    {group.label}
                  </span>
                  <span className="block text-[0.65rem] text-muted">
                    {group.areas
                      .map((area) => KIND_LABELS[area.kind])
                      .join(" · ")}{" "}
                    ·{" "}
                    {group.areas.reduce((n, a) => n + a.slots.length, 0)}{" "}
                    possible
                    {group.used
                      ? group.slotPokedexId
                        ? " · slot spent"
                        : " · slot spent · no catch logged"
                      : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {group.slotPokedexId ? (
                    <PokemonHoverPreview
                      speciesPreview={speciesHoverPreview(group.slotPokedexId)}
                    >
                      <Link
                        href={toolsHref(slug, "pokedex", {
                          id: group.slotPokedexId,
                        })}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate();
                        }}
                        aria-label={`Open ${speciesName(group.slotPokedexId)} in Pokédex`}
                        className="relative block rounded border border-accent/30 bg-surface p-0.5 hover:border-interactive/50"
                        title={`Caught: ${speciesName(group.slotPokedexId)}`}
                      >
                        <Sprite pokedexId={group.slotPokedexId} size={28} />
                        <CompTierStamp
                          pokedexId={group.slotPokedexId}
                          className="absolute -right-1 -top-1"
                        />
                      </Link>
                    </PokemonHoverPreview>
                  ) : group.used ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded border border-dashed border-accent/40 bg-surface text-[0.65rem] font-semibold text-muted"
                      title="Encounter slot spent, but no Pokémon in this save has this met location (fled, failed catch, or released)"
                    >
                      —
                    </span>
                  ) : null}
                  {group.used ? (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[var(--on-accent)]"
                      title={
                        group.slotPokedexId
                          ? "Encounter slot already used"
                          : "Encounter slot spent with no catch on file"
                      }
                    >
                      <CheckIcon />
                    </span>
                  ) : null}
                </span>
              </summary>
              <div className="space-y-2.5 border-t border-frame/50 px-2.5 py-2">
                {group.areas.map((area) => (
                  <div key={`${area.mapsec}-${area.kind}`}>
                    <p className="mb-1 text-[0.65rem] font-semibold tracking-wide text-muted">
                      {KIND_LABELS[area.kind]}
                    </p>
                    <ul className={SLOT_GRID}>
                      {area.slots.map((slot, i) => (
                        <RouteSlotTile
                          key={`${slot.vanillaSpecies}-${i}`}
                          pokedexId={slot.pokedexId}
                          vanillaPokedexId={slot.vanillaPokedexId}
                          chance={slot.chance}
                          minLevel={slot.minLevel}
                          maxLevel={slot.maxLevel}
                          rods={slot.rods}
                          kind={area.kind}
                          unchanged={slot.unchanged}
                          caughtState={caughtState}
                          routeSlotPokedexId={group.slotPokedexId}
                          slug={slug}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {groups.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}

function StaticRow({
  vanillaPokedexId,
  pokedexId,
  label,
  kindLabel,
  level,
  showVanilla,
  caughtState,
  slug,
  onNavigate,
}: {
  vanillaPokedexId: number;
  pokedexId: number;
  label: string;
  kindLabel: string;
  level: number;
  /** When false (event legendaries), skip the struck-through vanilla name. */
  showVanilla: boolean;
  caughtState: (pokedexId: number) => CaughtState;
  slug: string;
  onNavigate: () => void;
}) {
  const name = speciesName(pokedexId);
  const state = caughtState(pokedexId);
  return (
    <PokemonHoverPreview
      className="block"
      speciesPreview={speciesHoverPreview(pokedexId)}
    >
      <Link
        href={toolsHref(slug, "pokedex", { id: pokedexId })}
        onClick={onNavigate}
        aria-label={`Open ${name} in Pokédex`}
        className="pressable flex items-center gap-3 px-2.5 py-2 hover:bg-interactive-soft/35"
      >
        <span className="relative shrink-0">
          <Sprite pokedexId={pokedexId} size={44} />
          <CompTierStamp
            pokedexId={pokedexId}
            className="absolute -right-1 -top-0.5"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate text-sm font-semibold tracking-tight text-ink">
              {name}
            </span>
            <CaughtPill state={state} />
            <span className="text-[0.7rem] tabular-nums text-muted">
              Lv{level}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[0.7rem] leading-snug text-muted">
            {showVanilla ? (
              <>
                <span className="line-through">
                  {speciesName(vanillaPokedexId)}
                </span>
                {" · "}
              </>
            ) : null}
            {label} · {kindLabel}
          </span>
        </span>
      </Link>
    </PokemonHoverPreview>
  );
}

function StaticView({
  statics,
  total,
  randomized,
  caughtState,
  slug,
  onNavigate,
}: {
  statics: RolledStatic[];
  total: number;
  randomized: boolean;
  caughtState: (pokedexId: number) => CaughtState;
  slug: string;
  onNavigate: () => void;
}) {
  const rerolled = statics.filter((entry) => entry.randomized);
  const fixed = statics.filter((entry) => !entry.randomized);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {statics.length} of {total} scripted encounters.{" "}
        {randomized
          ? "Static battles and gifts reroll; event legendaries do not."
          : "Static randomization is off — everything below is vanilla."}
      </p>

      {rerolled.length > 0 ? (
        <ul className="divide-y divide-frame/50 overflow-hidden rounded-lg border border-frame bg-surface-2">
          {rerolled.map((entry, i) => (
            <li key={`${entry.mapsec}-${entry.vanillaSpecies}-${i}`}>
              <StaticRow
                vanillaPokedexId={entry.vanillaPokedexId}
                pokedexId={entry.pokedexId}
                label={entry.label}
                kindLabel={STATIC_KIND_LABELS[entry.kind]}
                level={entry.level}
                showVanilla
                caughtState={caughtState}
                slug={slug}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {fixed.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-frame bg-surface-2">
          <div className="border-b border-frame/50 px-2.5 py-2">
            <p className="text-xs font-semibold tracking-wide text-muted">
              Never rerolled — {fixed.length} event encounter
              {fixed.length === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">
              These use <code className="text-ink">seteventmon</code>, which
              reaches <code className="text-ink">CreateMon</code> without ever
              calling the randomizer. The Regis, Rayquaza, and the rest of the
              braille-puzzle legendaries are exactly who the ROM says, even with
              static randomization on.
            </p>
          </div>
          <ul className="divide-y divide-frame/50">
            {fixed.map((entry, i) => (
              <li key={`${entry.mapsec}-${entry.vanillaSpecies}-${i}`}>
                <StaticRow
                  vanillaPokedexId={entry.vanillaPokedexId}
                  pokedexId={entry.pokedexId}
                  label={entry.label}
                  kindLabel={STATIC_KIND_LABELS[entry.kind]}
                  level={entry.level}
                  showVanilla={false}
                  caughtState={caughtState}
                  slug={slug}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {statics.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}
