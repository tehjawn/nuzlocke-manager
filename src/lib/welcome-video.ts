/** Optional welcome video for Trash Pack 2026 (YouTube, Google Drive, or direct media). */
export function getWelcomeVideoUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL?.trim();
  return raw || null;
}

/** Default public unlock: 9:00 PM Eastern, Jul 31 2026. GMs can override per season. */
export const WELCOME_VIDEO_DEFAULT_PUBLISH_AT = new Date(
  "2026-07-31T21:00:00-04:00",
);

/** @deprecated Use WELCOME_VIDEO_DEFAULT_PUBLISH_AT */
export const WELCOME_VIDEO_PUBLIC_AT = WELCOME_VIDEO_DEFAULT_PUBLISH_AT;

const EASTERN_TZ = "America/New_York";

/** Resolve the effective publish time (DB value or default). */
export function resolveWelcomeVideoPublishAt(
  publishAt: Date | string | null | undefined,
): Date {
  if (publishAt instanceof Date && !Number.isNaN(publishAt.getTime())) {
    return publishAt;
  }
  if (typeof publishAt === "string" && publishAt.trim()) {
    const parsed = new Date(publishAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return WELCOME_VIDEO_DEFAULT_PUBLISH_AT;
}

/**
 * Who can see the welcome video:
 * - GMs always (preview)
 * - Everyone once now >= the season's publish-at (default 9pm Eastern tonight)
 */
export function canViewWelcomeVideo(
  isGm: boolean,
  publishAt?: Date | string | null,
  now: Date = new Date(),
): boolean {
  return isGm || now.getTime() >= resolveWelcomeVideoPublishAt(publishAt).getTime();
}

/** `datetime-local` value in America/New_York for GM console inputs. */
export function toEasternDatetimeLocalInput(
  publishAt: Date | string | null | undefined,
): string {
  const date = resolveWelcomeVideoPublishAt(publishAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Parse a `datetime-local` string as America/New_York wall time.
 * Tries EDT (-04:00) and EST (-05:00) and keeps the one that round-trips.
 */
export function fromEasternDatetimeLocalInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return null;

  for (const offset of ["-04:00", "-05:00"] as const) {
    const candidate = new Date(`${trimmed}:00${offset}`);
    if (Number.isNaN(candidate.getTime())) continue;
    if (toEasternDatetimeLocalInput(candidate) === trimmed) return candidate;
  }

  // Fallback: assume EDT (correct for Jul 31 2026).
  const fallback = new Date(`${trimmed}:00-04:00`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Short Eastern-time label for locked-state copy. */
export function formatWelcomeVideoPublishAtEastern(
  publishAt: Date | string | null | undefined,
): string {
  const date = resolveWelcomeVideoPublishAt(publishAt);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export type WelcomeVideoEmbed =
  | { kind: "iframe"; embedUrl: string }
  | { kind: "video"; src: string };

/** Normalize a configured URL into an embeddable form. */
export function resolveWelcomeVideoEmbed(
  url: string | null | undefined,
): WelcomeVideoEmbed | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  const youtubeId = extractYoutubeId(trimmed);
  if (youtubeId) {
    // Prefer 1080p when the YouTube player allows it.
    return {
      kind: "iframe",
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&vq=hd1080&hd=1`,
    };
  }

  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    // Drive's preview player picks quality itself — no public param to force 1080p.
    return {
      kind: "iframe",
      embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
    };
  }

  return { kind: "video", src: trimmed };
}

function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "embed" ||
          parts[0] === "shorts" ||
          parts[0] === "live") &&
        parts[1]
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

function extractGoogleDriveId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "drive.google.com" && host !== "docs.google.com") {
      return null;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    // /file/d/<id>/view|/preview|/edit
    const fileIdx = parts.indexOf("d");
    if (parts[0] === "file" && fileIdx === 1 && parts[2]) {
      return parts[2];
    }

    const openId = parsed.searchParams.get("id");
    if (openId) return openId;
  } catch {
    return null;
  }
  return null;
}
