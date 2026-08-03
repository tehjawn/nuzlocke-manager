import { findPokemonById } from "@/data/pokemon-index";
import speciesEvolutionsData from "@/data/species-evolutions.json";

export type EvoParamKind = "level" | "item" | "move" | "beauty" | "none";

export type EvolutionEdgeRaw = {
  method: string;
  paramKind: EvoParamKind;
  param: number | string;
  into: number;
};

export type EvolutionConditionChip = {
  /** Short label shown in the UI chip. */
  label: string;
  /** Optional category for icon / emphasis. */
  kind:
    | "level"
    | "item"
    | "hold"
    | "trade"
    | "friendship"
    | "move"
    | "beauty"
    | "gender"
    | "time"
    | "special";
};

export type EvolutionReadiness = {
  status: "ready" | "close" | "blocked" | "unknown";
  /** Short status line, e.g. "Ready", "3 levels away". */
  detail: string | null;
};

export type EvolutionOption = {
  into: number;
  intoName: string;
  method: string;
  chips: EvolutionConditionChip[];
  /** One-line summary joining chips. */
  summary: string;
  note: string | null;
  readiness: EvolutionReadiness;
};

export type EvolutionView = {
  pokedexId: number;
  speciesName: string;
  /** Prior stages leading to this species (oldest → newest parent). */
  ancestors: Array<{ pokedexId: number; name: string }>;
  /** Outgoing evolution options from this species. */
  options: EvolutionOption[];
  /** True when this species has no outgoing evolutions in Modern Emerald. */
  isFinal: boolean;
};

type SpecimenContext = {
  level?: number | null;
  heldItem?: string | null;
  moves?: string[] | null;
};

const BY_DEX = (speciesEvolutionsData as { byDex: Record<string, EvolutionEdgeRaw[]> })
  .byDex;

/** Reverse map: intoDex → list of fromDex that evolve into it. */
const PARENTS_BY_DEX = new Map<number, number[]>();
for (const [fromKey, edges] of Object.entries(BY_DEX)) {
  const from = Number(fromKey);
  for (const edge of edges) {
    const list = PARENTS_BY_DEX.get(edge.into) ?? [];
    if (!list.includes(from)) list.push(from);
    PARENTS_BY_DEX.set(edge.into, list);
  }
}

function speciesName(pokedexId: number): string {
  return findPokemonById(pokedexId)?.name ?? `#${pokedexId}`;
}

function normalizeItemKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeMoveKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function hasMove(moves: string[] | null | undefined, required: string): boolean {
  if (!moves?.length) return false;
  const want = normalizeMoveKey(required);
  return moves.some((m) => normalizeMoveKey(m) === want);
}

function heldMatches(
  heldItem: string | null | undefined,
  required: string,
): boolean {
  if (!heldItem?.trim()) return false;
  return normalizeItemKey(heldItem) === normalizeItemKey(required);
}

