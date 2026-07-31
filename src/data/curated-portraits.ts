/** Quick-pick trainer portraits shown above Browse / Add your own. */

export type CuratedPortraitOption = {
  key: string;
  label: string;
};

/**
 * Gen 1–4 protagonists (Showdown trainer keys). Browse still covers the
 * full catalog; this is just a fast starting set.
 */
export const CURATED_PORTRAITS: readonly CuratedPortraitOption[] = [
  { key: "red", label: "Red" },
  { key: "leaf-gen3", label: "Leaf" },
  { key: "ethan", label: "Ethan" },
  { key: "lyra", label: "Lyra" },
  { key: "brendan", label: "Brendan" },
  { key: "may", label: "May" },
  { key: "lucas", label: "Lucas" },
  { key: "dawn", label: "Dawn" },
] as const;

const KEY_SET = new Set(CURATED_PORTRAITS.map((p) => p.key));

export function isCuratedPortraitKey(value: unknown): boolean {
  return typeof value === "string" && KEY_SET.has(value);
}
