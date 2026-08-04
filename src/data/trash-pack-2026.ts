import type { Challenge } from "@/lib/challenge-types";
import { DEFAULT_BADGE_DEFINITIONS } from "@/lib/constants";

type SeedChallenge = Omit<Challenge, "source" | "activities" | "id">;

const rules = [
  {
    id: "r1",
    sortOrder: 1,
    title: "Fainted Pokémon = Dead",
    body: "",
    isCore: true,
  },
  {
    id: "r2",
    sortOrder: 2,
    title: "First Encounter per Area",
    body: "Only the first wild Pokémon encountered in a route, city, or area can be caught. If it flees or faints, the opportunity in that area is lost. (Tip: Repels can help navigate toward desired encounters).",
    isCore: true,
  },
  {
    id: "r3",
    sortOrder: 3,
    title: "No Breeding",
    body: "For the principles of the Nuzlocke, breeding is not allowed.",
    isCore: true,
  },
  {
    id: "r4",
    sortOrder: 4,
    title: "No Duplicate Held Items",
    body: "",
    isCore: true,
  },
  {
    id: "r5",
    sortOrder: 5,
    title: "1 Revive Token",
    body: "One revive per run. Recording a wipe starts a new run with a fresh revive token.",
    isCore: false,
  },
  {
    id: "r6",
    sortOrder: 6,
    title: "No Save Scumming",
    body: "Accept the mistakes and misfortunes, and keep on progressing. Do not re-load save files.",
    isCore: false,
  },
  {
    id: "r7",
    sortOrder: 7,
    title: "Honor System",
    body: "Trainers must actively update their trainer board as often and honest as possible while abiding by the rules.",
    isCore: false,
  },
];

const faqs = [
  {
    id: "f1",
    sortOrder: 1,
    question: "What's the end goal?",
    answer:
      "To initiate a bracket based tournament between everyone's Main Squad. The Main Squad locks in immediately after defeating the Champion, even if Pokémon faint in the final battle. If the whole Main Squad faints during the Champion fight, retry with reserves.",
  },
  {
    id: "f2",
    sortOrder: 2,
    question: "What if I don't have any more playable Pokémon?",
    answer:
      'If all playable Pokémon are dead, then the Nuzlocke run is considered a wipe. You\'ll have to start the game over and try the Nuzlocke challenge again. Navigate to the "Game Mode Setting" page on how to set up your game again. On your trainer board, use Record wipe to move Main and Reserves into the R.I.P. memorial, clear Encountered, reset badges, refresh your revive token for the next run, and count the restart — season memorial and your profile (name, avatar, backdrops, status) stay across wipes.',
  },
  {
    id: "f3",
    sortOrder: 3,
    question: "How much time do I have to complete my Nuzlocke challenge?",
    answer:
      "You'll be given roughly 3 months after the official announcement of the challenge to complete your run. As time gets closer, a strict deadline will be announced followed by applicable handicaps to participants that are not close to completing their run.",
  },
  {
    id: "f4",
    sortOrder: 4,
    question: "What generation (Gen) of Pokémon are we working with?",
    answer:
      "Only Pokémon from Gen 1 through 4 will be usable for this Nuzlocke Challenge. In-game Trainers and Gym Leaders will maintain their default Gen 1-9 Pokémon Line ups to allow participants to strategize how to defeat them.",
  },
  {
    id: "f5",
    sortOrder: 5,
    question: "What if I catch a shiny? How do I edit that in my Trainer Board?",
    answer: "Toggle Shiny on the Pokémon slot when you add or edit it.",
  },
  {
    id: "f6",
    sortOrder: 6,
    question: "What's the level cap for training my Pokémon?",
    answer:
      "In game rules has it set that your Pokémon level will be equal to the next gym leader's highest level Pokémon. Therefore, if your next undefeated Gym Leader's highest Pokémon level is 15, then all your Pokémon levels cannot surpass level 15 until that Gym leader is defeated.",
  },
  {
    id: "f7",
    sortOrder: 7,
    question: "Why can't I use potions or consumable items during battle?",
    answer:
      'In game rules has it set that you must strategize "switching" or using "healing moves" to save your Pokémon. Generally, most Nuzlocke playthroughs enforce the rule of not using consumable items during battle.',
  },
  {
    id: "f8",
    sortOrder: 8,
    question: "I'm new to the game, what are some resources I can use?",
    answer:
      "Navigate to the [Tools] page to get the summarized understanding of how to train, battle, and play Pokémon.",
  },
];

export const trashPack2026: SeedChallenge = {
  slug: "2026-trash-pack",
  name: "Pokémon Emerald Modern",
  year: 2026,
  game: "Pokémon Emerald Modern",
  description:
    "Trash Pack's 2026 Nuzlocke! Sign in with Discord to join and import your game save file!",
  status: "ACTIVE",
  visibility: "PUBLIC",
  playerInviteCode: null,
  gmInviteCode: "TRASHPACK-GM",
  badges: DEFAULT_BADGE_DEFINITIONS,
  rules,
  faqs,
  trainers: [],
};

export const CHALLENGES: SeedChallenge[] = [trashPack2026];
