/**
 * Emerald / Hoenn badge presentation metadata keyed by BadgeDefinition.key.
 * Leader art uses Pokémon Showdown trainer sprites.
 */

export type EmeraldBadgeMeta = {
  badgeName: string;
  shortName: string;
  leaderSpriteKey: string;
  /** CSS color for the badge medallion */
  accent: string;
  city?: string;
};

export const EMERALD_BADGE_META: Record<string, EmeraldBadgeMeta> = {
  "gym-1": {
    badgeName: "Stone Badge",
    shortName: "Stone",
    leaderSpriteKey: "roxanne",
    accent: "#c4a35a",
    city: "Rustboro",
  },
  "gym-2": {
    badgeName: "Knuckle Badge",
    shortName: "Knuckle",
    leaderSpriteKey: "brawly",
    accent: "#c06048",
    city: "Dewford",
  },
  "gym-3": {
    badgeName: "Dynamo Badge",
    shortName: "Dynamo",
    leaderSpriteKey: "wattson",
    accent: "#f0d060",
    city: "Mauville",
  },
  "gym-4": {
    badgeName: "Heat Badge",
    shortName: "Heat",
    leaderSpriteKey: "flannery",
    accent: "#e07040",
    city: "Lavaridge",
  },
  "gym-5": {
    badgeName: "Balance Badge",
    shortName: "Balance",
    leaderSpriteKey: "norman",
    accent: "#a8a090",
    city: "Petalburg",
  },
  "gym-6": {
    badgeName: "Feather Badge",
    shortName: "Feather",
    leaderSpriteKey: "winona",
    accent: "#90c8e8",
    city: "Fortree",
  },
  "gym-7": {
    badgeName: "Mind Badge",
    shortName: "Mind",
    leaderSpriteKey: "tateandliza-gen3",
    accent: "#d878c0",
    city: "Mossdeep",
  },
  "gym-8": {
    badgeName: "Rain Badge",
    shortName: "Rain",
    leaderSpriteKey: "juan",
    accent: "#5090d8",
    city: "Sootopolis",
  },
  "elite-1": {
    badgeName: "Elite Four",
    shortName: "Sidney",
    leaderSpriteKey: "sidney-gen3",
    accent: "#5a4868",
  },
  "elite-2": {
    badgeName: "Elite Four",
    shortName: "Phoebe",
    leaderSpriteKey: "phoebe-gen3",
    accent: "#7a6890",
  },
  "elite-3": {
    badgeName: "Elite Four",
    shortName: "Glacia",
    leaderSpriteKey: "glacia",
    accent: "#88c0d8",
  },
  "elite-4": {
    badgeName: "Elite Four",
    shortName: "Drake",
    leaderSpriteKey: "drake-gen3",
    accent: "#687848",
  },
  championship: {
    badgeName: "Champion",
    shortName: "Champ",
    leaderSpriteKey: "wallace",
    accent: "#e8c56a",
  },
};

export function getEmeraldBadgeMeta(key: string): EmeraldBadgeMeta | null {
  return EMERALD_BADGE_META[key] ?? null;
}
