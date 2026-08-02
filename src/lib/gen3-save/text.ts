/**
 * Western Gen 3 name text (pret pokeemerald charmap + Bulbapedia name-input set).
 *
 * Covers every codepoint the naming screen can enter in English, plus Western
 * accented letters and German umlauts (0xF1–0xF6) that are legal in names.
 * A single unmapped nickname byte used to empty/`reject` a mon and discard the
 * whole party window — keep this table complete for name fields.
 */
const GEN3_NAME_CHAR: Record<number, string> = {
  0x00: " ",
  0x01: "À",
  0x02: "Á",
  0x03: "Â",
  0x04: "Ç",
  0x05: "È",
  0x06: "É",
  0x07: "Ê",
  0x08: "Ë",
  0x09: "Ì",
  0x0b: "Î",
  0x0c: "Ï",
  0x0d: "Ò",
  0x0e: "Ó",
  0x0f: "Ô",
  0x10: "Œ",
  0x11: "Ù",
  0x12: "Ú",
  0x13: "Û",
  0x14: "Ñ",
  0x15: "ß",
  0x16: "à",
  0x17: "á",
  0x19: "ç",
  0x1a: "è",
  0x1b: "é",
  0x1c: "ê",
  0x1d: "ë",
  0x1e: "ì",
  0x20: "î",
  0x21: "ï",
  0x22: "ò",
  0x23: "ó",
  0x24: "ô",
  0x25: "œ",
  0x26: "ù",
  0x27: "ú",
  0x28: "û",
  0x29: "ñ",
  0x2a: "º",
  0x2b: "ª",
  0x2d: "&",
  0x2e: "+",
  0xab: "!",
  0xac: "?",
  0xad: ".",
  0xae: "-",
  0xb0: "…",
  0xb1: "“",
  0xb2: "”",
  0xb3: "‘",
  0xb4: "'",
  0xb5: "♂",
  0xb6: "♀",
  0xb8: ",",
  0xb9: "×",
  0xba: "/",
  0xf1: "Ä",
  0xf2: "Ö",
  0xf3: "Ü",
  0xf4: "ä",
  0xf5: "ö",
  0xf6: "ü",
};
for (let i = 0; i < 10; i++) GEN3_NAME_CHAR[0xa1 + i] = String(i);
for (let i = 0; i < 26; i++) {
  GEN3_NAME_CHAR[0xbb + i] = String.fromCharCode(65 + i);
  GEN3_NAME_CHAR[0xd5 + i] = String.fromCharCode(97 + i);
}

/** English naming-screen symbol row (plus space / letters / digits covered above). */
export const GEN3_ENGLISH_NICK_SYMBOL_BYTES = [
  0x00, // space
  0xad, // .
  0xb8, // ,
  0xab, // !
  0xac, // ?
  0xb5, // ♂
  0xb6, // ♀
  0xba, // /
  0xae, // -
  0xb0, // …
  0xb1, // “
  0xb2, // ”
  0xb3, // ‘
  0xb4, // '
] as const;

/**
 * Decode a Gen 3 nickname / OT / player-name field.
 * Returns null if any byte before 0xFF is outside the Western name alphabet.
 */
export function decodeGen3Name(bytes: Uint8Array): string | null {
  let out = "";
  for (const b of bytes) {
    if (b === 0xff) break;
    const ch = GEN3_NAME_CHAR[b];
    if (ch === undefined) return null;
    out += ch;
  }
  return out.trim();
}

/** Encode a short name string to Gen 3 bytes (tests / fixtures only). */
export function encodeGen3NameForTest(text: string, length: number): Uint8Array {
  const inverse = new Map<string, number>();
  for (const [code, ch] of Object.entries(GEN3_NAME_CHAR)) {
    const n = Number(code);
    // Prefer the canonical space at 0x00 over any later aliases.
    if (!inverse.has(ch)) inverse.set(ch, n);
  }
  const out = new Uint8Array(length);
  out.fill(0xff);
  let i = 0;
  for (const ch of text) {
    if (i >= length) {
      throw new Error(`test name too long for ${length}-byte field: ${JSON.stringify(text)}`);
    }
    const code = inverse.get(ch);
    if (code == null) throw new Error(`unencodable test char: ${JSON.stringify(ch)}`);
    out[i++] = code;
  }
  // Remainder stays 0xFF (terminator + pad), matching fixed Gen 3 name fields.
  return out;
}
