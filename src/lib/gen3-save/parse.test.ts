import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { inflateSync, deflateSync } from "node:zlib";
import { parsePokemonSaveAsync } from "@/lib/gen3-save/parse";
import { encodeGen3NameForTest } from "@/lib/gen3-save/text";

const FIXTURE_114 = path.join(
  process.cwd(),
  "fixtures/gen3-save/issue-114-encounters.state",
);

const FIXTURE_117 = path.join(
  process.cwd(),
  "fixtures/gen3-save/issue-117-elite4.state",
);

const FIXTURE_PUNCT_NICK = path.join(
  process.cwd(),
  "fixtures/gen3-save/issue-party-punct-nick.state",
);

function inflateRzipEwram(buf: Uint8Array): {
  ewram: Uint8Array;
  header: Uint8Array;
} {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const totalSize = Number(view.getBigUint64(12, true));
  const parts: Uint8Array[] = [];
  let offset = 20;
  while (offset + 4 <= buf.length) {
    const compSize = view.getUint32(offset, true);
    offset += 4;
    if (compSize <= 0 || offset + compSize > buf.length) break;
    parts.push(inflateSync(buf.subarray(offset, offset + compSize)));
    offset += compSize;
    if (parts.reduce((n, p) => n + p.length, 0) >= totalSize) break;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { ewram: out.subarray(0, totalSize), header: buf.subarray(0, 20) };
}

function repackRzip(header: Uint8Array, ewram: Uint8Array): Uint8Array {
  const compressed = deflateSync(Buffer.from(ewram));
  const out = new Uint8Array(20 + 4 + compressed.length);
  out.set(header, 0);
  const dv = new DataView(out.buffer);
  dv.setBigUint64(12, BigInt(ewram.length), true);
  dv.setUint32(20, compressed.length, true);
  out.set(compressed, 24);
  return out;
}

function replaceAll(
  haystack: Uint8Array,
  target: Uint8Array,
  repl: Uint8Array,
): number {
  let hits = 0;
  for (let i = 0; i + target.length <= haystack.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (haystack[i + j] !== target[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    haystack.set(repl, i);
    hits += 1;
  }
  return hits;
}

test("Afterplay .state imports Pokédex seen-not-owned encounters (issue 114)", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_114));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.match(result.format, /RZIP|state/i);
  assert.equal(result.trainer?.name, "Zevin");
  assert.deepEqual(
    result.party.map((p) => p.species),
    ["Bagon", "Combusken", "Sableye", "Gastly", "Delcatty", "Scyther"],
  );

  const encountered = new Set(result.encountered.map((p) => p.species));
  // Mid-run Nuzlocke: many seen-not-owned (this fixture has 41). The old
  // owned+40 cap rejected the real dex pair (11 owned / 52 seen).
  assert.ok(
    result.encountered.length >= 35,
    `expected many encounter stubs, got ${result.encountered.length}`,
  );
  for (const name of [
    "Sandshrew",
    "Tentacool",
    "Omanyte",
    "Hoothoot",
    "Lotad",
  ]) {
    assert.ok(encountered.has(name), `missing encounter stub: ${name}`);
  }

  // Caught mons must not also appear as encounter stubs.
  for (const name of ["Bagon", "Combusken", "Scyther", "Voltorb"]) {
    assert.ok(!encountered.has(name), `caught mon leaked into encounters: ${name}`);
  }
});

test("Elite 4 Afterplay .state imports Pokédex encounters (issue 117)", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_117));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.match(result.format, /RZIP|state/i);
  assert.equal(result.trainer?.name, "Chedda");
  assert.deepEqual(
    result.party.map((p) => p.species),
    [
      "Annihilape",
      "Swalot",
      "Luvdisc",
      "Electivire",
      "Tangrowth",
      "Salamence",
    ],
  );
  assert.ok(result.box.length >= 20, `expected PC mons, got ${result.box.length}`);
  assert.ok(result.rip.length >= 10, `expected R.I.P., got ${result.rip.length}`);

  // Late-game: owned slack / seen−owned delta used to reject the real pair
  // (75 owned / 255 seen → 0 Encountered stubs).
  assert.ok(
    result.encountered.length >= 150,
    `expected many late-game encounter stubs, got ${result.encountered.length}`,
  );
  assert.ok(
    result.warnings.some((w) => /Pokédex:.*255 seen.*75 owned/i.test(w)),
    `expected EWRAM dex pair warning, got: ${result.warnings.join(" | ")}`,
  );

  const encountered = new Set(result.encountered.map((p) => p.species));
  for (const name of result.party.map((p) => p.species)) {
    assert.ok(
      !encountered.has(name),
      `caught party mon leaked into encounters: ${name}`,
    );
  }
});

