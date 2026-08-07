/**
 * Left-rail jukebox playlist (#341).
 *
 * These are Feora / VGM Yume Gen 3 lofi arrangements hosted under the
 * [Gimi Media License](https://gimi.media/license) (commercial use OK;
 * attribution optional but encouraged). They are still derivative of Nintendo /
 * Game Freak compositions — ship as ambient BGM with credit, not as “OST.”
 */

export type JukeboxTrack = {
  id: string;
  title: string;
  artist: string;
  /** Public URL under `/audio/jukebox/`. */
  src: string;
  /** Source page for the download / listing. */
  sourceUrl: string;
  /** Human-readable license label. */
  license: string;
  /** License deed URL. */
  licenseUrl: string;
};

export const JUKEBOX_PLAYLIST: readonly JukeboxTrack[] = [
  {
    id: "littleroot-town",
    title: "Littleroot Town",
    artist: "Feora, VGM Yume",
    src: "/audio/jukebox/littleroot-town.m4a",
    sourceUrl:
      "https://gimi.media/audio/feora-vgm-yume-littleroot-town-pokemon-ruby-sapphire-lofi-free-audio",
    license: "Gimi Media License",
    licenseUrl: "https://gimi.media/license",
  },
  {
    id: "route-101",
    title: "Route 101",
    artist: "Feora, VGM Yume",
    src: "/audio/jukebox/route-101.m4a",
    sourceUrl:
      "https://gimi.media/audio/feora-vgm-yume-route-101-pokeon-ruby-sapphire-lofi-free-audio",
    license: "Gimi Media License",
    licenseUrl: "https://gimi.media/license",
  },
  {
    id: "surf-theme",
    title: "Surf Theme",
    artist: "Feora, VGM Yume",
    src: "/audio/jukebox/surf-theme.m4a",
    sourceUrl:
      "https://gimi.media/audio/feora-vgm-yume-surf-theme-pokemon-ruby-sapphire-lofi-free-audio",
    license: "Gimi Media License",
    licenseUrl: "https://gimi.media/license",
  },
] as const;

export function clampTrackIndex(index: number): number {
  const len = JUKEBOX_PLAYLIST.length;
  if (len === 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return ((Math.trunc(index) % len) + len) % len;
}
