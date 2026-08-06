/**
 * Schematic Hoenn region zones for the Encounters map view (#285).
 *
 * Zones are coarser than catch-route labels: each maps to one or more catalog
 * `label`s. Geography is approximate (original SVG, not ROM/pret art). Labels
 * with `aliasesRoute101` still appear in their geographic home; slot sharing is
 * handled at status time via `slotKey`, not by inventing extra map areas.
 */

export type HoennMapZone = {
  id: string;
  /** Short label drawn on the map. */
  name: string;
  /** Catalog labels belonging to this zone (exact `CatchRoute.label`). */
  labels: readonly string[];
  /**
   * SVG shape in viewBox 0 0 640 400.
   * Prefer simple rects / polygons so hit targets stay usable on mobile.
   */
  shape:
    | { type: "rect"; x: number; y: number; width: number; height: number }
    | { type: "polygon"; points: string };
  /** Optional label anchor; defaults to shape center. */
  labelAt?: { x: number; y: number };
};

/**
 * West → east, south → north bands that roughly follow Hoenn's layout.
 * Towns without wild slots are included so claims (gifts / eggs) still surface.
 */
export const HOENN_MAP_ZONES: readonly HoennMapZone[] = [
  {
    id: "starter",
    name: "Starter",
    labels: ["Littleroot Town", "Oldale Town", "Route 101", "Route 102", "Route 103"],
    shape: { type: "rect", x: 48, y: 268, width: 88, height: 72 },
  },
  {
    id: "petalburg",
    name: "Petalburg",
    labels: ["Petalburg City", "Petalburg Woods", "Route 104"],
    shape: { type: "rect", x: 48, y: 198, width: 92, height: 62 },
  },
  {
    id: "rustboro",
    name: "Rustboro",
    labels: [
      "Rustboro City",
      "Route 115",
      "Route 116",
      "Rusturf Tunnel",
      "Verdanturf Town",
    ],
    shape: { type: "rect", x: 48, y: 108, width: 100, height: 82 },
  },
  {
    id: "dewford",
    name: "Dewford",
    labels: [
      "Dewford Town",
      "Granite Cave",
      "Route 105",
      "Route 106",
      "Island Cave",
    ],
    shape: { type: "rect", x: 28, y: 348, width: 120, height: 44 },
  },
  {
    id: "slateport",
    name: "Slateport",
    labels: [
      "Slateport City",
      "Route 107",
      "Route 108",
      "Route 109",
      "Abandoned Ship",
    ],
    shape: { type: "rect", x: 156, y: 292, width: 108, height: 72 },
  },
  {
    id: "mauville",
    name: "Mauville",
    labels: [
      "Mauville City",
      "Route 110",
      "Route 117",
      "Route 118",
      "New Mauville",
      "Route 110 East",
    ],
    shape: { type: "rect", x: 156, y: 198, width: 108, height: 86 },
  },
  {
    id: "desert",
    name: "Desert",
    labels: [
      "Route 111",
      "Mirage Tower",
      "Desert Ruins",
      "Desert Underpass",
    ],
    shape: { type: "rect", x: 156, y: 108, width: 72, height: 82 },
  },
  {
    id: "chimney",
    name: "Chimney",
    labels: [
      "Route 112",
      "Route 113",
      "Lavaridge Town",
      "Jagged Pass",
      "Fiery Path",
      "Mt. Chimney",
      "Magma Hideout",
      "Scorched Slab",
    ],
    shape: { type: "rect", x: 236, y: 72, width: 92, height: 118 },
  },
  {
    id: "fallarbor",
    name: "Fallarbor",
    labels: ["Fallarbor Town", "Route 114", "Meteor Falls"],
    shape: { type: "rect", x: 156, y: 36, width: 72, height: 64 },
  },
  {
    id: "fortree",
    name: "Fortree",
    labels: ["Fortree City", "Route 119", "Route 120"],
    shape: { type: "rect", x: 276, y: 36, width: 100, height: 86 },
  },
  {
    id: "safari",
    name: "Safari",
    labels: [
      "Route 121",
      "Safari Zone",
      "Safari Zone (South)",
      "Safari Zone (Southwest)",
      "Safari Zone (Northwest)",
      "Safari Zone (North)",
      "Safari Zone (Southeast)",
      "Safari Zone (Northeast)",
    ],
    shape: { type: "rect", x: 384, y: 72, width: 100, height: 86 },
  },
  {
    id: "lilycove",
    name: "Lilycove",
    labels: [
      "Lilycove City",
      "Route 122",
      "Route 123",
      "Mt. Pyre",
      "Aqua Hideout",
    ],
    shape: { type: "rect", x: 384, y: 166, width: 100, height: 78 },
  },
  {
    id: "mossdeep",
    name: "Mossdeep",
    labels: ["Mossdeep City", "Route 124", "Route 125", "Shoal Cave"],
    shape: { type: "rect", x: 492, y: 128, width: 96, height: 78 },
  },
  {
    id: "sootopolis",
    name: "Sootopolis",
    labels: [
      "Sootopolis City",
      "Route 126",
      "Cave of Origin",
      "Underwater",
    ],
    shape: { type: "rect", x: 444, y: 252, width: 88, height: 64 },
  },
  {
    id: "ever-grande",
    name: "Ever Grande",
    labels: [
      "Ever Grande City",
      "Route 127",
      "Route 128",
      "Victory Road",
      "Seafloor Cavern",
    ],
    shape: { type: "rect", x: 540, y: 252, width: 80, height: 88 },
  },
  {
    id: "pacifidlog",
    name: "Pacifidlog",
    labels: [
      "Pacifidlog Town",
      "Route 129",
      "Route 130",
      "Route 131",
      "Route 132",
      "Route 133",
      "Route 134",
      "Route 132 North",
      "Sky Pillar",
      "Sealed Chamber",
    ],
    shape: { type: "rect", x: 332, y: 292, width: 104, height: 72 },
  },
  {
    id: "special",
    name: "Special",
    labels: [
      "Southern Island",
      "Faraway Island",
      "Birth Island",
      "Navel Rock",
      "Altering Cave",
      "Artisan Cave",
      "Marine Cave",
      "Terra Cave",
      "Battle Frontier",
      "Trainer Hill",
      "Mirage Island",
      "Ancient Tomb",
      "Draco Chamber",
      "Cave of Shock",
    ],
    shape: { type: "rect", x: 492, y: 36, width: 128, height: 84 },
  },
] as const;

export const HOENN_MAP_VIEWBOX = "0 0 640 400";

/** All catalog labels that appear on at least one zone. */
export const HOENN_MAP_LABELS: ReadonlySet<string> = new Set(
  HOENN_MAP_ZONES.flatMap((zone) => [...zone.labels]),
);

export function findHoennMapZone(zoneId: string): HoennMapZone | null {
  return HOENN_MAP_ZONES.find((zone) => zone.id === zoneId) ?? null;
}
