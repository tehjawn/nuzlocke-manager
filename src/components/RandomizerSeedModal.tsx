"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { HatchSafeSpotsNote } from "@/components/HatchSafeSpotsNote";
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
import {
  bucketHint,
  bucketLabel,
  computeObtainabilityBuckets,
  type ObtainabilityBucket,
  type ObtainabilityBuckets,
} from "@/lib/seed-obtainability";

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

/** Emulator states run a few MB; anything past this is a mis-picked file. */
const MAX_SAVE_BYTES = 32 * 1024 * 1024;

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
  obtainability: ObtainabilityBuckets;
  check: SeedCheck;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
  /** Present after a fresh parse; optional so HMR of an open modal stays safe. */
  slotPokemon?: (label: string) => number | null;
  encounterFlagsReliable: boolean;
};

const OBTAINABILITY_CHIPS: Array<{
  id: ObtainabilityBucket;
  tone: string;
}> = [
  {
    id: "unobtainable",
    tone: "border-danger/40 bg-danger/10 text-danger",
  },
  {
    id: "tradeEvo",
    tone: "border-accent/40 bg-accent/10 text-accent-deep",
  },
  {
    id: "evolutionOnly",
    tone: "border-frame bg-surface text-ink",
  },
  {
    id: "singleSlot",
    tone: "border-frame bg-surface text-muted",
  },
];

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
  const [obtainFilter, setObtainFilter] = useState<ObtainabilityBucket | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSpecies = useMemo(() => {
    if (!parsed) return [];
    const q = query.trim().toLowerCase();
    return parsed.species.filter((entry) => {
      if (obtainFilter === "singleSlot") {
        if (!parsed.obtainability.singleSlot.includes(entry.pokedexId)) {
          return false;
        }
      } else if (obtainFilter) {
        // Other buckets are species with no wild sources — listed separately.
        return false;
      }
      if (!matchesCompTier(entry.pokedexId, compTiers)) return false;
      if (!q) return true;
      return (
        speciesName(entry.pokedexId).toLowerCase().includes(q) ||
        entry.sources.some((source) => source.label.toLowerCase().includes(q))
      );
    });
  }, [parsed, query, compTiers, obtainFilter]);

  const filteredBucketIds = useMemo(() => {
    if (!parsed || !obtainFilter || obtainFilter === "singleSlot") return [];
    const ids = parsed.obtainability[obtainFilter];
    const q = query.trim().toLowerCase();
    return ids.filter((pokedexId) => {
      if (!matchesCompTier(pokedexId, compTiers)) return false;
      if (!q) return true;
      return speciesName(pokedexId).toLowerCase().includes(q);
    });
  }, [parsed, obtainFilter, query, compTiers]);

  const filteredAreas = useMemo(() => {
    if (!parsed) return [];
    if (obtainFilter && obtainFilter !== "singleSlot") return [];
    const q = query.trim().toLowerCase();
    const singleSlot =
      obtainFilter === "singleSlot"
        ? new Set(parsed.obtainability.singleSlot)
        : null;
    const out: RolledArea[] = [];
    for (const area of parsed.areas) {
      const labelMatch = !q || area.label.toLowerCase().includes(q);
      const slots = area.slots.filter((slot) => {
        if (singleSlot && !singleSlot.has(slot.pokedexId)) return false;
        if (!matchesCompTier(slot.pokedexId, compTiers)) return false;
        if (!q || labelMatch) return true;
        return speciesName(slot.pokedexId).toLowerCase().includes(q);
      });
      if (slots.length === 0) continue;
      out.push(slots.length === area.slots.length ? area : { ...area, slots });
    }
    return out;
  }, [parsed, query, compTiers, obtainFilter]);

  const filteredStatics = useMemo(() => {
    if (!parsed) return [];
    if (obtainFilter) return [];
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
  }, [parsed, query, compTiers, obtainFilter]);

  if (!open) return null;

  function reset() {
    setParsing(false);
    setError(null);
    setParsed(null);
    setView("species");
    setQuery("");
    setCompTiers([]);
    setObtainFilter(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_SAVE_BYTES) {
      setError(
        "That file is too large to be a Gen 3 save or emulator state. Expected under 32 MB.",
      );
      return;
    }
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
      const species = indexBySpecies(areas);
      const statics = playable ? rollStatics(randomizer.otId, randomizer) : [];
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
        species,
        statics,
        obtainability: playable
          ? computeObtainabilityBuckets(areas, statics, species)
          : {
              unobtainable: [],
              tradeEvo: [],
              evolutionOnly: [],
              singleSlot: [],
            },
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
      setObtainFilter(null);
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
  const playable = Boolean(rz?.reliable && !rz?.chaos);
  const hasSecondaryFilters = obtainFilter != null || compTiers.length > 0;
  const filterSummary = [
    obtainFilter ? `Scarcity: ${bucketLabel(obtainFilter)}` : null,
    compTiers.length > 0
      ? `Comp: ${compTiers.map((t) => (t === "untiered" ? "–" : t)).join(",")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const seedHex = rz
    ? rz.otId.toString(16).toUpperCase().padStart(8, "0")
    : "";
  const settingsChips = rz ? describeSettings(rz) : [];

  function clearSecondaryFilters() {
    setObtainFilter(null);
    setCompTiers([]);
  }

  const accept =
    ".state,.sav,.srm,.ss0,.ss1,.ss2,.ss3,.ss4,.ss5,.ss6,.ss7,.ss8,.ss9,.s0,.s1,.s2,.s3,.s4,.s5,.s6,.s7,.s8,.s9,.sr0,.sr1,.sr2,.sr3,.sr4,.sr5,.sr6,.sr7,.sr8,.sr9,application/octet-stream";

  return (
    <Modal
      open={open}
      title="Randomizer seed parser"
      size="fullscreen"
      containScroll
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
      <div className="flex min-h-0 flex-1 flex-col text-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          disabled={parsing}
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0] ?? null);
            // Allow re-picking the same file after a failed parse.
            e.target.value = "";
          }}
        />

        {!parsed ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
            <p className="text-muted">
              Drop a Gen 3 save to replay this run’s randomizer encounter map —
              where each Pokémon lives, what each route holds, and what
              scripted encounters rolled.
            </p>

            <details className="group rounded-lg border border-frame/50 bg-surface-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-tight text-muted [&::-webkit-details-marker]:hidden">
                How this works
                <span
                  aria-hidden
                  className="text-[0.65rem] transition group-open:rotate-90"
                >
                  ▸
                </span>
              </summary>
              <p className="border-t border-frame/40 px-3 py-2 text-xs leading-relaxed text-muted">
                Modern Emerald doesn’t rewrite encounter tables — it rerolls
                each species as it spawns, seeded by the player’s trainer ID.
                This tool replays that mapping offline. Species they already
                own and route slots they have already spent are marked.
                Afterplay’s <code className="text-ink">.sav</code> /{" "}
                <code className="text-ink">.srm</code> export is the most
                reliable source; emulator states work too.
              </p>
            </details>

            <button
              type="button"
              disabled={parsing}
              className="pressable flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-frame bg-surface-2 px-4 py-10 text-center disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-sm font-semibold tracking-tight text-ink">
                {parsing ? "Reading save…" : "Choose a save file"}
              </span>
              <span className="text-xs text-muted">
                .sav / .srm preferred · emulator states accepted
              </span>
            </button>

            {error ? (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-danger">
                {error}
              </p>
            ) : null}
          </div>
        ) : rz ? (
          <>
            <div className="shrink-0 space-y-2 border-b border-frame/60 bg-surface-2/90 px-4 py-2.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="min-w-0 font-mono text-sm font-semibold tracking-tight text-ink">
                  Seed {seedHex}
                </p>
                <p className="min-w-0 truncate text-xs text-muted">
                  {parsed.trainerName ? `${parsed.trainerName} · ` : ""}
                  {parsed.format}
                </p>
                <details className="group relative">
                  <summary className="cursor-pointer list-none text-[0.65rem] font-semibold text-muted underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden group-open:text-ink">
                    Settings
                  </summary>
                  <div className="absolute left-0 top-full z-20 mt-1 flex max-w-[min(100vw-2rem,24rem)] flex-col gap-0.5 rounded-lg border border-frame bg-surface p-1.5 shadow-lg">
                    {settingsChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded px-2 py-1 text-xs text-muted"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </details>

                <button
                  type="button"
                  disabled={parsing}
                  className="pressable ml-auto shrink-0 rounded-md border border-frame bg-surface px-2.5 py-1 text-[0.7rem] font-semibold tracking-tight text-muted hover:text-ink disabled:opacity-60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {parsing ? "Reading…" : "Replace save…"}
                </button>
              </div>

              {error ? (
                <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              ) : null}

              {!rz.reliable ? (
                <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  Couldn’t read the trainer ID or the randomizer settings from
                  this save. Ask for an Afterplay{" "}
                  <code className="text-ink">.sav</code> /{" "}
                  <code className="text-ink">.srm</code> export instead of an
                  emulator state.
                </p>
              ) : rz.chaos ? (
                <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  Chaos mode is on. The ROM rerolls from live RNG on every
                  encounter rather than from the seed, so no mapping can be
                  predicted for this run — not by this tool and not by anything
                  else.
                </p>
              ) : (
                <>
                  {check && check.checked > 0 ? (
                    <details
                      className={`group rounded-lg border px-3 py-1.5 text-xs ${
                        lowConfidence
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : "border-frame/60 bg-surface text-muted"
                      }`}
                    >
                      <summary className="flex cursor-pointer list-none items-baseline gap-x-2 [&::-webkit-details-marker]:hidden">
                        <span>
                          <strong className="font-semibold">
                            {check.matched}/{check.checked}
                          </strong>{" "}
                          catches match
                          {lowConfidence ? " — too low to trust" : ""}
                        </span>
                        <span className="ml-auto shrink-0 text-[0.65rem] font-semibold underline-offset-2 hover:underline">
                          <span className="group-open:hidden">Details</span>
                          <span className="hidden group-open:inline">Less</span>
                        </span>
                      </summary>
                      <p className="mt-1.5 border-t border-current/15 pt-1.5 leading-relaxed">
                        {check.matched}/{check.checked} of this trainer’s own
                        catches land on the species this seed predicts for those
                        routes
                        {check.skipped > 0
                          ? ` (${check.skipped} skipped — gifts, fossils, and trades have no wild table)`
                          : ""}
                        .{" "}
                        {lowConfidence
                          ? "That is too low to trust: the tables here are pinned to one Modern Emerald build, and this save looks like a different one. Treat everything below as unverified."
                          : "Evolved catches count when the seed rolls a relative — high-level slots spawn already-evolved."}
                      </p>
                    </details>
                  ) : null}

                  {!parsed.encounterFlagsReliable ? (
                    <p className="rounded-lg border border-frame bg-surface px-3 py-1.5 text-xs text-muted">
                      Couldn’t read this run’s encounter flags, so spent route
                      slots aren’t marked below. Caught species still are.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1 rounded-lg border border-frame bg-surface p-1">
                      {VIEW_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          aria-pressed={view === tab.id}
                          disabled={
                            obtainFilter != null &&
                            obtainFilter !== "singleSlot" &&
                            tab.id !== "species"
                          }
                          className={`pressable rounded-md px-2.5 py-1 text-xs font-semibold tracking-tight ${
                            view === tab.id
                              ? "bg-accent text-[var(--on-accent)]"
                              : "text-muted"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                          onClick={() => {
                            setView(tab.id);
                            if (tab.id === "statics") setObtainFilter(null);
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="search"
                      value={query}
                      placeholder="Search…"
                      aria-label="Filter by Pokémon or route"
                      className="min-w-[8rem] flex-1 rounded-lg border border-frame bg-surface px-2.5 py-1.5 text-sm"
                      onChange={(e) => setQuery(e.target.value)}
                    />

                    {hasSecondaryFilters ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 text-[0.7rem] font-semibold text-accent-deep">
                        <span className="truncate rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5">
                          {filterSummary}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 underline underline-offset-2 hover:text-ink"
                          onClick={clearSecondaryFilters}
                        >
                          Clear
                        </button>
                      </span>
                    ) : null}

                    <details className="group relative">
                      <summary
                        className={`pressable cursor-pointer list-none rounded-lg border px-2.5 py-1.5 text-xs font-semibold tracking-tight [&::-webkit-details-marker]:hidden ${
                          hasSecondaryFilters
                            ? "border-accent/40 bg-accent/10 text-accent-deep"
                            : "border-frame bg-surface text-muted hover:text-ink"
                        }`}
                      >
                        Filters ▾
                      </summary>
                      <div className="absolute right-0 top-full z-30 mt-1 w-[min(100vw-2rem,20rem)] space-y-3 rounded-lg border border-frame bg-surface p-3 shadow-lg">
                        <div className="space-y-1.5">
                          <p className="text-[0.65rem] font-semibold tracking-wide text-muted">
                            Scarcity
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {OBTAINABILITY_CHIPS.map((chip) => {
                              const count =
                                parsed.obtainability[chip.id].length;
                              const active = obtainFilter === chip.id;
                              return (
                                <button
                                  key={chip.id}
                                  type="button"
                                  aria-pressed={active}
                                  title={bucketHint(chip.id)}
                                  className={`pressable rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight ${
                                    active
                                      ? chip.tone
                                      : "border-frame/50 bg-surface-2 text-muted opacity-70 hover:opacity-100"
                                  }`}
                                  onClick={() => {
                                    setObtainFilter((prev) =>
                                      prev === chip.id ? null : chip.id,
                                    );
                                    setView("species");
                                  }}
                                >
                                  {bucketLabel(chip.id)} ({count})
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[0.65rem] font-semibold tracking-wide text-muted">
                            Comp
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
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
                                      : "border-frame/50 bg-surface-2 text-muted opacity-55 hover:opacity-90"
                                  }`}
                                  onClick={() =>
                                    setCompTiers((prev) =>
                                      toggleCompTier(prev, tier.id),
                                    )
                                  }
                                >
                                  {tier.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {hasSecondaryFilters ? (
                          <button
                            type="button"
                            className="text-[0.7rem] font-semibold text-muted underline underline-offset-2 hover:text-ink"
                            onClick={clearSecondaryFilters}
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </>
              )}
            </div>

            {playable ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
                {obtainFilter ? (
                  <p className="rounded-lg border border-frame/50 bg-surface-2 px-3 py-1.5 text-[0.7rem] leading-snug text-muted">
                    {bucketHint(obtainFilter)}
                  </p>
                ) : null}

                {/* Hatch geography is independent of wild remaps — show on By route
                    even when wild randomization is off (vanilla tables). */}
                {view === "route" &&
                (!obtainFilter || obtainFilter === "singleSlot") ? (
                  <HatchSafeSpotsNote randomizerContext />
                ) : null}

                {obtainFilter && obtainFilter !== "singleSlot" ? (
                  <BucketSpeciesView
                    bucket={obtainFilter}
                    ids={filteredBucketIds}
                    total={parsed.obtainability[obtainFilter].length}
                    caughtState={parsed.caughtState}
                    slug={slug}
                    onNavigate={onClose}
                  />
                ) : (view === "species" || view === "route") &&
                  !rz.wildPokemon &&
                  obtainFilter !== "singleSlot" ? (
                  <p className="rounded-lg border border-frame bg-surface-2 px-3 py-2 text-muted">
                    Wild Pokémon randomization is off in this save — encounters
                    are vanilla Emerald tables. Nothing to remap.
                  </p>
                ) : view === "species" ? (
                  <SpeciesView
                    entries={filteredSpecies}
                    total={
                      obtainFilter === "singleSlot"
                        ? parsed.obtainability.singleSlot.length
                        : parsed.species.length
                    }
                    caughtState={parsed.caughtState}
                    isRouteUsed={parsed.isRouteUsed}
                    slug={slug}
                    onNavigate={onClose}
                    listNote={
                      obtainFilter === "singleSlot"
                        ? "Single-slot species in this seed"
                        : null
                    }
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
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function CannotCatchPill() {
  return (
    <span
      className="ml-1.5 shrink-0 rounded-full border border-danger/40 bg-danger/10 px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold text-danger"
      title="This fight sets FLAG_SYS_NO_CATCHING — it cannot be caught"
    >
      Cannot catch
    </span>
  );
}

function BucketSpeciesView({
  bucket,
  ids,
  total,
  caughtState,
  slug,
  onNavigate,
}: {
  bucket: ObtainabilityBucket;
  ids: number[];
  total: number;
  caughtState: (pokedexId: number) => CaughtState;
  slug: string;
  onNavigate: () => void;
}) {
  const shown = ids.slice(0, SPECIES_PAGE);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {ids.length} of {total} {bucketLabel(bucket).toLowerCase()} species
        {shown.length < ids.length
          ? ` — showing the first ${shown.length}, keep typing to narrow it down`
          : ""}
        .
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-1.5">
        {shown.map((pokedexId) => (
          <li key={pokedexId}>
            <PokemonHoverPreview
              className="block"
              speciesPreview={speciesHoverPreview(pokedexId)}
            >
              <Link
                href={toolsHref(slug, "pokedex", { id: pokedexId })}
                onClick={onNavigate}
                aria-label={`Open ${speciesName(pokedexId)} in Pokédex`}
                className={`pressable flex items-center gap-2 rounded-lg border p-2 ${
                  bucket === "unobtainable"
                    ? "border-danger/30 bg-danger/5 opacity-80"
                    : bucket === "tradeEvo"
                      ? "border-accent/30 bg-accent/5"
                      : "border-frame bg-surface-2"
                } hover:border-interactive/40`}
              >
                <span className="relative shrink-0">
                  <Sprite pokedexId={pokedexId} size={36} />
                  <CompTierStamp
                    pokedexId={pokedexId}
                    className="absolute -right-1 -top-1"
                  />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-1">
                    <span className="truncate text-xs font-semibold tracking-tight text-ink">
                      {speciesName(pokedexId)}
                    </span>
                    <CaughtPill state={caughtState(pokedexId)} />
                  </span>
                </span>
              </Link>
            </PokemonHoverPreview>
          </li>
        ))}
      </ul>
      {ids.length === 0 ? (
        <p className="text-muted">Nothing matches that filter.</p>
      ) : null}
    </div>
  );
}

function SpeciesView({
  entries,
  total,
  caughtState,
  isRouteUsed,
  slug,
  onNavigate,
  listNote = null,
}: {
  entries: SpeciesSighting[];
  total: number;
  caughtState: (pokedexId: number) => CaughtState;
  isRouteUsed: (label: string) => boolean;
  slug: string;
  onNavigate: () => void;
  /** Overrides the default “catchable somewhere” blurb (e.g. single-slot). */
  listNote?: string | null;
}) {
  const shown = entries.slice(0, SPECIES_PAGE);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {listNote
          ? `${entries.length} of ${total} — ${listNote}`
          : `${entries.length} of ${total} species are catchable somewhere in this seed`}
        {shown.length < entries.length
          ? ` — showing the first ${shown.length}, keep typing to narrow it down`
          : ""}
        {listNote ? "." : ". Best route first."}
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
  const [openLabels, setOpenLabels] = useState<Set<string>>(() => new Set());

  function setRouteOpen(label: string, open: boolean) {
    setOpenLabels((prev) => {
      const has = prev.has(label);
      if (open === has) return prev;
      const next = new Set(prev);
      if (open) next.add(label);
      else next.delete(label);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-muted">
          {groups.length} route{groups.length === 1 ? "" : "s"}
          {areas.length !== totalTables
            ? ` matching filter (${totalTables} wild tables in seed)`
            : ` · ${totalTables} wild tables`}
          {usedCount > 0
            ? ` · ${usedCount} slot${usedCount === 1 ? "" : "s"} spent`
            : ""}
          .
        </p>
        {groups.length > 0 ? (
          <p className="shrink-0 text-[0.7rem] font-semibold text-muted">
            <button
              type="button"
              className="underline underline-offset-2 hover:text-ink"
              onClick={() =>
                setOpenLabels(new Set(groups.map((group) => group.label)))
              }
            >
              Expand all
            </button>
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            <button
              type="button"
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => setOpenLabels(new Set())}
            >
              Collapse all
            </button>
          </p>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {groups.map((group) => (
          <li key={group.label}>
            <details
              open={openLabels.has(group.label)}
              onToggle={(event) => {
                setRouteOpen(group.label, event.currentTarget.open);
              }}
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
                      <span
                        className="relative block rounded border border-accent/30 bg-surface p-0.5"
                        title={`Caught: ${speciesName(group.slotPokedexId)}`}
                      >
                        <Sprite pokedexId={group.slotPokedexId} size={28} />
                        <CompTierStamp
                          pokedexId={group.slotPokedexId}
                          className="absolute -right-1 -top-1"
                        />
                      </span>
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
                {group.slotPokedexId ? (
                  <p className="text-[0.7rem] text-muted">
                    Caught{" "}
                    <Link
                      href={toolsHref(slug, "pokedex", {
                        id: group.slotPokedexId,
                      })}
                      onClick={onNavigate}
                      className="font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {speciesName(group.slotPokedexId)}
                    </Link>
                  </p>
                ) : null}
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
  noCatching,
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
  noCatching: boolean;
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
        className={`pressable flex items-center gap-3 px-2.5 py-2 hover:bg-interactive-soft/35 ${
          noCatching ? "opacity-60" : ""
        }`}
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
            <span
              className={`truncate text-sm font-semibold tracking-tight ${
                noCatching ? "text-muted" : "text-ink"
              }`}
            >
              {name}
            </span>
            {noCatching ? <CannotCatchPill /> : <CaughtPill state={state} />}
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
  const uncatchableCount = statics.filter((entry) => entry.noCatching).length;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {statics.length} of {total} scripted encounters
        {uncatchableCount > 0
          ? ` · ${uncatchableCount} cannot be caught (FLAG_SYS_NO_CATCHING)`
          : ""}
        .{" "}
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
                noCatching={entry.noCatching}
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
                  noCatching={entry.noCatching}
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
