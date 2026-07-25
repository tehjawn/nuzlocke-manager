import type { PokemonType } from "@/lib/pokemon-types";
import { TYPE_COLORS } from "@/lib/pokemon-types";

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <span
      className="inline-block rounded-xl border border-black/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
      style={{ backgroundColor: TYPE_COLORS[type] }}
    >
      {type}
    </span>
  );
}
