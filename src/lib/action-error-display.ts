/**
 * Client-safe UI guard for action error strings.
 * Keep Prisma / Zod out of this module so client components can import it.
 */

const UI_OVERFLOW_HINT =
  "Something went wrong saving — try again. If it keeps happening, contact a GM.";

/**
 * Client-side guardrail when an action forgot to sanitize.
 * Truncates framework dumps so modals never wallpaper with Prisma text.
 */
export function displayActionError(error: string): string {
  const trimmed = error.trim();
  if (
    trimmed.length > 200 ||
    /Invalid `\w|Unknown argument|Available options are marked/i.test(trimmed)
  ) {
    console.error("[action-error:ui]", trimmed);
    return UI_OVERFLOW_HINT;
  }
  return trimmed;
}
