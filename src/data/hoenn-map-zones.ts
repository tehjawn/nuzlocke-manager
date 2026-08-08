/**
 * Game-accurate Hoenn region map hit targets.
 *
 * Cell occupancy from pret/pokeemerald `region_map_layout.h` (28×15).
 * Solid routes → one rect; non-rect (e.g. Route 114 L) → one SVG path.
 * Indoor / special places fold onto their surface parent mapsec.
 * Pixel transform calibrated to `/public/maps/hoenn-region.png` (640×360).
 */

export const HOENN_MAP_IMAGE = "/maps/hoenn-region.png";
export const HOENN_MAP_VIEWBOX = "0 0 640 360";
export const HOENN_MAP_SIZE = { width: 640, height: 360 } as const;

export const HOENN_MAP_GRID = {
  originX: 50.5,
  originY: 39,
  cellW: 17.875,
  cellH: 17.75,
  cols: 28,
  rows: 15,
} as const;

export type HoennMapRect = {
  x: number; y: number; width: number; height: number;
};

export type HoennMapRegion = {
  id: string;
  name: string;
  labels: readonly string[];
  /**
   * Hit geometry in viewBox pixels.
   * `rect` for solid pret bbox fills; `path` for L / doughnut shapes.
   */
  shape:
    | { type: "rect"; x: number; y: number; width: number; height: number }
    | { type: "path"; d: string };
  mapsec: number;
};

