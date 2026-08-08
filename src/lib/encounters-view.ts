export type EncounterView = "claims" | "map" | "missing" | "routes";

const VIEWS = new Set<EncounterView>(["claims", "map", "missing", "routes"]);

/** Resolve `?view=` for the Encounters ModeTabs, with a sensible default. */
export function parseEncounterView(
  raw: string | null | undefined,
  myTrainerId?: string | null,
): EncounterView {
  if (raw && VIEWS.has(raw as EncounterView)) return raw as EncounterView;
  return myTrainerId ? "routes" : "claims";
}

export function encountersHref(slug: string, view?: EncounterView): string {
  const base = `/challenges/${slug}/encounters`;
  return view ? `${base}?view=${view}` : base;
}
