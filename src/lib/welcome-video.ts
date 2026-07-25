/** Optional welcome video for Trash Pack 2026 (YouTube or direct media URL). */
export function getWelcomeVideoUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL?.trim();
  return raw || null;
}

export type WelcomeVideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "video"; src: string };

/** Normalize a configured URL into an embeddable form. */
export function resolveWelcomeVideoEmbed(
  url: string | null | undefined,
): WelcomeVideoEmbed | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  const youtubeId = extractYoutubeId(trimmed);
  if (youtubeId) {
    return {
      kind: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
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

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") &&
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
