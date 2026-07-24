# Nuzlocke Manager — Master Plan

A multiplayer Nuzlocke tracker for friend groups, replacing the shared spreadsheet workflow (rules, FAQ, trainer summary, per-trainer boards) with a Vercel-hosted Next.js app.

**Reference spreadsheet:** [TrashPack Nuzlocke Challenge](https://docs.google.com/spreadsheets/d/1b8WdFyNuToOaq_MBda4lSZXGqaj36VbC)

---

## 1. Product vision

Help a fixed friend group run group Nuzlocke seasons (e.g. Trash Pack 2026) with:

- Transparent live trainer boards (status, badges, squads, graveyard)
- Clear roles: **Player** vs **Game Master**
- Year-over-year challenge archives
- Automatic Pokémon + trainer sprites
- Endgame support for the “Main Squad ladder tournament” after Champion

---

## 2. Spreadsheet → app mapping

| Spreadsheet | App surface |
|---|---|
| Introduction | Challenge rules / home intro (`/challenges/[slug]`) |
| FAQ | Challenge FAQ (`/challenges/[slug]/faq`) |
| Trainers Summary | Live lobby / overview grid |
| Per-trainer tabs (Oubori, Chedda, …) | Trainer board (`/challenges/[slug]/trainers/[id]`) |
| Index (types, gym badges) | Seeded reference data + UI helpers |
| Database (sprites) | Sprite service (PokeAPI + Showdown CDN) |

### Trainer board fields (parity)

- Display name + real name (e.g. `Jawn (John)`)
- Trainer avatar (Showdown trainer sprite URL / picker)
- Revive token used / available
- Free-text status (“what you’re currently doing”)
- Badge progress: Gym 1–8, Elite Four 1–4, Championship
- **Main Squad** (up to 6) — locked after Champion for tournament
- **Reserves** (unlimited rows of party-sized groups)
- **R.I.P. / Graveyard** — species, nickname, level, cause of death

### Pokémon card fields

Nickname, species (supports forms + `(Shiny) Name`), typing, nature, level, ability, catch route, held item, 4 moves.

---

## 3. Roles & auth

| Role | Capabilities |
|---|---|
| **Guest** | Read public challenge pages (configurable) |
| **Player** | Edit own trainer board; edit own account (display name, avatar, bio) |
| **Game Master** | Full CRUD: challenges, rules, FAQ, all trainers, badges, force-lock Main Squad, invite/remove players, role assignment |
| **Admin** (optional future) | Multi-group / platform admin |

**Auth approach (planned):** Auth.js (NextAuth) with Discord (friend-group friendly) + optional email magic link. Session JWT; role stored on `User` / `ChallengeMembership`.

Invite flow: GM creates challenge → invite codes or Discord IDs → players claim a trainer slot.

---

## 4. Core domain model

```
User
  └── ChallengeMembership (role: PLAYER | GAME_MASTER)
        └── Challenge (year/slug, game, rules, status)
              ├── ChallengeRule / FaqEntry
              ├── BadgeDefinition (ordered gym/elite/champ slots)
              ├── TrainerProfile (per challenge)
              │     ├── BadgeProgress
              │     ├── PokemonEntry[] (MAIN | RESERVE | GRAVEYARD)
              │     └── ActivityEvent[]
              └── Tournament (optional, post-champion ladder)
```

Challenges are first-class: `2026-trash-pack`, `2027-…`, each with its own roster, ruleset, and archive state (`DRAFT` → `ACTIVE` → `TOURNAMENT` → `ARCHIVED`).

---

## 5. Feature roadmap

### Phase 0 — Scaffold (this commit)

- Next.js App Router + TypeScript + Tailwind
- Prisma schema + Postgres (Vercel Postgres / Neon)
- Docs, env template, placeholder UI shell

### Phase 1 — Read-only MVP

- Challenge home (rules + FAQ)
- Trainers summary grid
- Trainer board view with sprite rendering
- Seed data for types / Emerald-style badge labels

### Phase 2 — Auth & editing

- Login + account settings
- Player self-edit of board (status, Pokémon CRUD, badges, revive token)
- GM dashboard (all trainers, rules, memberships)
- Optimistic UI + validation (Zod)

### Phase 3 — Challenge history & ops

- Multi-challenge archive / year switcher
- Activity feed (catches, deaths, badge clears, revive used)
- Main Squad lock after Champion
- Soft tournament bracket stub

### Phase 4 — QoL

- Pokémon species autocomplete (forms: `Nidoran-M`, `Basculin-Blue-Striped`)
- Shiny toggle / `(Shiny)` parsing parity
- Route encounter ledger (first-encounter claim / failed)
- Duplicate clause & held-item uniqueness warnings
- Death timeline + shared memorial wall
- Discord webhook notifications (deaths, badge clears)
- Mobile-first board editing
- Export JSON / CSV backup of a challenge
- Compare trainers side-by-side
- Type chart quick-ref on board
- Dark/light themed “trainer card” aesthetic (non-generic)

---

## 6. Sprites & assets (free / open)

| Asset | Source | Notes |
|---|---|---|
| Pokémon sprites | [PokeAPI sprites](https://github.com/PokeAPI/sprites) / Showdown Dex | CDN URLs by species slug; shiny variants |
| Species metadata | [PokeAPI](https://pokeapi.co) | Types, abilities, learnsets (cache aggressively) |
| Trainer avatars | [Pokemon Showdown trainer sprites](https://play.pokemonshowdown.com/sprites/trainers/) | Matches current spreadsheet URLs |
| Type icons / colors | Local seed + CSS tokens | From Index sheet palette |

Never hotlink without caching strategy; prefer proxy or cached public CDN paths + local fallbacks.

---

## 7. Tech stack (Vercel-ready)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| DB | PostgreSQL via Prisma 7 |
| Hosting | Vercel |
| Auth | Auth.js (Phase 2) |
| Validation | Zod |
| Images | `next/image` + remotePatterns for sprite CDNs |

---

## 8. App routes (target)

```
/                          → Landing / challenge picker
/login                     → Auth
/account                   → Player account editing
/challenges                → List (active + archives)
/challenges/[slug]         → Rules + summary
/challenges/[slug]/faq     → FAQ
/challenges/[slug]/feed    → Activity feed
/challenges/[slug]/trainers/[trainerId] → Board
/challenges/[slug]/gm      → Game Master console
/challenges/[slug]/tournament → Ladder (post-champ)
```

---

## 9. Success metrics (friend-group)

- Players update boards without asking “where do I edit?”
- GM can stand up a new annual challenge in minutes
- Deaths and badge progress are visible to the whole group the same day
- 2026 season remains readable after 2027 starts

---

## 10. Out of scope (initially)

- Full battle simulator
- Automated ROM/save parsing
- Public multi-tenant SaaS billing
- Real-time CRDT collaborative editing (simple refresh / polling is enough at first)
