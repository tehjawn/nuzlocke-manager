"use client";

import {
  getWelcomeVideoUrl,
  resolveWelcomeVideoEmbed,
} from "@/lib/welcome-video";

type WelcomeVideoPanelProps = {
  className?: string;
};

/** Shared Jason (@Oubori) welcome video / placeholder embed. */
export function WelcomeVideoPanel({ className = "" }: WelcomeVideoPanelProps) {
  const embed = resolveWelcomeVideoEmbed(getWelcomeVideoUrl());

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-lg border border-frame bg-surface-2 ${className}`}
    >
      {embed?.kind === "youtube" ? (
        <iframe
          title="Welcome video from Jason (@Oubori)"
          src={embed.embedUrl}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : embed?.kind === "video" ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={embed.src}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Welcome video
          </span>
          <p className="text-sm font-medium text-ink">From Jason (@Oubori)</p>
          <p className="max-w-sm text-xs text-muted">
            Video coming soon — check back here once it&apos;s ready.
          </p>
        </div>
      )}
    </div>
  );
}
