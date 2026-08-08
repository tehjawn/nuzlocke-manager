# Sprites

## Vendored Showdown assets (trainers + item icons)

Trainer portraits and item icons are checked into `public/sprites/` so the UI
does not hit the `/api/sprites` proxy (Vercel egress + function invokes).

- Individuals: `public/sprites/trainers/*.png`, `public/sprites/itemicons/*.png`
- Atlases: `public/sprites/atlases/{trainers,itemicons}.webp` + JSON maps
- Importable maps: `src/data/sprite-atlases/*.json`
- UI: `ItemAtlasIcon` / `TrainerAtlasIcon` (dense grids); individuals via
  `heldItemSpriteUrl` / `trainerSpriteUrl` for portraits and search thumbnails

Regenerate after Showdown adds sprites:

```bash
npm run data:sprites
```

Source: [Pokémon Showdown sprites](https://play.pokemonshowdown.com/sprites/).
Same attribution posture as the existing Showdown proxy.

## Still proxied

`/api/sprites` remains for animated GIFs (`ani` / `ani-shiny`) and rare gen5
name fallbacks when a Pokédex id is missing. Species stills prefer PokeAPI
GitHub raw URLs (not Vercel egress).
