import { heldItemDescription } from "@/data/pokemon-index";
import type { BadgeDefinition, PokemonEntry } from "@/lib/challenge-types";
import { formatMoveMetaTip, lookupMoveMeta } from "@/lib/move-meta";
import { recommendPlaystyle } from "@/lib/playstyle";
import { evolutionViewFor } from "@/lib/species-evolutions";
import {
  STAT_KEYS,
  STAT_LABELS,
  formatSpreadShort,
  isEmptySpread,
  type StatSpread,
} from "@/lib/stats";

export type TeamExportFormat = "llm" | "showdown";

/**
 * Everything the formatters need from a roster — deliberately narrower than
 * `TrainerProfile` so a historical board snapshot can be exported too.
 */
export type TeamExportTrainer = {
  id: string;
  handle: string;
  /** Run this roster belongs to: the live run, or the snapshot's run. */
  runNumber: number;
  wipeCount: number;
  earnedBadgeKeys: string[];
  pokemon: PokemonEntry[];
};

/** Provenance for a past board export (Trainer history → snapshot). */
export type TeamExportSnapshotMeta = {
  /** Snapshot label or trigger, e.g. "Wipe #2" / "Pre-import". */
  label: string;
  /** Already-localised capture time — the lib never formats dates. */
  capturedAt: string;
};

export type TeamExportOpts = {
  challengeName: string;
  challengeGame: string;
  challengeSlug: string;
  /** Absolute trainer board URL (not `/me`). */
  boardUrl: string;
  /** Absolute type-chart tools URL. */
  typeChartUrl: string;
  /** Absolute guide tools URL. */
  guideUrl: string;
  /**
   * When false, omit nature / ability / moves / IVs / EVs / playstyle
   * (same gate as the board UI). Defaults to true.
   */
  showCompetitiveDetails?: boolean;
  badges: BadgeDefinition[];
  /**
   * Set when exporting a board snapshot instead of the live board, so the
   * paste says so up front rather than reading as the current roster.
   */
  snapshot?: TeamExportSnapshotMeta | null;
};

function livingInSlot(
  pokemon: PokemonEntry[],
  slot: "MAIN" | "RESERVE",
): PokemonEntry[] {
  return pokemon
    .filter((p) => p.slot === slot)
    .sort((a, b) => a.partyIndex - b.partyIndex);
}

function displayMonName(p: PokemonEntry): string {
  const nick = p.nickname?.trim();
  const species = p.species.trim() || "Unknown";
  const shiny = p.isShiny ? " ✨" : "";
  if (nick && nick.toLowerCase() !== species.toLowerCase()) {
    return `${nick} (${species})${shiny}`;
  }
  return `${species}${shiny}`;
}

function typesLine(p: PokemonEntry): string {
  return p.types.length > 0 ? p.types.join(" / ") : "Unknown type";
}

function heldItemLine(p: PokemonEntry): string | null {
  const item = p.heldItem?.trim();
  if (!item) return null;
  const desc = heldItemDescription(item);
  return desc ? `Item: ${item} (${desc})` : `Item: ${item}`;
}

function evoOneLiner(p: PokemonEntry): string | null {
  if (p.pokedexId == null || p.pokedexId <= 0) return null;
  const view = evolutionViewFor(p.pokedexId, {
    level: p.level,
    heldItem: p.heldItem,
    moves: p.moves,
  });
  if (!view) return null;
  if (view.isFinal) return "Evo: final stage";
  const next = view.options[0];
  if (!next) return null;
  const ready =
    next.readiness.status === "ready"
      ? "ready"
      : next.readiness.detail ?? next.summary;
  return `Evo: → ${next.intoName} (${ready})`;
}

function playstyleOneLiner(
  p: PokemonEntry,
  showCompetitive: boolean,
): string | null {
  if (!showCompetitive) return null;
  const hint = recommendPlaystyle({
    pokedexId: p.pokedexId,
    nature: p.nature,
    ability: p.ability,
    ivs: p.ivs,
  });
  if (!hint) return null;
  const tags = [hint.primary, hint.secondary].filter(Boolean).join(" / ");
  return `Playstyle: ${tags}`;
}

