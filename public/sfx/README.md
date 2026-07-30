# Sound effects assets

Synthetic WAV one-shots used by `src/features/fx`.

## General

| File | Used by |
|------|---------|
| `catch.wav` | Catch logged |
| `shiny.wav` | Shiny catch |
| `death.wav` | Memorial / death |
| `badge.wav` | Badge earn fallback (unknown key) |
| `revive.wav` | Revive used |
| `wipe.wav` | Wipe / restart |
| `lock.wav` | Main squad locked |
| `champion.wav` | Championship / tournament win |
| `join.wav` | Member joined |
| `success.wav` | Generic UI success / badge revoke |
| `error.wav` | Generic UI error |

## Per-badge earn (`badges/`)

Themed by Hoenn gym / Elite type identity. Mapped in `badge-sfx.ts`.

| File | Badge | Theme |
|------|-------|-------|
| `gym-1.wav` | Stone | Rock / gravel |
| `gym-2.wav` | Knuckle | Fighting / punch |
| `gym-3.wav` | Dynamo | Electric / zap |
| `gym-4.wav` | Heat | Fire / crackle |
| `gym-5.wav` | Balance | Normal / resolve |
| `gym-6.wav` | Feather | Flying / air |
| `gym-7.wav` | Mind | Psychic / shimmer |
| `gym-8.wav` | Rain | Water / drip |
| `elite-1.wav` | Sidney | Dark |
| `elite-2.wav` | Phoebe | Ghost |
| `elite-3.wav` | Glacia | Ice |
| `elite-4.wav` | Drake | Dragon |
| `championship.wav` | Champion | Fanfare |

Missing files fail silently. Master volume is user-controlled via FX prefs.
