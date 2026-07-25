"use client";

import { useState } from "react";
import { toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "dark" ? "dark" : "light";
  });

  const nextLabel = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme((current) => toggleTheme(current))}
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode`}
      className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-frame bg-surface text-ink hover:border-interactive/50"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="10" cy="10" r="3.25" />
      <path
        d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M15.3 4.7l-1.1 1.1M5.8 14.2l-1.1 1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M12.5 3.2A6.5 6.5 0 1016.8 12 5.2 5.2 0 0112.5 3.2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
