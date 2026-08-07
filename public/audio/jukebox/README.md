# Jukebox audio (#341)

Hoenn-vibe lofi loops for the left-rail `SeasonJukebox`.

## Tracks (v1)

| File | Title | Artist | Source |
|------|-------|--------|--------|
| `littleroot-town.m4a` | Littleroot Town | Feora, VGM Yume | [Gimi](https://gimi.media/audio/feora-vgm-yume-littleroot-town-pokemon-ruby-sapphire-lofi-free-audio) |
| `route-101.m4a` | Route 101 | Feora, VGM Yume | [Gimi](https://gimi.media/audio/feora-vgm-yume-route-101-pokeon-ruby-sapphire-lofi-free-audio) |
| `surf-theme.m4a` | Surf Theme | Feora, VGM Yume | [Gimi](https://gimi.media/audio/feora-vgm-yume-surf-theme-pokemon-ruby-sapphire-lofi-free-audio) |

License: [Gimi Media License](https://gimi.media/license) (commercial OK; attribution optional but credited in the player UI).

These are fan lofi arrangements of Gen 3 themes — not Nintendo OST rips. Re-encoded to AAC (~96 kbps) for lean hosting; originals were MP3 downloads from Gimi.

## Adding tracks

1. Drop an `.m4a` / `.mp3` here.
2. Append a row to `JUKEBOX_PLAYLIST` in `src/features/jukebox/playlist.ts` (title, artist, src, source URL, license).
