import type { PokemonType } from "@/lib/pokemon-types";
import { TYPE_COLORS } from "@/lib/pokemon-types";

type TypeBadgeProps = {
  type: PokemonType;
  /** Denser badge for move chips / tight layouts. */
  size?: "sm" | "md";
};

export function TypeBadge({ type, size = "md" }: TypeBadgeProps) {
  const sm = size === "sm";
  return (
    <span
      className={`inline-block rounded-lg border border-black/20 font-bold tracking-wide text-white uppercase ${
        sm ? "px-1 py-px text-[8px] leading-tight" : "px-1.5 py-0.5 text-[10px]"
      }`}
      style={{ backgroundColor: TYPE_COLORS[type] }}
    >
      {type}
    </span>
  );
}
