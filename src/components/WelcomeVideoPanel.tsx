import type { WelcomeVideoEmbed } from "@/lib/welcome-video";

type WelcomeVideoPanelProps = {
  className?: string;
  /** Pre-resolved embed from the server (null = locked or unset). */
  embed: WelcomeVideoEmbed | null;
  /** Shown when the video exists but is not yet public for this viewer. */
  lockedMessage?: string | null;
  /** Direct Google Drive (or other) link shown under the embed when unlocked. */
  fallbackUrl?: string | null;
};

/** Shared Jason (@Oubori) welcome video / placeholder embed. */
export function WelcomeVideoPanel({
  className = "",
  embed,
  lockedMessage = null,
  fallbackUrl = null,
}: WelcomeVideoPanelProps) {
  return (
    <div className={className}>
      <div className="relative aspect-video overflow-hidden rounded-lg border border-frame bg-surface-2">
        {embed?.kind === "iframe" ? (
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
              {lockedMessage ?? (
                <>Video coming soon — check back here once it&apos;s ready.</>
              )}
            </p>
          </div>
        )}
      </div>
      {embed && fallbackUrl && (
        <p className="mt-2 text-sm text-muted">
          Issues loading the embed?{" "}
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-accent-deep underline-offset-2 hover:underline"
          >
            Open video →
          </a>
        </p>
      )}
    </div>
  );
}
