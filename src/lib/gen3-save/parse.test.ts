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

test("party survives nicknames with ♂♀ and Western accents", async () => {
  const raw = new Uint8Array(readFileSync(FIXTURE_PUNCT_NICK));
  const { header } = inflateRzipEwram(raw);
  const oldNick = encodeGen3NameForTest("Oo oo,a a!", 10);
  // Fixed 10-byte nickname field (terminator only if nick is shorter than 10).
  assert.deepEqual(
    [...oldNick],
    [0xc9, 0xe3, 0x00, 0xe3, 0xe3, 0xb8, 0xd5, 0x00, 0xd5, 0xab],
  );

  for (const nick of ["♂♀!?/-…", "Éclair", "ÄÖÜmäd"]) {
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
