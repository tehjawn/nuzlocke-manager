/**
 * Lightweight Elite Four + Champion specialty prep for Team Planner.
 * Types only — not a full boss party database (see MASTER_PLAN).
 */

import type { GuideGymPrep } from "@/features/guide/guide-types";

export type LeaguePrepTarget = GuideGymPrep & {
  id: string;
  /** Soft badge key for progress context (elite-1…championship). */
  badgeKey: string;
};

export const ELITE_FOUR_PREP: ReadonlyArray<LeaguePrepTarget> = [
  {
    id: "e4-sidney",
    badgeKey: "elite-1",
    leaderName: "Sidney",
    specialtyTypes: ["Dark"],
    recommendedTypes: ["Fighting", "Bug", "Fairy"],
    cautionTypes: ["Psychic", "Ghost"],
    partyNotes:
      "Dark specialist. Fighting / Bug / Fairy hit hard; Psychic usually whiffs. Pack at least one clean answer before the gauntlet.",
  },
  {
    id: "e4-phoebe",
    badgeKey: "elite-2",
    leaderName: "Phoebe",
    specialtyTypes: ["Ghost"],
    recommendedTypes: ["Ghost", "Dark"],
    cautionTypes: ["Normal", "Fighting"],
    partyNotes:
      "Ghost specialist. Dark and Ghost pressure her; Normal / Fighting often bounce. Watch dual typings on her bench.",
  },
  {
    id: "e4-glacia",
    badgeKey: "elite-3",
    leaderName: "Glacia",
    specialtyTypes: ["Ice"],
    recommendedTypes: ["Fire", "Fighting", "Rock", "Steel"],
    cautionTypes: ["Grass", "Ground", "Flying", "Dragon"],
    partyNotes:
      "Ice specialist. Fire / Fighting / Rock / Steel are classic answers; Water/Grass/Flying often hate hail or Ice Beam.",
  },
  {
    id: "e4-drake",
    badgeKey: "elite-4",
    leaderName: "Drake",
    specialtyTypes: ["Dragon"],
    recommendedTypes: ["Ice", "Dragon", "Fairy"],
    cautionTypes: ["Fire", "Water", "Grass", "Electric"],
    partyNotes:
      "Dragon specialist. Ice and Fairy (and opposing Dragon) are the clean answers. Don’t lean only on Fire/Water/Grass/Electric.",
  },
  {
    id: "e4-wallace",
    badgeKey: "championship",
    leaderName: "Wallace",
    specialtyTypes: ["Water"],
    recommendedTypes: ["Electric", "Grass"],
    cautionTypes: ["Fire", "Rock", "Ground"],
    partyNotes:
      "Champion — Water specialist. Electric and Grass are the clean answers after the full E4 gauntlet. Heal between members only if you leave.",
  },
];
