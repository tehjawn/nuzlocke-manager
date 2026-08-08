/**
 * GM console tab ids + `?tab=` deep-link parsing.
 * Kept server-safe so the GM page can resolve tabs without importing a client module.
 */

export const GM_CONSOLE_TABS = [
  "season",
  "roster",
  "analytics",
  "rules",
  "faq",
  "feedback",
  "ops",
] as const;

export type ConsoleTab = (typeof GM_CONSOLE_TABS)[number];

const CONSOLE_TAB_SET = new Set<string>(GM_CONSOLE_TABS);

/** Deep-link helper for `/gm?tab=` — unknown values fall back to Season. */
export function resolveGmConsoleTab(
  tab: string | undefined | null,
): ConsoleTab {
  if (tab && CONSOLE_TAB_SET.has(tab)) return tab as ConsoleTab;
  return "season";
}
