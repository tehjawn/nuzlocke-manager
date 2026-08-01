/**
 * Smoke-test Modern Emerald saves through the production parser.
 * Usage: npx tsx scripts/test-modern-save.ts [path]
 */
import { readFileSync } from "node:fs";
import { parsePokemonSaveAsync } from "../src/lib/gen3-save/parse";

async function main() {
  const path =
    process.argv[2] ?? `${process.env.HOME}/Downloads/revive_token_true.ss0`;
  const buf = new Uint8Array(readFileSync(path));
  const result = await parsePokemonSaveAsync(buf);
  if (!result.ok) {
    console.error(result);
    process.exit(1);
  }

  const all = [
    ...result.party,
    ...result.box,
    ...result.rip,
    ...result.encountered,
  ];
  console.log(`File: ${path}`);
  console.log(`Format: ${result.format}`);
  console.log("Party:", result.party.map((p) => p.species).join(", ") || "(none)");
  console.log("Box:", result.box.map((p) => p.species).join(", ") || "(none)");
  console.log("R.I.P.:", result.rip.map((p) => p.species).join(", ") || "(none)");
  if (result.revive) {
    console.log(
      `Revive: used=${result.revive.used} remaining=${result.revive.remaining} reliable=${result.revive.reliable}`,
    );
  }
  for (const w of result.warnings) console.log("Warning:", w);

  if (path.includes("revive_token")) {
    const pooch = all.find(
      (p) => p.pokedexId === 261 || p.species === "Poochyena",
    );
    if (!pooch) {
      console.error("FAIL: expected Poochyena (species 286 → national 261)");
      process.exit(1);
    }
    if (pooch.species !== "Poochyena") {
      console.error("FAIL: Poochyena mislabeled as", pooch.species);
      process.exit(1);
    }
    console.log(
      "OK: Poochyena remapped correctly (would have been Breloom as national 286)",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
