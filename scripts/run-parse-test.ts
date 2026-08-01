import { readFileSync } from "node:fs";
import { parsePokemonSaveAsync } from "../src/lib/gen3-save/parse";

type Expect = {
  reviveUsed: boolean;
  badges: number;
  party: { species: string; nick: string | null }[];
  box: { species: string; nick: string | null }[];
  rip: { species: string; nick: string | null }[];
  /** Must appear in encountered (seen-not-owned may include extras). */
  encounteredIncludes: string[];
};

const FIXTURES: Record<string, Expect> = {
  "s1.ss0": {
    reviveUsed: false,
    badges: 0,
    party: [{ species: "Nidorina", nick: "A" }],
    box: [{ species: "Spheal", nick: "A" }],
    rip: [{ species: "Diglett", nick: "F" }],
    encounteredIncludes: ["Zigzagoon"],
  },
  "revive_token_false.ss0": {
    reviveUsed: true,
    badges: 0,
    party: [
      { species: "Nidorina", nick: "A" },
      { species: "Diglett", nick: "F" },
    ],
    box: [{ species: "Spheal", nick: "A" }],
    rip: [],
    encounteredIncludes: ["Zigzagoon"],
  },
};

function summarize(list: { species: string; pokedexId: number; nickname: string | null; level: number | null }[]) {
  return list.map((p) => ({
    species: p.species,
    id: p.pokedexId,
    nick: p.nickname,
    level: p.level,
  }));
}

function matchMons(
  got: { species: string; nickname: string | null }[],
  expect: { species: string; nick: string | null }[],
  label: string,
): string[] {
  const errs: string[] = [];
  if (got.length !== expect.length) {
    errs.push(
      `${label}: expected ${expect.length} got ${got.length} (${got.map((g) => g.species).join(", ")})`,
    );
  }
  for (let i = 0; i < expect.length; i++) {
    const g = got[i];
    const e = expect[i]!;
    if (!g || g.species !== e.species || g.nickname !== e.nick) {
      errs.push(
        `${label}[${i}]: expected ${e.species}/${e.nick} got ${g?.species}/${g?.nickname}`,
      );
    }
  }
  return errs;
}

async function main() {
  const file =
    process.argv[2] ?? `${process.env.HOME}/Downloads/s1.ss0`;
  const buf = new Uint8Array(readFileSync(file));
  const result = await parsePokemonSaveAsync(buf);
  if (!result.ok) {
    console.error(result);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        format: result.format,
        warnings: result.warnings,
        trainer: result.trainer,
        badges: result.badges,
        revive: result.revive,
        party: summarize(result.party),
        box: summarize(result.box),
        rip: summarize(result.rip),
        encountered: result.encountered.length,
        encounteredSample: summarize(result.encountered.slice(0, 12)),
      },
      null,
      2,
    ),
  );

  const base = file.split("/").pop() ?? "";
  const expect = FIXTURES[base];
  if (!expect) {
    console.log(`(no fixture expectations for ${base})`);
    return;
  }

  const errs: string[] = [];
  if (!result.revive.reliable) errs.push("revive not reliable");
  if (result.revive.used !== expect.reviveUsed) {
    errs.push(
      `revive.used expected ${expect.reviveUsed} got ${result.revive.used}`,
    );
  }
  if (!result.badges.reliable) errs.push("badges not reliable");
  if (result.badges.earnedKeys.length !== expect.badges) {
    errs.push(
      `badges expected ${expect.badges} got ${result.badges.earnedKeys.length}`,
    );
  }
  errs.push(...matchMons(result.party, expect.party, "party"));
  errs.push(...matchMons(result.box, expect.box, "box"));
  errs.push(...matchMons(result.rip, expect.rip, "rip"));
  for (const name of expect.encounteredIncludes) {
    if (!result.encountered.some((e) => e.species === name)) {
      errs.push(`encountered missing ${name}`);
    }
  }

  if (errs.length) {
    console.error("FAIL:\n" + errs.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }
  console.log(`OK: ${base} matches ground truth`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
