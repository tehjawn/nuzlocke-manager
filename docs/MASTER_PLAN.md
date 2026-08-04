# Nuzlocke Manager — Master Plan

A multiplayer Nuzlocke **ops board** for a friend group: seasons, trainer boards, graves, badges, and Game Master tools — replacing the Trash Pack spreadsheet with a warm, Gen 3–flavored web app on Vercel.

**Status (Jul 2026):** Phases 0–4 shipped. Phase 5 in progress: season ops polish (archive UX, invite wall, welcome video, tournament advance).

**Reference spreadsheet:** [TrashPack Nuzlocke Challenge](https://docs.google.com/spreadsheets/d/1b8WdFyNuToOaq_MBda4lSZXGqaj36VbC)

**Repo:** [tehjawn/nuzlocke-manager](https://github.com/tehjawn/nuzlocke-manager)

---

## 0. Audit summary (what changed vs. v1)

| Finding | Adjustment |
|---|---|
| Plan listed features but no **product differentiation** | Explicitly position vs solo encounter trackers (see §2) |
| Design was an afterthought (“Phase 4 aesthetic”) | Design system is a **first-class pillar** (§4); UI ships looking Gen 3–warm from Phase 1 |
| Dark “modern dashboard” scaffold drifts from the brief | Target palette is **warm, blocky, nostalgic** — not cyberpunk glass |
| `Tournament` mentioned but absent from schema | Add tournament / bracket as a Phase 3 domain object |
| Encounter ledger + type chart compete with dedicated solo tools | Keep as **light QoL**, not core; don’t rebuild Nuzlify |
| Mobile editing buried in Phase 4 | Trainer board must be **phone-usable by Phase 2** (people update mid-session) |
| Activity feed attached only via actors | Events should also optionally reference a `trainerId` for board timelines |
| Auth/privacy underspecified | Default **invite-gated** challenges; public read is opt-in |
| Success metrics were soft | Add concrete “spreadsheet retirement” criteria (§11) |
| Inspiration not named | Documented in §1 so design/feature choices stay grounded |

---

## 1. Sources of inspiration

These are the reference points for product and feel — not features to clone wholesale.

### Product & community

1. **Trash Pack spreadsheet (primary)** — Rules intro, FAQ, trainers summary, per-trainer boards (status, revive token, badges, Main / Reserves / R.I.P.). The app must feel like a *better spreadsheet*, not a different hobby.
2. **Creator / VTuber group Nuzlockes** — Parallel runs, public grief/hype, nickname culture, “who’s ahead on badges?” spectating. Boards should be glanceable for the group Discord, not only for the player editing them.
3. **Solo web trackers** ([Nuzlocke Tracker](https://nuzlocketracker.org/), [Nuzlocke Redux](https://nuzlockeredux.com/), [Nuzlify](https://nuzlify.com/)) — Best-in-class for **route encounters, boss scouting, damage calc**. We borrow *clarity of logging* and graveyard seriousness; we do **not** try to own deep prep tooling.
4. **Pokémon Showdown** — Practical sprite CDN, trainer avatars already used in the sheet, functional (not ornamental) UI discipline.
5. **Classic Nuzlocke comic / forum culture** — Nicknames, cause-of-death stories, memorial tone. The graveyard is emotional product, not a trash bin.

### Visual & UX

6. **Pokémon Ruby / Sapphire / Emerald (Gen 3) UI** — Menu windows with chunky borders, party select rows, summary screens, soft overworld warmth (Littleroot / Petalburg energy), badge case, PokéNav-era information density without clutter.
7. **Gen 3 battle / party chrome (translated to CSS)** — Thick outer frames, inset panels, clear “slot” grids for six Pokémon, simple status strips — updated for responsive layout and accessibility.
8. **Modern “retro-informed” product design** — Chunkiness + nostalgia without illegible pure-pixel body text, without skeuomorphic overload, without dashboard chrome. Think: few surfaces, strong hierarchy, tactile buttons; skip glassmorphism, infinite scroll feeds, and floating promo chips.

---

## 2. Product vision & positioning

### One-liner

**The shared season board for Trash Pack’s Nuzlocke run** — who is alive, who’s dead, who’s got which badge, and what’s happening this week.

### Who it’s for

A fixed friend group (≈4–12 players) + 1–2 Game Masters running annual seasons (Trash Pack 2026 → 2027 → …).

### What we are / aren’t

| We are | We aren’t |
|---|---|
| Multiplayer social tracker + archive | Solo encounter meta / damage calculator |
| Spreadsheet replacement with roles | Public SaaS for every Nuzlocker on earth |
| Spectator-friendly boards | Twitch overlay product (maybe later) |
| Gen 3–warm, blocky, fun | “AI SaaS” dark dashboard |

### North-star loop

1. Player catches / faints / clears a gym  
2. Updates board in under a minute (phone OK)  
3. Group sees it on summary + feed  
4. Season ends → Main Squad locks → optional ladder  
5. Year closes → archive stays readable forever  

---

## 3. Spreadsheet → app mapping

| Spreadsheet | App surface |
|---|---|
| Introduction | Challenge home: rules + season framing |
| FAQ | Challenge FAQ |
| Trainers Summary | **League board** (primary hub) |
| Per-trainer tabs | Trainer board |
| Index (types / gym names) | Seeded reference data + UI tokens |
| Database (sprites) | Sprite service (PokeAPI + Showdown) |

### Trainer board fields (parity)

- Handle + real name (`Jawn (John)`)
- Trainer avatar (Showdown trainer sprite key)
- Revive token (available / spent) — highly visible, GM can reset
- Status blurb (“where I am in the run”)
- Badge case: Gym 1–8, Elite 1–4, Championship (configurable per challenge/game)
- **Main Squad** (6) — lockable after Champion for the ladder
- **Reserves** (multiple party-sized groups; not capped like the sheet’s visual rows)
- **R.I.P.** — nickname, species, level, cause of death (story-first)

### Pokémon slot fields

Nickname, species (forms + shiny), types, nature, level, ability, catch route, held item, up to 4 moves.

---

## 4. Design system — “Trash Pack board”

### Intent

Feel like opening a Gen 3 menu on a sunlit afternoon: **blocky, warm, nostalgic, readable**. Modern web underneath (responsive, accessible, fast) — without looking like a 2024 marketing site.

### Principles

1. **One job per screen** — League board, trainer board, rules, GM tools; no kitchen-sink dashboard.
2. **Chunky frames, not cards-everywhere** — Prefer inset “Game Boy Advance window” panels with thick borders over soft drop-shadow card grids.
3. **Party slots as the unit** — Pokémon live in a 1×6 (or wrapping) slot strip reminiscent of the Gen 3 party screen; graveyard uses a quieter memorial treatment.
4. **Warmth over neon** — Soft creams, leaf greens, wood browns, muted gold accents (badge sheen). Avoid purple glow, glass, and pure black cyber themes.
5. **Nostalgia without pain** — Display/heading type can be slightly blocky; body text stays highly legible (no tiny pixel fonts for paragraphs).
6. **Fun > fancy** — Few animations: badge “stamp,” faint fade-to-memorial, page wipe that nods at scene transitions. Honor `prefers-reduced-motion`.
7. **Phone-first editing** — Big tap targets, sticky save, species search that works with a thumb.

### Palette (CSS tokens — directional)

| Token | Role | Direction |
|---|---|---|
| `--bg` | Page wash | Warm parchment / soft sage (`#f3ead7` → light leaf wash) |
| `--surface` | Window fill | Cream / light wood (`#fff6e8`) |
| `--ink` | Primary text | Deep pine (`#1e2a24`) |
| `--muted` | Secondary text | Moss gray-green |
| `--frame` | Chunky border | Dark olive / wood |
| `--accent` | Primary actions | Emerald (`#3a8f5c`) |
| `--accent-2` | Highlights / badges | Warm gold |
| `--danger` | Faint / graveyard | Soft brick (not neon red) |
| `-- Rip` | Memorial wash | Cooler desaturated green-gray |

Dark mode is **optional later**; default is warm light (matches Gen 3 menus better than OLED dark).

### Typography

- **Display:** Slightly condensed, sturdy sans (blocky presence — e.g. something in the spirit of menu titles, not Comic Sans, not Inter-default).
- **Body:** Clean readable sans with generous line-height.
- **Mono (sparingly):** Levels, stats, route codes.

### Layout patterns

- **League board:** Trainers as framed “trainer cards” in a simple grid — avatar, status one-liner, badge pips, Main Squad mini-sprites. Not a metrics dashboard.
- **Trainer board:** Top identity strip (avatar, name, revive token, status) → badge case → Main Squad window → Reserves → R.I.P. memorial.
- **Rules / FAQ:** Text in framed panels; numbered rules like the sheet’s list, not accordion spam.
- **GM console:** Same visual language, denser forms — still framed windows, not admin-template sidebar hell.

### Interaction tone

- Buttons look pressable (border + inset), not pill-gradient CTAs.
- Empty slots show a faint Poké Ball outline / “—”, inviting fill.
- Deaths ask for a short cause-of-death; celebrate nicknames in the memorial.
- No floating badges, promo stickers, or hero-overlay chrome.

### Accessibility (modern baseline)

- Contrast AA on warm backgrounds
- Focus rings that fit the chunky UI
- Sprites always paired with text names
- Forms labeled; errors plain-language

---

## 5. Roles, auth & privacy

| Role | Capabilities |
|---|---|
| **Guest** | Sees PUBLIC / UNLISTED seasons freely; INVITE seasons require login + membership (Phase 5 wall) |
| **Player** | Edit own trainer board + account; read league |
| **Game Master** | Full CRUD: season setup, rules/FAQ, roster, all boards, revive resets, Main Squad lock, invites, roles |
| **Spectator member** (optional) | Read-only membership for friends who aren’t running |

**Auth:** Auth.js with **Discord**. For **PUBLIC** / **UNLISTED** seasons, login auto-creates a membership + personal trainer board (no invite/claim dance). **INVITE** seasons still require a code, then auto-create a board. **GM** elevation uses an optional GM invite code.

**Demo data:** Seed refreshes season meta (rules, FAQ, badges) only. Real players get their own board on Discord login — no showcase demo trainer.

**Privacy default:** Challenges can be invite-gated; Trash Pack 2026 ships **PUBLIC** for easy friend onboarding.

---

## 6. Domain model

```
User
  └── ChallengeMembership (PLAYER | GAME_MASTER | SPECTATOR)
        └── Challenge (slug, year, game, visibility, status)  // = season
              ├── ChallengeRule / FaqEntry
              ├── BadgeDefinition[]
              ├── TrainerProfile[]   // 1 claimed board per user per season
              │     ├── activeRun → TrainerRun (ACTIVE)
              │     ├── TrainerRun[] (1:many attempts; wipe closes + opens next)
              │     ├── BadgeProgress[]          // season board (resets on wipe)
              │     ├── PokemonEntry[]           // living = active run; GRAVEYARD accumulates
              │     │     runId?, diedOnRun?     // soft + FK attribution
              │     └── TrainerBoardSnapshot[]   // pre-wipe / import / GM reset
              ├── ActivityEvent[]  (actor + optional trainer)
              └── Tournament?      // ladder (trainer-scoped, not run-scoped)
```

**Season vs run:** A `Challenge` is the season. A `TrainerRun` is one Nuzlocke attempt on that board. Wipe closes the active run, memorializes living Main/Reserve into the season graveyard, and starts a new ACTIVE run. `wipeCount` stays as a denormalized closed-run counter (`active run number = wipeCount + 1`).

**Revive token** is **per-run**: spending it marks the active `TrainerRun` (mirrored on `TrainerProfile.reviveUsed`). Wipe archives that flag on the closed run and starts the next run with a fresh revive.

**Closed runs** store `earnedBadgeKeys` for career stats. Live badges still reset on wipe.

**Trainer history** consolidates runs (accordion) with nested board snapshots for that attempt.

**Challenge lifecycle:** `DRAFT` → `ACTIVE` → `TOURNAMENT` → `ARCHIVED`

**Main Squad lock:** GM can lock/unlock Main Squad for ladder use (manual only — no Championship auto-lock). Memorial / archived season view is Phase 3.

**Schema status:**

| Item | Status |
|---|---|
| `visibility` (`INVITE` \| `UNLISTED` \| `PUBLIC`) on `Challenge` | ✅ |
| Optional `trainerId` on `ActivityEvent` | ✅ |
| `mainSquadLocked` on `TrainerProfile` | ✅ (manual GM toggle) |
| `TrainerRun` + `activeRunId` + `PokemonEntry.runId` | ✅ |
| Partial unique `(challengeId, userId)` when claimed | ✅ |
| `ActivityReaction` (emoji reactions on feed) | ✅ (shipped QoL; not originally planned) |
| `Tournament` / `TournamentMatch` | ✅ stub + winner pick (Phase 3); round advance in Phase 5 |
| Soft `EncounterClaim` | Phase 4 — only if group wants route transparency without leaving the season board |
| Per-run badge archives (`TrainerRun.earnedBadgeKeys`) | ✅ |
| Browse closed living boards | Later (snapshots cover history today) |

---

## 7. Feature roadmap

**Status (Jul 2026):** Phases 0–4 shipped. Next work is Phase 5.

### Phase 0 — Scaffold ✅

Next.js App Router, Prisma/Postgres, Zod stubs, sprite helpers, docs.

### Phase 1 — Read-only league MVP ✅

- Design tokens + framed layout shell (Trash Pack board look)
- Challenge home (rules + FAQ)
- League board (summary)
- Trainer board read view with sprites
- Seed Trash Pack 2026 structure (badges, rules/FAQ)
- Warm light theme as default

### Phase 2 — Auth & editing (spreadsheet retirement) ✅

- Discord login + auto-provision trainer boards on public seasons
- Account editing
- Player edits: status, revive token, badges, Pokémon CRUD (Main/Reserve/RIP)
- Species picker + shiny (national dex sprite browser; alternate formes not first-class)
- GM console (visibility, invites, rules/FAQ, Main Squad lock, unclaim)
- Mobile-usable edit flows (view/edit toggle + modals; further polish optional)
- Activity log on league hub (+ emoji reactions)
- Simplified join UX (no claim dance; `/me` shortcut)

### Phase 3 — Seasons & endgame ✅ (core)

Shipped:

1. **Memorial / end-of-season view** — `/memorial` + archive read-only boards (manual Main Squad lock)
2. **Export JSON/CSV** — GM console downloads
3. **Discord webhooks** — death, badge earned, revive used (GM-configured URL)
4. **Tournament bracket stub** — `Tournament` / `TournamentMatch` + `/tournament` seed UI

**Deferred / skipped:**

- Championship auto-lock (removed — GM lock/unlock is enough)
- Season duplicate / year switcher (ignore until 2027 setup)

### Phase 4 — QoL ✅

Shipped:

- Light route encounter ledger
- Duplicate / held-item warnings (soft UI, not rule enforcement)
- Side-by-side trainer compare (retired — Team Planner's vs Trainer mode covers it)
- Type chart quick-ref (Tools tab)
- Optional public share links
- Alternate formes in the species picker
- Sticky mobile save bar
- Soft dark theme (kept prior palette after brief dusk experiment)

**Shipped early (outside original phase order):** Afterplay / Gen 3 **save import** — categorizes party → Main, box → Reserves, fainted → R.I.P., post-party storage → Encountered; optional trainer name + gym badge sync. Crest-style `pid⊕otId` encryption + vanilla LCG both supported.

### Phase 5 — Season ops polish (current)

Close the half-built season-lifecycle gaps so testing → archive → next year stays clean:

1. **Archive-aware seasons list** — Active vs Archived sections; archived CTAs lean memorial-first
2. **INVITE guest login wall** — non-members cannot read invite-gated seasons; join/login required
3. **Welcome video embed** — replace placeholder in welcome modal when a video URL is configured
4. **Tournament advance** — when a round completes, seed the next round from winners (beyond pick-winner stub)

**Still deferred:** season duplicate / year switcher (2027 setup). Championship auto-lock stays out.

**Explicitly deprioritized:** damage calculator, full boss scouting DB, real-time CRDT, multi-tenant billing.

---

## 8. Sprites & assets (free / open)

| Asset | Source | Notes |
|---|---|---|
| Pokémon sprites | [PokeAPI sprites](https://github.com/PokeAPI/sprites), Showdown Dex | Prefer Gen 3–friendly static sprites for the board feel; shiny variants supported |
| Metadata | [PokeAPI](https://pokeapi.co) | Types/abilities; cache server-side |
| Trainer avatars | [Showdown trainers](https://play.pokemonshowdown.com/sprites/trainers/) | Matches spreadsheet habit |
| Type colors | Local tokens | Align with Index sheet + Gen 3 type hues |
| UI chrome | CSS only | Framed windows, badge pips — no copyrighted game UI rips |

Caching: `next/image` remotePatterns + optional proxy; always text fallback if CDN fails.

---

## 9. Tech stack (Vercel-ready)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS 4 + CSS design tokens (Trash Pack board) |
| DB | PostgreSQL via Prisma 7 (+ `@prisma/adapter-pg`) |
| Hosting | Vercel |
| Auth | Auth.js + Discord ✅ |
| Validation | Zod |
| Images | `next/image` + sprite CDNs |

Keep the stack boring so the **UI personality** can carry the product.

---

## 10. App routes

```
/                                 → Warm landing + active season CTA     ✅
/login                            → Discord auth                         ✅
/account                          → Account editing                      ✅
/challenges                       → Season list (active + archives)      ✅ (Phase 5 archive UX)
/challenges/[slug]                → League board (hub) + activity feed   ✅
/challenges/[slug]/rules          → Rules / FAQ (tabbed)                 ✅
/challenges/[slug]/faq            → Redirect → /rules?tab=faq            ✅
/challenges/[slug]/tools          → Tools hub → Pokédex, chart, planner… ✅
/challenges/[slug]/compare        → Redirect → Team Planner (vs mode)    ✅
/challenges/[slug]/me             → Provision + jump to own board        ✅
/challenges/[slug]/join           → Invite / GM code                     ✅
/challenges/[slug]/trainers/[id]  → Trainer board                        ✅
/challenges/[slug]/gm             → Game Master console                  ✅
/challenges/[slug]/memorial       → Season memorial (all graves)         ✅
/challenges/[slug]/tournament     → Ladder                               ✅ (stub)
```

Activity lives on the league hub (no separate `/feed` route). League board is the hub — rules/FAQ one click away, matching how the group uses the sheet day-to-day.

---

## 11. Success metrics

- Group stops editing the Google Sheet for day-to-day updates
- A player can log a death + cause on mobile in **&lt; 60 seconds**
- Guests/spectators understand standings from the league board alone
- 2026 remains readable when 2027 is active
- *(Deferred)* GM can spin up next year’s challenge by duplicating a season
- Design critique: “feels like Emerald menus,” not “feels like a SaaS template”

---

## 12. Out of scope (for now)

- Full battle simulator / damage calc
- Full PKHeX-grade editing / write-back to `.sav` (read/import only for now)
- Public multi-tenant SaaS
- Real-time collaborative cursors
- Pixel-perfect recreation of Nintendo UI assets
- Overloaded marketing landing pages

---

## 13. Next build priorities

Phases 0–4 shipped (including Phase 4 QoL + early save import).

**Now:** Phase 5 season ops — archive UX, INVITE guest wall, welcome video embed, tournament round advance.

**Deferred:** Championship auto-lock, season duplicate / year switcher (2027).