/** Build readable condition chips for a ROM evolution method. */
export function evolutionConditionChips(
  edge: EvolutionEdgeRaw,
): EvolutionConditionChip[] {
  const { method, param } = edge;
  const level =
    typeof param === "number" && edge.paramKind === "level" ? param : null;
  const item = edge.paramKind === "item" ? String(param) : null;
  const move = edge.paramKind === "move" ? String(param) : null;
  const beauty =
    edge.paramKind === "beauty" && typeof param === "number" ? param : null;

  switch (method) {
    case "EVO_LEVEL":
      return [{ kind: "level", label: `Lv ${level}` }];
    case "EVO_LEVEL_NIGHT":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "time", label: "Night" },
      ];
    case "EVO_LEVEL_FEMALE_MORNING":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "gender", label: "♀" },
        { kind: "time", label: "Morning" },
      ];
    case "EVO_LEVEL_MALE_MORNING":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "gender", label: "♂" },
        { kind: "time", label: "Morning" },
      ];
    case "EVO_LEVEL_ATK_GT_DEF":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "special", label: "ATK > DEF" },
      ];
    case "EVO_LEVEL_ATK_LT_DEF":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "special", label: "ATK < DEF" },
      ];
    case "EVO_LEVEL_ATK_EQ_DEF":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "special", label: "ATK = DEF" },
      ];
    case "EVO_LEVEL_SILCOON":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "special", label: "Personality → Silcoon" },
      ];
    case "EVO_LEVEL_CASCOON":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "special", label: "Personality → Cascoon" },
      ];
    case "EVO_LEVEL_NINJASK":
      return [{ kind: "level", label: `Lv ${level}` }];
    case "EVO_LEVEL_SHEDINJA":
      return [
        { kind: "level", label: `Lv ${level}` },
        { kind: "special", label: "Empty slot + Poké Ball" },
      ];
    case "EVO_ITEM":
      return item ? [{ kind: "item", label: item }] : [];
    case "EVO_ITEM_HOLD":
      return item
        ? [
            { kind: "hold", label: `Hold ${item}` },
            { kind: "level", label: "Level up" },
          ]
        : [];
    case "EVO_ITEM_HOLD_DAY":
      return item
        ? [
            { kind: "hold", label: `Hold ${item}` },
            { kind: "time", label: "Day" },
            { kind: "level", label: "Level up" },
          ]
        : [];
    case "EVO_ITEM_HOLD_NIGHT":
      return item
        ? [
            { kind: "hold", label: `Hold ${item}` },
            { kind: "time", label: "Night" },
            { kind: "level", label: "Level up" },
          ]
        : [];
    case "EVO_TRADE":
      return [{ kind: "trade", label: "Trade" }];
    case "EVO_TRADE_ITEM":
      return item
        ? [
            { kind: "trade", label: "Trade" },
            { kind: "hold", label: item },
          ]
        : [{ kind: "trade", label: "Trade" }];
    case "EVO_FRIENDSHIP":
      return [
        { kind: "friendship", label: "Friendship" },
        { kind: "level", label: "Level up" },
      ];
    case "EVO_FRIENDSHIP_DAY":
      return [
        { kind: "friendship", label: "Friendship" },
        { kind: "time", label: "Day" },
        { kind: "level", label: "Level up" },
      ];
    case "EVO_FRIENDSHIP_NIGHT":
      return [
        { kind: "friendship", label: "Friendship" },
        { kind: "time", label: "Night" },
        { kind: "level", label: "Level up" },
      ];
    case "EVO_MOVE":
      return move
        ? [
            { kind: "move", label: `Know ${move}` },
            { kind: "level", label: "Level up" },
          ]
        : [];
    case "EVO_BEAUTY":
      return [
        { kind: "beauty", label: `Beauty ≥ ${beauty}` },
        { kind: "level", label: "Level up" },
      ];
    default:
      return [{ kind: "special", label: method.replace(/^EVO_/, "") }];
  }
}

export function evolutionNote(edge: EvolutionEdgeRaw): string | null {
  switch (edge.method) {
    case "EVO_LEVEL_SHEDINJA":
      return "Appears in an empty party slot when Nincada evolves (needs a Poké Ball).";
    case "EVO_LEVEL_SILCOON":
    case "EVO_LEVEL_CASCOON":
      return "Branch is fixed by personality value when Wurmple hits the level.";
    case "EVO_LEVEL_NINJASK":
      return "Nincada becomes Ninjask; Shedinja may appear alongside.";
    default:
      return null;
  }
}

