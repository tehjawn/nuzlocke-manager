import {
  HATCH_FALSE_FRIEND_ROUTES,
  HATCH_SAFE_OUTDOOR_ROUTES,
} from "@/data/catch-routes";

type HatchSafeSpotsNoteProps = {
  /** Extra class on the outer details. */
  className?: string;
  /**
   * When true, mention that wild remaps don’t change geography and gift egg
   * species may follow statics randomization (seed-parser / randomizer context).
   */
  randomizerContext?: boolean;
};

/**
 * Compact “where can I hatch without burning a wild slot?” note.
 * Labels come from the catch-route catalog (`egg-only` ∪ empty-encounter `static`).
 */
export function HatchSafeSpotsNote({
  className = "",
  randomizerContext = false,
}: HatchSafeSpotsNoteProps) {
  return (
    <details
      className={`group rounded-lg border border-frame/60 bg-surface px-3 py-1.5 text-xs text-muted ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-x-2 [&::-webkit-details-marker]:hidden">
        <span>
          <strong className="font-semibold text-ink">Safe hatch spots</strong>
          {" — "}
          no wild table (won’t burn a route slot)
        </span>
        <span className="ml-auto shrink-0 text-[0.65rem] font-semibold underline-offset-2 hover:underline">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="mt-1.5 space-y-2 border-t border-frame/40 pt-1.5 leading-relaxed">
        <p>
          <strong className="font-semibold text-ink">Indoors</strong> (Pokémon
          Centers, houses, marts) never roll wilds — classic safe hatch grind.
          Met location is still the parent town/city.
        </p>
        <p>
          <strong className="font-semibold text-ink">
            Outdoor, no wild table
          </strong>
          : {HATCH_SAFE_OUTDOOR_ROUTES.join(" · ")}.
        </p>
        <p>
          <strong className="font-semibold text-ink">
            Look like towns but aren’t safe outdoors
          </strong>
          {" — "}
          water/fishing tables: {HATCH_FALSE_FRIEND_ROUTES.join(" · ")}. Prefer
          a Center or a label above.
        </p>
        {randomizerContext && (
          <p>
            Wild remaps don’t add or remove tables — geography stays the same.
            Gift egg <em>species</em> may follow statics randomization; hatch{" "}
            <em>location</em> advice does not.
          </p>
        )}
      </div>
    </details>
  );
}
