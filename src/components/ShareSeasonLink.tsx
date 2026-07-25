"use client";

import { useState } from "react";
import type { ChallengeVisibility } from "@/lib/challenge-types";

type ShareSeasonLinkProps = {
  slug: string;
  visibility: ChallengeVisibility;
};

export function ShareSeasonLink({ slug, visibility }: ShareSeasonLinkProps) {
  const [copied, setCopied] = useState(false);

  const canShare = visibility === "PUBLIC" || visibility === "UNLISTED";
  const label =
    visibility === "PUBLIC"
      ? "Public season link"
      : visibility === "UNLISTED"
        ? "Unlisted season link"
        : "Invite-only season";

  async function copyLink() {
    const url = `${window.location.origin}/challenges/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this season link:", url);
    }
  }

  return (
    <div className="rounded-lg border border-frame bg-surface-2/60 px-3 py-2.5">
      <p className="text-xs font-semibold tracking-tight text-muted">{label}</p>
      {canShare ? (
        <button
          type="button"
          className="pressable mt-2 inline-flex w-full items-center justify-center rounded-lg border-frame bg-surface px-3 py-2 text-sm font-semibold hover:border-interactive/50"
          onClick={() => void copyLink()}
        >
          {copied ? "Copied!" : "Copy share link"}
        </button>
      ) : (
        <p className="mt-1 text-xs text-muted">
          Share the invite code from the GM console so friends can join.
        </p>
      )}
    </div>
  );
}