"use client";

import Image from "next/image";
import { useState } from "react";
import { AvatarBrowser } from "@/components/AvatarBrowser";
import { CustomAvatarModal } from "@/components/CustomAvatarModal";
import { avatarImageClassName, avatarImageUrl } from "@/lib/sprites";

type AvatarPickerProps = {
  value: string;
  onChange: (avatarSpriteKey: string) => void;
};

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.5 1.5 14.5 4.5 5.75 13.25 2.5 13.5l.25-3.25L11.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 3 13 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrowseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="2.5"
        y="9"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="9"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ImportIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 7 8 9.5 10.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-label="Browse avatars"
        title="Browse avatars"
        className="group relative shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => setBrowseOpen(true)}
      >
        <Image
          key={value}
          src={avatarImageUrl(value)}
          alt=""
          width={72}
          height={72}
          className={`${avatarImageClassName(value, "h-[72px] w-[72px]")} rounded-lg border border-frame bg-surface-2 p-1`}
          unoptimized
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <PencilIcon />
        </span>
      </button>

      <div className="flex min-w-0 flex-col gap-2">
        <button
          type="button"
          className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface px-3 py-2 text-left text-xs font-semibold tracking-tight"
          onClick={() => setBrowseOpen(true)}
        >
          <BrowseIcon className="h-3.5 w-3.5 shrink-0 text-ink/70" />
          Browse Avatars
        </button>
        <button
          type="button"
          className="pressable inline-flex items-center gap-2 rounded-lg border border-frame bg-surface-2 px-3 py-2 text-left text-xs font-semibold tracking-tight text-muted"
          onClick={() => setImportOpen(true)}
        >
          <ImportIcon className="h-3.5 w-3.5 shrink-0" />
          Import Custom Avatar
        </button>
      </div>

      <AvatarBrowser
        open={browseOpen}
        value={value}
        onClose={() => setBrowseOpen(false)}
        onSelect={(key) => {
          onChange(key);
          setBrowseOpen(false);
        }}
      />
      <CustomAvatarModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSelect={(key) => {
          onChange(key);
          setImportOpen(false);
        }}
      />
    </div>
  );
}
