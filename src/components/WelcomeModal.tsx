"use client";

import { Modal } from "@/components/Modal";
import { CTA_PRIMARY } from "@/lib/cta";
import {
  getWelcomeVideoUrl,
  resolveWelcomeVideoEmbed,
} from "@/lib/welcome-video";

type WelcomeModalProps = {
  open: boolean;
  onDismiss: () => void;
};

export function WelcomeModal({ open, onDismiss }: WelcomeModalProps) {
  const embed = resolveWelcomeVideoEmbed(getWelcomeVideoUrl());

  return (
    <Modal
      open={open}
      title="Welcome to the Trash Pack 2026 Nuzlocke Challenge!"
      onClose={onDismiss}
      wide
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className={CTA_PRIMARY}
          >
            LFG!
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-frame bg-surface-2">
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
              <p className="text-sm font-medium text-ink">
                From Jason (@Oubori)
              </p>
              <p className="max-w-sm text-xs text-muted">
                Video coming soon — check back here once it&apos;s ready.
              </p>
            </div>
          )}
        </div>
        <p className="text-sm leading-relaxed text-ink/90">
          You&apos;re in for Season 2026. Fill out your trainer board, import a
          save when you&apos;re ready, and keep the Pack feed updated as you
          play. Death is permanent - but so are the memories.
        </p>
      </div>
    </Modal>
  );
}
