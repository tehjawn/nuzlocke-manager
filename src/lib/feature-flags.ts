/**
 * Lightweight feature flags (#300).
 *
 * Defaults are off. Enable via env (build-time for NEXT_PUBLIC_*) and optional
 * runtime overrides for local / preview QA without a redeploy:
 *
 *   NEXT_PUBLIC_FEATURE_AI_DRAWER=1
 *   ?ff=ai-drawer          → force on (persists cookie via persistFeatureFlagFromUrl)
 *   ?ff=-ai-drawer         → force off
 *   cookie ff-ai-drawer=1|0
 */

export type FeatureFlag = "ai-drawer";

const ENV_ON = new Set(["1", "true", "on", "yes"]);

function envEnabled(flag: FeatureFlag): boolean {
  switch (flag) {
    case "ai-drawer":
      return ENV_ON.has(
        (process.env.NEXT_PUBLIC_FEATURE_AI_DRAWER ?? "").trim().toLowerCase(),
      );
    default:
      return false;
  }
}

function cookieName(flag: FeatureFlag): string {
  return `ff-${flag}`;
}

function readCookie(flag: FeatureFlag): boolean | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${cookieName(flag)}=([01])(?:;|$)`),
    );
    if (!match) return null;
    return match[1] === "1";
  } catch {
    return null;
  }
}

function writeCookie(flag: FeatureFlag, on: boolean): void {
  try {
    document.cookie = `${cookieName(flag)}=${on ? "1" : "0"};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    // Private mode / cookie blocked.
  }
}

/** Build-time / SSR-safe default (env only). */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return envEnabled(flag);
}

/**
 * Resolve env + URL + cookie. Pure on the client aside from reading cookie/
 * location — do not call writers from React snapshot getters.
 */
export function resolveFeatureFlag(flag: FeatureFlag): boolean {
  if (typeof window === "undefined") return envEnabled(flag);

  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ff");
    if (raw === flag) return true;
    if (raw === `-${flag}`) return false;

    const cookie = readCookie(flag);
    if (cookie != null) return cookie;
  } catch {
    // Fall through to env.
  }

  return envEnabled(flag);
}

/**
 * Persist `?ff=` / `?ff=-` into a cookie so the choice survives navigations.
 * Call once from a client effect — not from render or store snapshots.
 */
export function persistFeatureFlagFromUrl(flag: FeatureFlag): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ff");
    if (raw === flag) writeCookie(flag, true);
    else if (raw === `-${flag}`) writeCookie(flag, false);
  } catch {
    // ignore
  }
}
