/**
 * Emerald / Hoenn badge presentation metadata keyed by BadgeDefinition.key.
 * Leader art: Pokémon Showdown trainer sprites.
 * Badge art: local PNGs in /public/badges/{key}.png
 */

export type EmeraldBadgeMeta = {
  badgeName: string;
  /** Compact board label, e.g. GYM 1 */
  previewLabel: string;
  leaderSpriteKey: string;
  accent: string;
  city?: string;
  badgeSprite: string;
};

export const EMERALD_BADGE_META: Record<string, EmeraldBadgeMeta> = {
  "gym-1": {
    badgeName: "Stone Badge",
    previewLabel: "GYM 1",
    leaderSpriteKey: "roxanne",
    accent: "#c4a35a",
    city: "Rustboro",
    badgeSprite: "/badges/gym-1.png",
  },
  "gym-2": {
    badgeName: "Knuckle Badge",
    previewLabel: "GYM 2",
    leaderSpriteKey: "brawly",
    accent: "#c06048",
    city: "Dewford",
    badgeSprite: "/badges/gym-2.png",
  },
  "gym-3": {
    badgeName: "Dynamo Badge",
    previewLabel: "GYM 3",
    leaderSpriteKey: "wattson",
    accent: "#f0d060",
    city: "Mauville",
    badgeSprite: "/badges/gym-3.png",
  },
  "gym-4": {
    badgeName: "Heat Badge",
    previewLabel: "GYM 4",
    leaderSpriteKey: "flannery",
    accent: "#e07040",
    city: "Lavaridge",
    badgeSprite: "/badges/gym-4.png",
  },
  "gym-5": {
    badgeName: "Balance Badge",
    previewLabel: "GYM 5",
    leaderSpriteKey: "norman",
    accent: "#a8a090",
    city: "Petalburg",
    badgeSprite: "/badges/gym-5.png",
  },
  "gym-6": {
    badgeName: "Feather Badge",
    previewLabel: "GYM 6",
    leaderSpriteKey: "winona",
    accent: "#90c8e8",
    city: "Fortree",
    badgeSprite: "/badges/gym-6.png",
  },
  "gym-7": {
    badgeName: "Mind Badge",
    previewLabel: "GYM 7",
    leaderSpriteKey: "tateandliza-gen3",
    accent: "#d878c0",
    city: "Mossdeep",
    badgeSprite: "/badges/gym-7.png",
  },
  "gym-8": {
    badgeName: "Rain Badge",
    previewLabel: "GYM 8",
    leaderSpriteKey: "juan",
    accent: "#5090d8",
    city: "Sootopolis",
    badgeSprite: "/badges/gym-8.png",
  },
  "elite-1": {
    badgeName: "Elite Four — Sidney",
    previewLabel: "E4 1",
    leaderSpriteKey: "sidney-gen3",
    accent: "#5a4868",
    badgeSprite: "/badges/elite-1.png",
  },
  "elite-2": {
    badgeName: "Elite Four — Phoebe",
    previewLabel: "E4 2",
    leaderSpriteKey: "phoebe-gen3",
    accent: "#7a6890",
    badgeSprite: "/badges/elite-2.png",
  },
  "elite-3": {
    badgeName: "Elite Four — Glacia",
    previewLabel: "E4 3",
    leaderSpriteKey: "glacia",
    accent: "#88c0d8",
    badgeSprite: "/badges/elite-3.png",
  },
  "elite-4": {
    badgeName: "Elite Four — Drake",
    previewLabel: "E4 4",
    leaderSpriteKey: "drake-gen3",
    accent: "#687848",
    badgeSprite: "/badges/elite-4.png",
  },
  championship: {
    badgeName: "Champion",
    previewLabel: "CHAMP",
    leaderSpriteKey: "wallace",
    accent: "#e8c56a",
    badgeSprite: "/badges/championship.png",
  },
};

export function getEmeraldBadgeMeta(key: string): EmeraldBadgeMeta | null {
  return EMERALD_BADGE_META[key] ?? null;
}
