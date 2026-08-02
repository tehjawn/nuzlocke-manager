import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeGen3Name,
  encodeGen3NameForTest,
  GEN3_ENGLISH_NICK_SYMBOL_BYTES,
} from "@/lib/gen3-save/text";

test("decodeGen3Name accepts English naming-screen symbols including ♂♀", () => {
  for (const code of GEN3_ENGLISH_NICK_SYMBOL_BYTES) {
    const bytes = Uint8Array.from([0xbb, code, 0xff]); // "A" + symbol
    const decoded = decodeGen3Name(bytes);
    assert.ok(decoded, `expected decode for 0x${code.toString(16)}`);
    assert.ok(decoded!.startsWith("A"));
    assert.ok(decoded!.length >= 1 && decoded!.length <= 2);
  }

  assert.equal(decodeGen3Name(Uint8Array.from([0xb5, 0xb6, 0xff])), "♂♀");
  assert.equal(
    decodeGen3Name(Uint8Array.from([0xc9, 0xe3, 0x00, 0xe3, 0xe3, 0xb8, 0xd5, 0x00, 0xd5, 0xab, 0xff])),
    "Oo oo,a a!",
  );
});

test("decodeGen3Name accepts Western accents and German umlauts", () => {
  assert.equal(decodeGen3Name(Uint8Array.from([0x06, 0xff])), "É");
  assert.equal(decodeGen3Name(Uint8Array.from([0x1b, 0xd5, 0xff])), "éa");
  assert.equal(decodeGen3Name(Uint8Array.from([0xf1, 0xf2, 0xf3, 0xff])), "ÄÖÜ");
  assert.equal(decodeGen3Name(Uint8Array.from([0xf4, 0xf5, 0xf6, 0xff])), "äöü");
  assert.equal(decodeGen3Name(Uint8Array.from([0x14, 0xd5, 0xff])), "Ña");
});

test("decodeGen3Name rejects unmapped / control bytes instead of stripping them", () => {
  assert.equal(decodeGen3Name(Uint8Array.from([0x7f, 0xff])), null);
  assert.equal(decodeGen3Name(Uint8Array.from([0xfc, 0x01, 0xff])), null);
  assert.equal(decodeGen3Name(Uint8Array.from([0xbb, 0x50, 0xff])), null);
  assert.equal(decodeGen3Name(Uint8Array.from([0xff])), "");
});

test("encodeGen3NameForTest round-trips naming-screen punctuation", () => {
  const samples = ["On God", "Oo oo,a a!", "♂♀!?/-…", "Éclair", "ÄÖÜ"];
  for (const s of samples) {
    const bytes = encodeGen3NameForTest(s, 10);
    assert.equal(decodeGen3Name(bytes), s);
  }
});