export function evolutionReadiness(
  edge: EvolutionEdgeRaw,
  specimen?: SpecimenContext | null,
): EvolutionReadiness {
  if (!specimen) return { status: "unknown", detail: null };

  const level =
    typeof specimen.level === "number" && Number.isFinite(specimen.level)
      ? specimen.level
      : null;

  const method = edge.method;
  const reqLevel =
    edge.paramKind === "level" && typeof edge.param === "number"
      ? edge.param
      : null;
  const reqItem = edge.paramKind === "item" ? String(edge.param) : null;
  const reqMove = edge.paramKind === "move" ? String(edge.param) : null;

  const isLevelMethod =
    method.startsWith("EVO_LEVEL") ||
    method === "EVO_FRIENDSHIP" ||
    method === "EVO_FRIENDSHIP_DAY" ||
    method === "EVO_FRIENDSHIP_NIGHT" ||
    method === "EVO_MOVE" ||
    method === "EVO_BEAUTY" ||
    method === "EVO_ITEM_HOLD" ||
    method === "EVO_ITEM_HOLD_DAY" ||
    method === "EVO_ITEM_HOLD_NIGHT";

  if (reqItem && (method === "EVO_ITEM_HOLD" || method === "EVO_ITEM_HOLD_DAY" || method === "EVO_ITEM_HOLD_NIGHT" || method === "EVO_TRADE_ITEM")) {
    if (!heldMatches(specimen.heldItem, reqItem)) {
      return { status: "blocked", detail: `Needs ${reqItem}` };
    }
  }

  if (method === "EVO_ITEM" && reqItem) {
    return { status: "unknown", detail: `Use ${reqItem}` };
  }

  if (method === "EVO_TRADE" || method === "EVO_TRADE_ITEM") {
    if (method === "EVO_TRADE_ITEM" && reqItem && heldMatches(specimen.heldItem, reqItem)) {
      return { status: "ready", detail: "Ready to trade" };
    }
    return {
      status: method === "EVO_TRADE_ITEM" && reqItem ? "blocked" : "unknown",
      detail: method === "EVO_TRADE_ITEM" && reqItem ? `Hold ${reqItem}, then trade` : "Trade required",
    };
  }

  if (reqMove && !hasMove(specimen.moves, reqMove)) {
    return { status: "blocked", detail: `Needs ${reqMove}` };
  }

  if (reqLevel != null && level != null && isLevelMethod) {
    if (level >= reqLevel) {
      // Soft "ready" — other gates (friendship, time, gender) may still apply.
      if (
        method === "EVO_LEVEL" ||
        method === "EVO_LEVEL_NINJASK" ||
        method === "EVO_LEVEL_SHEDINJA"
      ) {
        return { status: "ready", detail: "Ready" };
      }
      return { status: "close", detail: "Level met — check other conditions" };
    }
    const away = reqLevel - level;
    return {
      status: away <= 5 ? "close" : "blocked",
      detail: `${away} level${away === 1 ? "" : "s"} away`,
    };
  }

  if (reqMove && hasMove(specimen.moves, reqMove)) {
    return { status: "close", detail: "Move known — level up" };
  }

  if (
    reqItem &&
    (method === "EVO_ITEM_HOLD" ||
      method === "EVO_ITEM_HOLD_DAY" ||
      method === "EVO_ITEM_HOLD_NIGHT") &&
    heldMatches(specimen.heldItem, reqItem)
  ) {
    return { status: "close", detail: "Holding item — level up" };
  }

  return { status: "unknown", detail: null };
}

function toOption(
  edge: EvolutionEdgeRaw,
  specimen?: SpecimenContext | null,
): EvolutionOption {
  const chips = evolutionConditionChips(edge);
  return {
    into: edge.into,
    intoName: speciesName(edge.into),
    method: edge.method,
    chips,
    summary: chips.map((c) => c.label).join(" · "),
    note: evolutionNote(edge),
    readiness: evolutionReadiness(edge, specimen),
  };
}

/** Outgoing Modern Emerald evolutions for a National Dex id. */
export function evolutionsFrom(
  pokedexId: number,
  specimen?: SpecimenContext | null,
): EvolutionOption[] {
  const edges = BY_DEX[String(pokedexId)] ?? [];
  return edges.map((edge) => toOption(edge, specimen));
}

/**
 * Walk one parent chain backward (prefer the lowest dex parent when several
 * exist — keeps breadcrumb stable for rare multi-parent cases).
 */
export function evolutionAncestors(
  pokedexId: number,
  limit = 4,
): Array<{ pokedexId: number; name: string }> {
  const chain: Array<{ pokedexId: number; name: string }> = [];
  const seen = new Set<number>([pokedexId]);
  let current = pokedexId;

  while (chain.length < limit) {
    const parents = PARENTS_BY_DEX.get(current);
    if (!parents?.length) break;
    const parent = [...parents].sort((a, b) => a - b)[0]!;
    if (seen.has(parent)) break;
    seen.add(parent);
    chain.unshift({ pokedexId: parent, name: speciesName(parent) });
    current = parent;
  }

  return chain;
}

/** Full view model for the details-modal Evolution section. */
export function evolutionViewFor(
  pokedexId: number,
  specimen?: SpecimenContext | null,
): EvolutionView | null {
  if (!Number.isFinite(pokedexId) || pokedexId <= 0) return null;
  const options = evolutionsFrom(pokedexId, specimen);
  const ancestors = evolutionAncestors(pokedexId);
  // Hide for species that never appear in the Modern Emerald evo graph.
  if (options.length === 0 && ancestors.length === 0) return null;

  return {
    pokedexId,
    speciesName: speciesName(pokedexId),
    ancestors,
    options,
    isFinal: options.length === 0,
  };
}