test("party survives nicknames with Gen 3 spaces and punctuation", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_PUNCT_NICK));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Regression: a trailing "Oo oo,a a!" nick used to fail tryParseMon and
  // discard the entire 6-slot party window (leaving a stale 1-mon ghost).
  assert.deepEqual(
    result.party.map((p) => [p.species, p.nickname, p.level]),
    [
      ["Mawile", "On God", 32],
      ["Bagon", "Bagondeez", 16],
      ["Absol", "Lysol", 15],
      ["Exeggcute", "ScrambleMe", 15],
      ["Oddish", "Snoop", 18],
      ["Aipom", "Oo oo,a a!", 15],
    ],
  );
  assert.equal(result.badges.reliable, true);
  assert.deepEqual(result.badges.earnedKeys, ["gym-1", "gym-2", "gym-3"]);
  assert.ok(result.encountered.length >= 50);
});

test("box / PC Pokémon derive level from experience (issue 135)", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_PUNCT_NICK));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(result.box.length >= 5, `expected PC mons, got ${result.box.length}`);
  const missing = result.box.filter((p) => p.level == null);
  assert.equal(
    missing.length,
    0,
    `box mons missing derived level: ${missing.map((p) => p.species).join(", ")}`,
  );
  // Spot-check a known reserve from this fixture.
  const ledian = result.box.find((p) => p.species === "Ledian");
  assert.ok(ledian);
  assert.equal(ledian.level, 21);
  // Party still prefers the trailer byte (not re-derived).
  assert.equal(result.party[0]?.level, 32);
});

test("decrypts Pokédollars from Afterplay .state (issue 146)", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_PUNCT_NICK));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.money.reliable, true);
  assert.equal(result.money.amount, 52070);

  const early = await parsePokemonSaveAsync(
    new Uint8Array(readFileSync(FIXTURE_114)),
  );
  assert.equal(early.ok, true);
  if (!early.ok) return;
  assert.equal(early.money.reliable, true);
  assert.equal(early.money.amount, 18196);
});

test("party survives nicknames with ♂♀ and Western accents", async () => {
  const raw = new Uint8Array(readFileSync(FIXTURE_PUNCT_NICK));
  const { header } = inflateRzipEwram(raw);
  const oldNick = encodeGen3NameForTest("Oo oo,a a!", 10);
  // Fixed 10-byte nickname field (terminator only if nick is shorter than 10).
  assert.deepEqual(
    [...oldNick],
    [0xc9, 0xe3, 0x00, 0xe3, 0xe3, 0xb8, 0xd5, 0x00, 0xd5, 0xab],
  );

  for (const nick of ["♂♀!?/-…", "Éclair", "ÄÖÜmäd", "Íâí"]) {
    const { ewram: copy } = inflateRzipEwram(raw);
    const repl = encodeGen3NameForTest(nick, 10);
    assert.ok(
      replaceAll(copy, oldNick, repl) >= 1,
      `expected to patch nick to ${nick}`,
    );
    const result = await parsePokemonSaveAsync(repackRzip(header, copy));
    assert.equal(result.ok, true, `import failed for nick ${nick}`);
    if (!result.ok) return;
    assert.equal(result.party.length, 6, `party collapsed for nick ${nick}`);
    assert.equal(result.party[5]?.species, "Aipom");
    assert.equal(result.party[5]?.nickname, nick);
  }
});

test("accented OT / trainer names survive save import", async () => {
  const raw = new Uint8Array(readFileSync(FIXTURE_114));
  const { header } = inflateRzipEwram(raw);
  // Party OT is 7 bytes; SB2 playerName is 8 (same prefix + 0xFF pad).
  const oldTrainer = encodeGen3NameForTest("Zevin", 7);

  for (const name of ["Éclair", "ÄÖÜmäd", "Íâí"]) {
    const { ewram: copy } = inflateRzipEwram(raw);
    const repl = encodeGen3NameForTest(name, 7);
    assert.ok(
      replaceAll(copy, oldTrainer, repl) >= 1,
      `expected to patch trainer to ${name}`,
    );
    const result = await parsePokemonSaveAsync(repackRzip(header, copy));
    assert.equal(result.ok, true, `import failed for trainer ${name}`);
    if (!result.ok) return;
    assert.equal(result.trainer?.name, name, `trainer mismatch for ${name}`);
    assert.equal(result.party.length, 6, `party collapsed for trainer ${name}`);
  }
});
