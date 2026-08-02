import type { PokemonEntry } from "@/lib/challenge-types";
import { PokemonSlotCard } from "@/components/PokemonSlotCard";

type PartyStripProps = {
  pokemon: PokemonEntry[];
  /** When set, always render this many slots (empty fillers included). */
  slots?: number;
  size?: "sm" | "md";
  memorial?: boolean;
  /** Encounter ledger: sprite + species name + dex #. */
  speciesOnly?: boolean;
  /** Select a filled slot (edit or view details). */
  onSelect?: (pokemon: PokemonEntry) => void;
  /** Soft hint under species when slots are selectable. */
  selectHint?: string;
  /** Edit mode: select an empty numbered slot (MAIN uses this). */
  onSelectEmpty?: (partyIndex: number) => void;
  /** Forwarded to slot cards — hide nature/ability/stats/moves when false. */
  showCompetitiveDetails?: boolean;
};

export function PartyStrip({
  pokemon,
  slots,
  size = "md",
  memorial = false,
  speciesOnly = false,
  onSelect,
  selectHint,
  onSelectEmpty,
  showCompetitiveDetails = true,
}: PartyStripProps) {
  const sorted = [...pokemon].sort((a, b) => a.partyIndex - b.partyIndex);

  const display: (PokemonEntry | null)[] = slots
    ? Array.from({ length: slots }, (_, i) => {
        return sorted.find((p) => p.partyIndex === i) ?? null;
      })
    : sorted;

  return (
    <div
      className={`grid items-start gap-2 ${
        speciesOnly
          ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8"
          : size === "sm"
            ? "grid-cols-3 sm:grid-cols-6"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {(display.length > 0 ? display : [null]).map((p, i) => (
        <div key={p?.id ?? `empty-${i}`} className="h-full min-h-0">
          <PokemonSlotCard
            pokemon={p}
            size={speciesOnly ? "sm" : size}
            memorial={memorial}
            speciesOnly={speciesOnly}
            showCompetitiveDetails={showCompetitiveDetails}
            selectHint={
              p && onSelect && !speciesOnly ? selectHint : undefined
            }
            onSelect={
              p && onSelect
                ? () => onSelect(p)
                : !p && onSelectEmpty && slots
                  ? () => onSelectEmpty(i)
                  : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