function formatMove(name: string): string {
  const meta = lookupMoveMeta(name);
  if (!meta) return name;
  return `${name} (${formatMoveMetaTip(meta)})`;
}

function formatMonBlock(
  p: PokemonEntry,
  index: number,
  showCompetitive: boolean,
): string {
  const level = p.level != null ? `Lv ${p.level}` : "Lv ?";
  const headerParts = [
    `${index}. ${displayMonName(p)}`,
    level,
    typesLine(p),
  ];
  const item = heldItemLine(p);
  if (item) headerParts.push(item);

  const lines: string[] = [headerParts.join(" · ")];

  if (showCompetitive) {
    const battle: string[] = [];
    if (p.nature?.trim()) battle.push(`Nature: ${p.nature.trim()}`);
    if (p.ability?.trim()) battle.push(`Ability: ${p.ability.trim()}`);
    if (battle.length) lines.push(`   ${battle.join(" · ")}`);

    const moves = p.moves.map((m) => m.trim()).filter(Boolean);
    if (moves.length) {
      lines.push(`   Moves: ${moves.map(formatMove).join(", ")}`);
    }

    const ivs = formatSpreadShort(p.ivs);
    const evs = formatSpreadShort(p.evs);
    if (ivs || evs) {
      const parts: string[] = [];
      if (ivs) parts.push(`IVs: ${ivs}`);
      if (evs) parts.push(`EVs: ${evs}`);
      lines.push(`   ${parts.join(" · ")}`);
    }
  }

  const meta: string[] = [];
  if (p.catchRoute?.trim()) meta.push(`Caught: ${p.catchRoute.trim()}`);
  const playstyle = playstyleOneLiner(p, showCompetitive);
  if (playstyle) meta.push(playstyle);
  const evo = evoOneLiner(p);
  if (evo) meta.push(evo);
  if (meta.length) lines.push(`   ${meta.join(" · ")}`);

  return lines.join("\n");
}

function formatSection(
  title: string,
  mons: PokemonEntry[],
  showCompetitive: boolean,
): string {
  if (mons.length === 0) {
    return `## ${title}\n(none)`;
  }
  const blocks = mons.map((p, i) =>
    formatMonBlock(p, i + 1, showCompetitive),
  );
  return `## ${title}\n${blocks.join("\n\n")}`;
}

/** Absolute path helpers for board / tools links (caller prefixes origin). */
export function trainerBoardPath(slug: string, trainerId: string): string {
  return `/challenges/${slug}/trainers/${trainerId}`;
}

export function toolsChartPath(slug: string): string {
  return `/challenges/${slug}/tools?tool=chart`;
}

export function toolsGuidePath(slug: string): string {
  return `/challenges/${slug}/tools?tool=guide`;
}

/**
 * Format a living MAIN + RESERVE roster as an LLM-friendly paste.
 * Respects `showCompetitiveDetails` — never invent a second privacy path.
 */
export function formatTrainerTeamExport(
  trainer: TeamExportTrainer,
  opts: TeamExportOpts,
): string {
  const showCompetitive = opts.showCompetitiveDetails !== false;
  const main = livingInSlot(trainer.pokemon, "MAIN");
  const reserve = livingInSlot(trainer.pokemon, "RESERVE");

  const badgeLabels = opts.badges
    .filter((b) => trainer.earnedBadgeKeys.includes(b.key))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => b.label);
  const badgesLine =
    badgeLabels.length > 0 ? badgeLabels.join(", ") : "none";

  const wipeNote =
    trainer.wipeCount > 0 ? ` · Wipes: ${trainer.wipeCount}` : "";

  const headerLines = [
    `# ${opts.challengeGame} Nuzlocke — ${opts.challengeName}`,
    `Trainer: ${trainer.handle} · Run ${trainer.runNumber}${wipeNote} · Badges: ${badgesLine}`,
  ];
  if (opts.snapshot) {
    headerLines.push(
      `Past board: ${opts.snapshot.label} · captured ${opts.snapshot.capturedAt} — a historical snapshot, not the live roster.`,
    );
  }
  headerLines.push(
    `Board: ${opts.boardUrl}`,
    "",
    `You are advising a Nuzlocke player on Pokémon ${opts.challengeGame} (modern 18-type chart).`,
    "Suggest a Main Squad of up to 6 from MAIN + RESERVE below. Call out coverage gaps,",
    "who to promote from box, and prep for the next gym. Prefer survival over optimal DPS.",
    "",
    "In-app references (do not invent data — open these if needed):",
    `- Type chart: ${opts.typeChartUrl}`,
    `- Guide: ${opts.guideUrl}`,
  );
  const header = headerLines.join("\n");

  return [
    header,
    "",
    formatSection("Main Squad", main, showCompetitive),
    "",
    formatSection("Reserves", reserve, showCompetitive),
    "",
    `Board: ${opts.boardUrl}`,
  ].join("\n");
}

