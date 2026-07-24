export const THEME_STORAGE_KEY = "nuzlocke-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Resolve stored preference, falling back to the OS setting. */
export function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // private mode / blocked storage
  }
  return getSystemTheme();
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

/** Persist an explicit choice and apply it. */
export function setStoredTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore write failures
  }
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === "dark" ? "light" : "dark";
  setStoredTheme(next);
  return next;
}

/** Inline script: apply theme before first paint to avoid a flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t}catch(e){}})();`;
