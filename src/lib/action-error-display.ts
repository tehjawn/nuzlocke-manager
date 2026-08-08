/**
 * Client-safe UI guard for action error strings.
 * Keep Prisma / Zod out of this module so client components can import it.
 */

const UI_OVERFLOW_HINT =
  "Something went wrong saving — try again. If it keeps happening, contact a GM.";

/** Default success / info snackbar lifetime. */
export const SNACKBAR_DURATION_DEFAULT_MS = 3200;
/** Ordinary action errors — long enough to read once. */
export const SNACKBAR_DURATION_ERROR_MS = 8000;
/**
 * Instructional errors (schema / retry / contact GM) — linger so the user can
 * finish reading + act; still auto-dismisses and is manually dismissable.
 */
export const SNACKBAR_DURATION_STICKY_MS = 14000;

/**
 * Pick a snackbar lifetime from tone + message. Callers may still pass an
 * explicit duration to `pushSnackbar` to override.
 */
export function snackbarDurationMs(
  message: string,
  tone: "success" | "error" | "info" = "success",
): number {
  if (tone !== "error") return SNACKBAR_DURATION_DEFAULT_MS;
  if (
    /database schema|run migrations|please retry|try again|contact a GM|out of date/i.test(
      message,
    )
  ) {
    return SNACKBAR_DURATION_STICKY_MS;
  }
  return SNACKBAR_DURATION_ERROR_MS;
}

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
