import { readFileSync } from "node:fs";
import { parsePokemonSaveAsync } from "../src/lib/gen3-save/parse";

async function main() {
  const file =
    process.argv[2] ?? `${process.env.HOME}/Downloads/revive_token_true.ss0`;
  const buf = new Uint8Array(readFileSync(file));
  const result = await parsePokemonSaveAsync(buf);
  if (!result.ok) {
    console.error(result);
    process.exit(1);
  }

  const summarize = (list: typeof result.party) =>
    list.map((p) => ({
      species: p.species,
      id: p.pokedexId,
      nick: p.nickname,
      level: p.level,
    }));

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
        encounteredSample: summarize(result.encountered.slice(0, 8)),
      },
      null,
      2,
    ),
  );

  const pooch = [
    ...result.party,
    ...result.box,
    ...result.rip,
    ...result.encountered,
  ].find((p) => p.species === "Poochyena" || p.pokedexId === 261);
  if (file.includes("revive_token")) {
    if (!pooch) {
      console.error("FAIL: Expected Poochyena in revive_token_true.ss0");
      process.exit(1);
    }
    if (pooch.species !== "Poochyena" || pooch.pokedexId !== 261) {
      console.error("FAIL: Poochyena mislabeled:", pooch);
      process.exit(1);
    }
    console.log("OK: Poochyena → national 261 in", pooch.category);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
