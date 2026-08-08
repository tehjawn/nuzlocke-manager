import { catchMapHref } from "@/lib/tools-routes";

/**
 * @deprecated Prefer `catchMapHref` — Encounters ModeTabs (`?view=`) were
 * removed; Catch Map is map-only under Tools.
 */
export function encountersHref(slug: string, _view?: string): string {
  return catchMapHref(slug);
}
