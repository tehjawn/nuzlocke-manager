import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";

export type ChallengeExportPayload = {
  exportedAt: string;
  challenge: {
    slug: string;
    name: string;
    year: number;
    game: string;
    description: string;
    status: Challenge["status"];
    visibility: Challenge["visibility"];
  };
  badges: Challenge["badges"];
  rules: Challenge["rules"];
  faqs: Challenge["faqs"];
  trainers: Array<{
    handle: string;
    realName: string | null;
    statusText: string | null;
    statusEmoji: string | null;
    reviveUsed: boolean;
    mainSquadLocked: boolean;
    earnedBadgeKeys: string[];
    pokemon: PokemonEntry[];
  }>;
};

export function buildChallengeExport(challenge: Challenge): ChallengeExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    challenge: {
      slug: challenge.slug,
      name: challenge.name,
      year: challenge.year,
      game: challenge.game,
      description: challenge.description,
      status: challenge.status,
      visibility: challenge.visibility,
    },
    badges: challenge.badges,
    rules: challenge.rules,
    faqs: challenge.faqs,
    trainers: challenge.trainers.map((t) => ({
      handle: t.handle,
      realName: t.realName,
      statusText: t.statusText,
      statusEmoji: t.statusEmoji,
      reviveUsed: t.reviveUsed,
      mainSquadLocked: t.mainSquadLocked,
      earnedBadgeKeys: t.earnedBadgeKeys,
      pokemon: t.pokemon,
    })),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function trainerLabel(t: TrainerProfile): string {
  return t.realName ? `${t.handle} (${t.realName})` : t.handle;
}

/** Flat CSV: one row per Pokémon (plus empty trainer rows with no Pokémon). */
export function buildChallengeCsv(challenge: Challenge): string {
  const header = [
    "trainer",
    "slot",
    "partyIndex",
    "nickname",
    "species",
    "pokedexId",
    "shiny",
    "level",
    "types",
    "nature",
    "ability",
    "heldItem",
    "catchRoute",
    "moves",
    "causeOfDeath",
    "earnedBadges",
    "reviveUsed",
    "mainSquadLocked",
    "statusText",
    "statusEmoji",
  ];

  const rows: string[][] = [header];

  for (const trainer of challenge.trainers) {
    const badges = trainer.earnedBadgeKeys.join("|");
    const mons =
      trainer.pokemon.length > 0
        ? trainer.pokemon
        : [null as PokemonEntry | null];

    for (const mon of mons) {
      rows.push([
        trainerLabel(trainer),
        mon?.slot ?? "",
        mon ? String(mon.partyIndex) : "",
        mon?.nickname ?? "",
        mon?.species ?? "",
        mon?.pokedexId != null ? String(mon.pokedexId) : "",
        mon ? (mon.isShiny ? "yes" : "no") : "",
        mon?.level != null ? String(mon.level) : "",
        mon?.types.join("/") ?? "",
        mon?.nature ?? "",
        mon?.ability ?? "",
        mon?.heldItem ?? "",
        mon?.catchRoute ?? "",
        mon?.moves.join("|") ?? "",
        mon?.causeOfDeath ?? "",
        badges,
        trainer.reviveUsed ? "yes" : "no",
        trainer.mainSquadLocked ? "yes" : "no",
        trainer.statusText ?? "",
        trainer.statusEmoji ?? "",
      ]);
    }
  }

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
