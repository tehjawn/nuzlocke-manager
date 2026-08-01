"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { GmIcon, PreferencesIcon } from "@/components/nav-icons";

type UserMenuProps = {
  name: string;
  image: string | null;
  signOutAction: () => Promise<void>;
  /** When set, show a GM console link in the profile menu (desktop). */
  gmHref?: string | null;
};

export function UserMenu({
  name,
  image,
  signOutAction,
  gmHref = null,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="pressable inline-flex h-9 items-center gap-2 bg-surface px-2 text-sm font-medium"
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-lg border border-frame bg-surface-2">
          {image ? (
            <Image
              src={image}
              alt=""
              width={24}
              height={24}
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
        <div className="absolute top-full right-0 z-50 pt-1">
          <div
            id={menuId}
            role="menu"
            className="gba-frame gba-frame-menu w-52 overflow-hidden"
          >
            <Link
              href="/account"
              role="menuitem"
              className="relative z-[1] flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/15"
              onClick={() => setOpen(false)}
            >
              <ProfileIcon />
              My Profile
            </Link>
            <Link
              className="relative z-[1] flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/15"
              href="/preferences"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <PreferencesIcon className="h-4 w-4 text-accent-deep" />
              Preferences
            </Link>
            {gmHref ? (
              <Link
                href={gmHref}
                role="menuitem"
                className="relative z-[1] flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/15"
                onClick={() => setOpen(false)}
              >
                <GmIcon className="h-4 w-4 text-accent-deep" />
                GM
              </Link>
            ) : null}
            <form action={signOutAction} className="relative z-[1]">
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
