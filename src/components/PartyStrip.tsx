import type { PokemonEntry } from "@/lib/challenge-types";
import { PokemonSlotCard } from "@/components/PokemonSlotCard";

type PartyStripProps = {
  pokemon: PokemonEntry[];
  /** When set, always render this many slots (empty fillers included). */
  slots?: number;
  size?: "sm" | "md";
  memorial?: boolean;
  /** Edit mode: select a filled slot to open the editor. */
  onSelect?: (pokemon: PokemonEntry) => void;
  /** Edit mode: select an empty numbered slot (MAIN uses this). */
  onSelectEmpty?: (partyIndex: number) => void;
};

export function PartyStrip({
  pokemon,
  slots,
  size = "md",
  memorial = false,
  onSelect,
  onSelectEmpty,
}: PartyStripProps) {
  const sorted = [...pokemon].sort((a, b) => a.partyIndex - b.partyIndex);

  const display: (PokemonEntry | null)[] = slots
    ? Array.from({ length: slots }, (_, i) => {
        return sorted.find((p) => p.partyIndex === i) ?? null;
      })
    : sorted;

  return (
    <div
      className={`grid gap-2 ${
        size === "sm"
          ? "grid-cols-3 sm:grid-cols-6"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {(display.length > 0 ? display : [null]).map((p, i) => (
        <PokemonSlotCard
          key={p?.id ?? `empty-${i}`}
          pokemon={p}
          size={size}
          memorial={memorial}
          onSelect={
            p && onSelect
              ? () => onSelect(p)
              : !p && onSelectEmpty && slots
                ? () => onSelectEmpty(i)
                : undefined
          }
        />
      ))}
    </div>
  );
}
