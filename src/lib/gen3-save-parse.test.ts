import assert from "node:assert/strict";
import test from "node:test";
import { parsePokemonSave } from "@/lib/gen3-save/parse";

const EWRAM_SIZE = 0x40000;
const PARTY_MON_SIZE = 100;

test("imports state encounters when seen exceeds owned by 41 species", () => {
  const ewram = new Uint8Array(EWRAM_SIZE);
  ewram.set(createPartyMon(395, "Bagon"), 0x4000);

  const ownedBase = 0x12000;
  const seenBase = ownedBase + 58;
  setDexBit(ewram, ownedBase, 371);
  setDexBit(ewram, seenBase, 371);
  for (let speciesId = 1; speciesId <= 41; speciesId++) {
    setDexBit(ewram, seenBase, speciesId);
  }

  const result = parsePokemonSave(ewram);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.party.map((pokemon) => pokemon.species),
    ["Bagon"],
  );
  assert.equal(result.encountered.length, 41, result.warnings.join("\n"));
  assert.equal(result.encountered[0]?.species, "Bulbasaur");
});

function createPartyMon(speciesId: number, nickname: string): Uint8Array {
  const mon = new Uint8Array(PARTY_MON_SIZE);
  const view = new DataView(mon.buffer);
  const pid = 24;
  view.setUint32(0, pid, true);
  mon.set(encodeGen3Text(nickname, 10), 8);
  mon[18] = 2;

  const decrypted = new Uint8Array(48);
  const decryptedView = new DataView(decrypted.buffer);
  decryptedView.setUint16(0, speciesId, true);

  let checksum = 0;
  for (let offset = 0; offset < decrypted.length; offset += 2) {
    checksum = (checksum + decryptedView.getUint16(offset, true)) & 0xffff;
  }
  view.setUint16(28, checksum, true);
  for (let offset = 0; offset < decrypted.length; offset += 4) {
    view.setUint32(
      32 + offset,
      (decryptedView.getUint32(offset, true) ^ pid) >>> 0,
      true,
    );
  }

  mon[84] = 7;
  view.setUint16(86, 20, true);
  view.setUint16(88, 20, true);
  return mon;
}

function encodeGen3Text(value: string, length: number): Uint8Array {
  const encoded = new Uint8Array(length).fill(0xff);
  for (let i = 0; i < Math.min(value.length, length); i++) {
    const code = value.charCodeAt(i);
    encoded[i] =
      code >= 65 && code <= 90 ? 0xbb + code - 65 : 0xd5 + code - 97;
  }
  return encoded;
}

function setDexBit(bytes: Uint8Array, base: number, speciesId: number): void {
  const bit = speciesId - 1;
  bytes[base + (bit >> 3)]! |= 1 << (bit & 7);
}
