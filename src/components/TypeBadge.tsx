import type { PokemonType } from "@/lib/pokemon-types";
import { TYPE_COLORS, typeBadgeInk } from "@/lib/pokemon-types";

type TypeBadgeProps = {
  type: PokemonType;
  /** Denser badge for move chips / tight layouts. */
  size?: "sm" | "md";
  /**
   * `solid` — classic filled type pill (boards, Pokédex).
   * `soft` — guide-style wash chip (Required / Gym prep language).
   */
  variant?: "solid" | "soft";
};

/** Soft chip styles aligned with Game Guide step tags. */
export function typeBadgeSoftStyle(typeColor: string): {
  borderColor: string;
  backgroundColor: string;
  color: string;
} {
  return {
    // Match Required / Gym prep: light wash + tinted border + readable ink.
    borderColor: `color-mix(in srgb, ${typeColor} 40%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${typeColor} 12%, transparent)`,
    // Pull type hue toward theme ink so pastel types stay legible on both themes.
    color: `color-mix(in srgb, ${typeColor} 58%, var(--ink))`,
  };
}

export function TypeBadge({
  type,
  size = "md",
  variant = "solid",
}: TypeBadgeProps) {
  const sm = size === "sm";
  const fill = TYPE_COLORS[type];

  if (variant === "soft") {
    return (
      <span
        className={`inline-block rounded-full border font-semibold tracking-tight uppercase ${
          sm
            ? "px-1.5 py-px text-[0.65rem] leading-tight"
            : "px-2 py-0.5 text-[0.7rem] leading-tight"
        }`}
        style={typeBadgeSoftStyle(fill)}
      >
        {type}
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-lg border border-black/25 font-bold tracking-wide uppercase ${
        sm
          ? "px-1.5 py-0.5 text-[10px] leading-tight"
          : "px-1.5 py-0.5 text-[10px]"
      }`}
      style={{
        backgroundColor: fill,
        color: typeBadgeInk(type),
      }}
    >
      {type}
    </span>
  );
}
