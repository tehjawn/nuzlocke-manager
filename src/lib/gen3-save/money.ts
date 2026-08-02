/**
 * Gen 3 Pokédollars: SaveBlock1.money is XOR-encrypted with
 * SaveBlock2.encryptionKey (pret GetMoney / SetMoney).
 * Modern Emerald stores that key at SB2+0xBC (vanilla/Crest: +0xAC).
 */

import { MAX_MONEY } from "./layout";

/** Decrypt wallet; null when outside the Gen 3 0…999_999 range. */
export function decryptGen3Money(
  encrypted: number,
  encryptionKey: number,
): number | null {
  const amount =
    (Math.trunc(encrypted) ^ Math.trunc(encryptionKey)) >>> 0;
  if (amount > MAX_MONEY) return null;
  return amount;
}

export function formatPokedollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
