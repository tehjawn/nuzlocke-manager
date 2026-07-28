import type { PokemonType } from "@/lib/type-chart";

/**
 * Iconic damaging moves by type — reference toolkit for the Tools Pokédex,
 * not a learnset. Prefer widely available / recognizable options.
 */
export const TYPE_SIGNATURE_MOVES: Record<
  PokemonType,
  ReadonlyArray<{ name: string; category: "Physical" | "Special" }>
> = {
  Normal: [
    { name: "Return", category: "Physical" },
    { name: "Body Slam", category: "Physical" },
    { name: "Hyper Voice", category: "Special" },
  ],
  Fire: [
    { name: "Flamethrower", category: "Special" },
    { name: "Flare Blitz", category: "Physical" },
    { name: "Fire Blast", category: "Special" },
  ],
  Water: [
    { name: "Surf", category: "Special" },
    { name: "Waterfall", category: "Physical" },
    { name: "Hydro Pump", category: "Special" },
  ],
  Electric: [
    { name: "Thunderbolt", category: "Special" },
    { name: "Wild Charge", category: "Physical" },
    { name: "Thunder", category: "Special" },
  ],
  Grass: [
    { name: "Energy Ball", category: "Special" },
    { name: "Leaf Blade", category: "Physical" },
    { name: "Giga Drain", category: "Special" },
  ],
  Ice: [
    { name: "Ice Beam", category: "Special" },
    { name: "Icicle Crash", category: "Physical" },
    { name: "Blizzard", category: "Special" },
  ],
  Fighting: [
    { name: "Close Combat", category: "Physical" },
    { name: "Focus Blast", category: "Special" },
    { name: "Brick Break", category: "Physical" },
  ],
  Poison: [
    { name: "Sludge Bomb", category: "Special" },
    { name: "Poison Jab", category: "Physical" },
    { name: "Gunk Shot", category: "Physical" },
  ],
  Ground: [
    { name: "Earthquake", category: "Physical" },
    { name: "Earth Power", category: "Special" },
    { name: "High Horsepower", category: "Physical" },
  ],
  Flying: [
    { name: "Brave Bird", category: "Physical" },
    { name: "Air Slash", category: "Special" },
    { name: "Hurricane", category: "Special" },
  ],
  Psychic: [
    { name: "Psychic", category: "Special" },
    { name: "Zen Headbutt", category: "Physical" },
    { name: "Psyshock", category: "Special" },
  ],
  Bug: [
    { name: "X-Scissor", category: "Physical" },
    { name: "Bug Buzz", category: "Special" },
    { name: "U-turn", category: "Physical" },
  ],
  Rock: [
    { name: "Stone Edge", category: "Physical" },
    { name: "Power Gem", category: "Special" },
    { name: "Rock Slide", category: "Physical" },
  ],
  Ghost: [
    { name: "Shadow Ball", category: "Special" },
    { name: "Shadow Claw", category: "Physical" },
    { name: "Poltergeist", category: "Physical" },
  ],
  Dragon: [
    { name: "Dragon Claw", category: "Physical" },
    { name: "Dragon Pulse", category: "Special" },
    { name: "Outrage", category: "Physical" },
  ],
  Dark: [
    { name: "Crunch", category: "Physical" },
    { name: "Dark Pulse", category: "Special" },
    { name: "Knock Off", category: "Physical" },
  ],
  Steel: [
    { name: "Iron Head", category: "Physical" },
    { name: "Flash Cannon", category: "Special" },
    { name: "Meteor Mash", category: "Physical" },
  ],
  Fairy: [
    { name: "Moonblast", category: "Special" },
    { name: "Play Rough", category: "Physical" },
    { name: "Dazzling Gleam", category: "Special" },
  ],
};

export function signatureMovesForTypes(
  types: readonly PokemonType[],
): Array<{ type: PokemonType; name: string; category: "Physical" | "Special" }> {
  const seen = new Set<string>();
  const out: Array<{
    type: PokemonType;
    name: string;
    category: "Physical" | "Special";
  }> = [];
  for (const type of types) {
    for (const move of TYPE_SIGNATURE_MOVES[type] ?? []) {
      if (seen.has(move.name)) continue;
      seen.add(move.name);
      out.push({ type, name: move.name, category: move.category });
    }
  }
  return out;
}

/** Prefer a Special or Physical pick matching the attacker’s stronger offense. */
export function pickCounterMove(
  attackType: PokemonType,
  preferPhysical: boolean,
): { name: string; category: "Physical" | "Special" } {
  const list = TYPE_SIGNATURE_MOVES[attackType];
  const preferred = list.find((m) =>
    preferPhysical ? m.category === "Physical" : m.category === "Special",
  );
  return preferred ?? list[0]!;
}
