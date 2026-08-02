import type { PokemonType } from "@/lib/pokemon-types";
import { TYPE_COLORS, typeBadgeInk } from "@/lib/pokemon-types";

type TypeBadgeProps = {
  type: PokemonType;
  /** Denser badge for move chips / tight layouts. */
  size?: "sm" | "md";
};

export function TypeBadge({ type, size = "md" }: TypeBadgeProps) {
  const sm = size === "sm";
  return (
    <span
      className={`inline-block rounded-lg border border-black/25 font-bold tracking-wide uppercase ${
        sm ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-1.5 py-0.5 text-[10px]"
      }`}
      style={{
        backgroundColor: TYPE_COLORS[type],
        color: typeBadgeInk(type),
      }}
    >
      {type}
    </span>
  );
}
