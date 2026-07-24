"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  resolveTheme,
  toggleTheme,
  type Theme,
} from "@/lib/theme";

type UserMenuProps = {
  name: string;
  image: string | null;
  signOutAction: () => Promise<void>;
};

export function UserMenu({ name, image, signOutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "dark" ? "dark" : "light";
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onSystemThemeChange() {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        return;
      }
      const next = resolveTheme();
      applyTheme(next);
      setTheme(next);
    }
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onToggleTheme() {
    setTheme((current) => toggleTheme(current));
  }

  const themeLabel = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="pressable inline-flex h-9 items-center gap-2 bg-surface px-2 text-sm font-medium"
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-sm border-2 border-frame bg-surface-2">
          {image ? (
            <Image
              src={image}
              alt=""
              width={20}
              height={20}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="hidden max-w-32 truncate md:inline">{name}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="gba-frame absolute right-0 z-30 mt-1 w-52 overflow-hidden"
        >
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/15"
            onClick={() => setOpen(false)}
          >
            <ProfileIcon />
            My Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-accent/15"
            onClick={onToggleTheme}
            aria-label={`Switch to ${themeLabel.toLowerCase()}`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            {themeLabel}
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-accent/15"
            >
              <SignOutIcon />
              Sign Out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-accent-deep"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="10" cy="7" r="3.25" />
      <path d="M4.5 16.5c1.2-2.4 3.1-3.5 5.5-3.5s4.3 1.1 5.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-accent-deep"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M8 4H4.5A1.5 1.5 0 003 5.5v9A1.5 1.5 0 004.5 16H8" strokeLinecap="round" />
      <path d="M11 10h6M14 7l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-accent-deep"
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
      className="h-4 w-4 text-accent-deep"
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