/** Showdown set title: `Nick (Species) @ Item` / `Species @ Item` / bare species. */
function showdownTitleLine(p: PokemonEntry): string {
  const species = p.species.trim() || "Unknown";
  const nick = p.nickname?.trim();
  const item = p.heldItem?.trim();
  const hasNick = Boolean(nick && nick.toLowerCase() !== species.toLowerCase());
  const name = hasNick ? `${nick} (${species})` : species;
  return item ? `${name} @ ${item}` : name;
}

/** Showdown EV/IV line: non-zero EVs, non-31 IVs only (Showdown defaults). */
function formatShowdownSpreadLine(
  kind: "EVs" | "IVs",
  spread: StatSpread | null | undefined,
): string | null {
  if (!spread || isEmptySpread(spread)) return null;
  const parts: string[] = [];
  for (const key of STAT_KEYS) {
    const value = spread[key];
    if (kind === "EVs") {
      if (value <= 0) continue;
    } else if (value >= 31) {
      continue;
    }
    parts.push(`${value} ${STAT_LABELS[key]}`);
  }
  if (parts.length === 0) return null;
  return `${kind}: ${parts.join(" / ")}`;
}

function formatShowdownSet(
  p: PokemonEntry,
  showCompetitive: boolean,
): string {
  const lines: string[] = [showdownTitleLine(p)];

  if (showCompetitive && p.ability?.trim()) {
    lines.push(`Ability: ${p.ability.trim()}`);
  }
  if (p.level != null && Number.isFinite(p.level)) {
    lines.push(`Level: ${p.level}`);
  }
  if (p.isShiny) {
    lines.push("Shiny: Yes");
  }

  if (showCompetitive) {
    const evs = formatShowdownSpreadLine("EVs", p.evs);
    if (evs) lines.push(evs);
    if (p.nature?.trim()) {
      lines.push(`${p.nature.trim()} Nature`);
    }
    const ivs = formatShowdownSpreadLine("IVs", p.ivs);
    if (ivs) lines.push(ivs);
    for (const move of p.moves.map((m) => m.trim()).filter(Boolean)) {
      lines.push(`- ${move}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format living MAIN squad as Pokémon Showdown / PokePaste text (no comments).
 * Same privacy gate as the LLM export. Reserves are omitted for a clean import.
 */
export function formatTrainerTeamShowdown(
  trainer: TeamExportTrainer,
  opts: Pick<TeamExportOpts, "showCompetitiveDetails"> = {},
): string {
  const showCompetitive = opts.showCompetitiveDetails !== false;
  const main = livingInSlot(trainer.pokemon, "MAIN");
  if (main.length === 0) {
    return "";
  }
  return main.map((p) => formatShowdownSet(p, showCompetitive)).join("\n\n");
}

/** Dispatch to LLM or Showdown/PokePaste formatter. */
export function formatTrainerTeam(
  trainer: TeamExportTrainer,
  opts: TeamExportOpts & { format?: TeamExportFormat },
): string {
  if (opts.format === "showdown") {
    return formatTrainerTeamShowdown(trainer, opts);
  }
  return formatTrainerTeamExport(trainer, opts);
}
