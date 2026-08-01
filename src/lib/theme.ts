export const THEME_STORAGE_KEY = "nuzlocke-theme";
export const THEME_CHANGE_EVENT = "nuzlocke-theme-change";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function isThemePreference(
  value: string | null | undefined,
): value is ThemePreference {
  return isTheme(value) || value === "system";
}

export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // private mode / blocked storage
  }
  return "system";
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: Theme,
): Theme {
  return preference === "system" ? systemTheme : preference;
}

/** Resolve the stored light, dark, or system preference. */
export function resolveTheme(): Theme {
  return resolveThemePreference(getThemePreference(), getSystemTheme());
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

/** Read the theme currently applied on `<html>` (post init-script). */
export function getAppliedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function notifyThemeListeners() {
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Persist a light, dark, or system preference and apply its resolved theme. */
export function setThemePreference(preference: ThemePreference) {
  const theme = resolveThemePreference(preference, getSystemTheme());
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // ignore write failures
  }
  notifyThemeListeners();
  return theme;
}

/** Persist an explicit theme choice and apply it. */
export function setStoredTheme(theme: Theme) {
  setThemePreference(theme);
}

/** Apply the resolved preference without changing the stored choice. */
export function ensureStoredTheme(): Theme {
  const theme = resolveTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === "dark" ? "light" : "dark";
  setStoredTheme(next);
  return next;
}

/**
 * Subscribe to theme changes (same-tab toggles + other-tab storage writes).
 * For use with `useSyncExternalStore`.
 */
export function subscribeTheme(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    const preference = isThemePreference(event.newValue)
      ? event.newValue
      : "system";
    const next = resolveThemePreference(preference, getSystemTheme());
    applyTheme(next);
    onStoreChange();
  }
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  function onSystemThemeChange() {
    if (getThemePreference() !== "system") return;
    applyTheme(getSystemTheme());
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  systemTheme.addEventListener("change", onSystemThemeChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    systemTheme.removeEventListener("change", onSystemThemeChange);
  };
}

/**
 * Inline script: resolve light, dark, or system and apply it before first paint.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k);var t=p==="light"||p==="dark"?p:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t}catch(e){}})();`;