export const HOENN_MAP_REGIONS: readonly HoennMapRegion[] = [
  {
    id: "littleroot-town",
    name: "Littleroot Town",
    labels: ["Littleroot Town"],
    shape: { type: "rect", x: 122, y: 234.25, width: 17.88, height: 17.75 },
    mapsec: 0,
  },
  {
    id: "oldale-town",
    name: "Oldale Town",
    labels: ["Oldale Town"],
    shape: { type: "rect", x: 122, y: 198.75, width: 17.88, height: 17.75 },
    mapsec: 1,
  },
  {
    id: "dewford-town",
    name: "Dewford Town",
    labels: ["Dewford Town"],
    shape: { type: "rect", x: 86.25, y: 287.5, width: 17.88, height: 17.75 },
    mapsec: 2,
  },
  {
    id: "lavaridge-town",
    name: "Lavaridge Town",
    labels: ["Lavaridge Town"],
    shape: { type: "rect", x: 139.88, y: 92.25, width: 17.88, height: 17.75 },
    mapsec: 3,
  },
  {
    id: "fallarbor-town",
    name: "Fallarbor Town",
    labels: ["Fallarbor Town"],
    shape: { type: "rect", x: 104.13, y: 39, width: 17.88, height: 17.75 },
    mapsec: 4,
  },
  {
    id: "verdanturf-town",
    name: "Verdanturf Town",
    labels: ["Verdanturf Town"],
    shape: { type: "rect", x: 122, y: 145.5, width: 17.88, height: 17.75 },
    mapsec: 5,
  },
  {
    id: "pacifidlog-town",
    name: "Pacifidlog Town",
    labels: ["Pacifidlog Town","Mirage Island"],
    shape: { type: "rect", x: 354.38, y: 216.5, width: 17.88, height: 17.75 },
    mapsec: 6,
  },
  {
    id: "petalburg-city",
    name: "Petalburg City",
    labels: ["Petalburg City"],
    shape: { type: "rect", x: 68.38, y: 198.75, width: 17.88, height: 17.75 },
    mapsec: 7,
  },
  {
    id: "slateport-city",
    name: "Slateport City",
    labels: ["Slateport City"],
    shape: { type: "rect", x: 193.5, y: 216.5, width: 17.88, height: 35.5 },
    mapsec: 8,
  },
  {
    id: "mauville-city",
    name: "Mauville City",
    labels: ["Mauville City"],
    shape: { type: "rect", x: 193.5, y: 145.5, width: 35.75, height: 17.75 },
    mapsec: 9,
  },
  {
    id: "rustboro-city",
    name: "Rustboro City",
    labels: ["Rustboro City"],
    shape: { type: "rect", x: 50.5, y: 127.75, width: 17.88, height: 35.5 },
    mapsec: 10,
  },
  {
    id: "fortree-city",
    name: "Fortree City",
    labels: ["Fortree City"],
    shape: { type: "rect", x: 265, y: 39, width: 17.88, height: 17.75 },
    mapsec: 11,
  },
  {
    id: "lilycove-city",
    name: "Lilycove City",
    labels: ["Lilycove City","Aqua Hideout"],
    shape: { type: "rect", x: 372.25, y: 92.25, width: 35.75, height: 17.75 },
    mapsec: 12,
  },
  {
    id: "mossdeep-city",
    name: "Mossdeep City",
    labels: ["Mossdeep City"],
    shape: { type: "rect", x: 479.5, y: 127.75, width: 35.75, height: 17.75 },
    mapsec: 13,
  },
  {
    id: "sootopolis-city",
    name: "Sootopolis City",
    labels: ["Sootopolis City","Cave of Origin"],
    shape: { type: "rect", x: 425.88, y: 163.25, width: 17.88, height: 17.75 },
    mapsec: 14,
  },
  {
    id: "ever-grande-city",
    name: "Ever Grande City",
    labels: ["Ever Grande City","Victory Road"],
    shape: { type: "rect", x: 533.13, y: 181, width: 17.88, height: 35.5 },
    mapsec: 15,
  },
  {
    id: "route-101",
    name: "Route 101",
    labels: ["Route 101"],
    shape: { type: "rect", x: 122, y: 216.5, width: 17.88, height: 17.75 },
    mapsec: 16,
  },
  {
    id: "route-102",
    name: "Route 102",
    labels: ["Route 102"],
    shape: { type: "rect", x: 86.25, y: 198.75, width: 35.75, height: 17.75 },
    mapsec: 17,
  },
  {
    id: "route-103",
    name: "Route 103",
    labels: ["Route 103","Altering Cave","Artisan Cave"],
    shape: { type: "rect", x: 122, y: 181, width: 71.5, height: 17.75 },
    mapsec: 18,
  },
  {
    id: "route-104",
    name: "Route 104",
    labels: ["Route 104","Petalburg Woods"],
    shape: { type: "rect", x: 50.5, y: 163.25, width: 17.88, height: 53.25 },
    mapsec: 19,
  },
  {
    id: "route-105",
    name: "Route 105",
    labels: ["Route 105","Island Cave"],
    shape: { type: "rect", x: 50.5, y: 216.5, width: 17.88, height: 53.25 },
    mapsec: 20,
  },
  {
    id: "route-106",
    name: "Route 106",
    labels: ["Route 106","Granite Cave"],
    shape: { type: "rect", x: 50.5, y: 269.75, width: 53.63, height: 17.75 },
    mapsec: 21,
  },
  {
    id: "route-107",
    name: "Route 107",
    labels: ["Route 107"],
    shape: { type: "rect", x: 104.13, y: 287.5, width: 53.63, height: 17.75 },
    mapsec: 22,
  },
  {
    id: "route-108",
    name: "Route 108",
    labels: ["Route 108","Abandoned Ship"],
    shape: { type: "rect", x: 157.75, y: 287.5, width: 35.75, height: 17.75 },
    mapsec: 23,
  },
  {
    id: "route-109",
    name: "Route 109",
    labels: ["Route 109"],
    shape: { type: "rect", x: 193.5, y: 252, width: 17.88, height: 53.25 },
    mapsec: 24,
  },
  {
    id: "route-110",
    name: "Route 110",
    labels: ["Route 110","New Mauville"],
    shape: { type: "rect", x: 193.5, y: 163.25, width: 17.88, height: 53.25 },
    mapsec: 25,
  },
  {
    id: "route-111",
    name: "Route 111",
    labels: ["Route 111","Desert Ruins","Mirage Tower","Trainer Hill"],
    shape: { type: "rect", x: 193.5, y: 39, width: 17.88, height: 106.5 },
    mapsec: 26,
  },
  {
    id: "route-112",
    name: "Route 112",
    labels: ["Route 112","Fiery Path","Jagged Pass","Magma Hideout"],
    shape: { type: "rect", x: 157.75, y: 92.25, width: 35.75, height: 17.75 },
    mapsec: 27,
  },
  {
    id: "route-113",
    name: "Route 113",
    labels: ["Route 113"],
    shape: { type: "rect", x: 122, y: 39, width: 71.5, height: 17.75 },
    mapsec: 28,
  },
  {
    id: "route-114",
    name: "Route 114",
    labels: ["Route 114","Meteor Falls","Desert Underpass"],
    shape: { type: "path", d: "M68.38 39L86.25 39L104.13 39L104.13 56.75L86.25 56.75L86.25 74.5L86.25 92.25L68.38 92.25L68.38 74.5L68.38 56.75L68.38 39Z" },
    mapsec: 29,
  },
  {
    id: "route-115",
    name: "Route 115",
    labels: ["Route 115"],
    shape: { type: "rect", x: 50.5, y: 74.5, width: 17.88, height: 53.25 },
    mapsec: 30,
  },
  {
    id: "route-116",
    name: "Route 116",
    labels: ["Route 116","Rusturf Tunnel"],
    shape: { type: "rect", x: 68.38, y: 127.75, width: 71.5, height: 17.75 },
    mapsec: 31,
  },
  {
    id: "route-117",
    name: "Route 117",
    labels: ["Route 117"],
    shape: { type: "rect", x: 139.88, y: 145.5, width: 53.63, height: 17.75 },
    mapsec: 32,
  },
  {
    id: "route-118",
    name: "Route 118",
    labels: ["Route 118"],
    shape: { type: "rect", x: 229.25, y: 145.5, width: 35.75, height: 17.75 },
    mapsec: 33,
  },
  {
    id: "route-119",
    name: "Route 119",
    labels: ["Route 119"],
    shape: { type: "rect", x: 247.13, y: 39, width: 17.88, height: 106.5 },
    mapsec: 34,
  },
  {
    id: "route-120",
    name: "Route 120",
    labels: ["Route 120","Scorched Slab","Ancient Tomb"],
    shape: { type: "rect", x: 282.88, y: 39, width: 17.88, height: 71 },
    mapsec: 35,
  },
  {
    id: "route-121",
    name: "Route 121",
    labels: ["Route 121"],
    shape: { type: "rect", x: 300.75, y: 92.25, width: 71.5, height: 17.75 },
    mapsec: 36,
  },
  {
    id: "route-122",
    name: "Route 122",
    labels: ["Route 122","Mt. Pyre"],
    shape: { type: "rect", x: 336.5, y: 110, width: 17.88, height: 35.5 },
    mapsec: 37,
  },
  {
    id: "route-123",
    name: "Route 123",
    labels: ["Route 123"],
    shape: { type: "rect", x: 265, y: 145.5, width: 89.38, height: 17.75 },
    mapsec: 38,
  },
  {
    id: "route-124",
    name: "Route 124",
    labels: ["Route 124","Underwater"],
    shape: { type: "rect", x: 408, y: 92.25, width: 71.5, height: 53.25 },
    mapsec: 39,
  },
  {
    id: "route-125",
    name: "Route 125",
    labels: ["Route 125","Shoal Cave"],
    shape: { type: "rect", x: 479.5, y: 92.25, width: 35.75, height: 35.5 },
    mapsec: 40,
  },
  {
    id: "route-126",
    name: "Route 126",
    labels: ["Route 126"],
    shape: { type: "path", d: "M408 145.5L425.88 145.5L443.75 145.5L461.63 145.5L461.63 163.25L461.63 181L461.63 198.75L443.75 198.75L425.88 198.75L408 198.75L408 181L408 163.25L408 145.5ZM443.75 163.25L425.88 163.25L425.88 181L443.75 181L443.75 163.25Z" },
    mapsec: 41,
  },
  {
    id: "route-127",
    name: "Route 127",
    labels: ["Route 127"],
    shape: { type: "rect", x: 461.63, y: 145.5, width: 53.63, height: 53.25 },
    mapsec: 42,
  },
  {
    id: "route-128",
    name: "Route 128",
    labels: ["Route 128","Seafloor Cavern"],
    shape: { type: "rect", x: 461.63, y: 198.75, width: 71.5, height: 17.75 },
    mapsec: 43,
  },
  {
    id: "route-129",
    name: "Route 129",
    labels: ["Route 129"],
    shape: { type: "rect", x: 479.5, y: 216.5, width: 35.75, height: 17.75 },
    mapsec: 44,
  },
  {
    id: "route-130",
    name: "Route 130",
    labels: ["Route 130"],
    shape: { type: "rect", x: 425.88, y: 216.5, width: 53.63, height: 17.75 },
    mapsec: 45,
  },
  {
    id: "route-131",
    name: "Route 131",
    labels: ["Route 131","Sky Pillar"],
    shape: { type: "rect", x: 372.25, y: 216.5, width: 53.63, height: 17.75 },
    mapsec: 46,
  },
  {
    id: "route-132",
    name: "Route 132",
    labels: ["Route 132"],
    shape: { type: "rect", x: 318.63, y: 216.5, width: 35.75, height: 17.75 },
    mapsec: 47,
  },
  {
    id: "route-133",
    name: "Route 133",
    labels: ["Route 133"],
    shape: { type: "rect", x: 265, y: 216.5, width: 53.63, height: 17.75 },
    mapsec: 48,
  },
  {
    id: "route-134",
    name: "Route 134",
    labels: ["Route 134","Sealed Chamber"],
    shape: { type: "rect", x: 211.38, y: 216.5, width: 53.63, height: 17.75 },
    mapsec: 49,
  },
  {
    id: "mt-chimney",
    name: "Mt.. Chimney",
    labels: ["Mt. Chimney"],
    shape: { type: "rect", x: 157.75, y: 56.75, width: 35.75, height: 35.5 },
    mapsec: 56,
  },
  {
    id: "safari-zone",
    name: "Safari Zone",
    labels: ["Safari Zone","Safari Zone (South)","Safari Zone (Southwest)","Safari Zone (Northwest)","Safari Zone (North)","Safari Zone (Southeast)","Safari Zone (Northeast)"],
    shape: { type: "rect", x: 336.5, y: 74.5, width: 17.88, height: 17.75 },
    mapsec: 57,
  },
  {
    id: "battle-frontier",
    name: "Battle Frontier",
    labels: ["Battle Frontier"],
    shape: { type: "rect", x: 443.75, y: 252, width: 17.88, height: 17.75 },
    mapsec: 58,
  },
  {
    id: "southern-island",
    name: "Southern Island",
    labels: ["Southern Island"],
    shape: { type: "rect", x: 265, y: 287.5, width: 17.88, height: 17.75 },
    mapsec: 73,
  },
] as const;

export const HOENN_MAP_LABELS: ReadonlySet<string> = new Set(
  HOENN_MAP_REGIONS.flatMap((region) => [...region.labels]),
);

export type HoennMapZone = HoennMapRegion;
export const HOENN_MAP_ZONES = HOENN_MAP_REGIONS;

export function findHoennMapZone(zoneId: string): HoennMapRegion | null {
  return HOENN_MAP_REGIONS.find((region) => region.id === zoneId) ?? null;
}

export function regionArea(region: HoennMapRegion): number {
  if (region.shape.type === "rect") {
    return region.shape.width * region.shape.height;
  }
  // Path area approx from path bounds — fine for paint-order only.
  const nums = region.shape.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]!);
    maxX = Math.max(maxX, nums[i]!);
    minY = Math.min(minY, nums[i + 1]!);
    maxY = Math.max(maxY, nums[i + 1]!);
  }
  if (!Number.isFinite(minX)) return 0;
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}
