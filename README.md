# Nuzlocke Manager

Trash Pack's Nuzlocke tracker — league boards, graves, badges, seasons, Discord login, and Game Master tools.

## Status

Phases 0–4 shipped. Next: Phase 5 — season ops polish (archive UX, invite wall, welcome video, tournament advance). See plan.

- Discord login (Auth.js) → auto-provision personal trainer board
- Invite / GM codes for gated seasons and GM elevation
- Player board editing (status, revive, badges, Pokémon CRUD)
- Species + shiny + forme sprite picker
- Import from Afterplay / Gen 3 saves (party, box, R.I.P., encounters + optional name/badges)
- GM console (settings, rules, FAQ, Main Squad lock, export, Discord webhooks)
- Memorial, tournament stub, encounter ledger, team planner, type chart, share links
- Activity feed on the league board + notifications / welcome modal
- Postgres-backed data with seed fallback for read-only demo

Plan: [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Local setup

**Prefer local Postgres for development** so day-to-day work does not burn Neon data-transfer quota. Production stays on Neon via Vercel env.

Docker Compose runs **Postgres 18** (matches Neon). If port `5432` is already taken, stop the other container or change the published port in `docker-compose.yml`.

```bash
npm install
docker compose up -d
cp .env.example .env
# Optional: keep secrets / overrides in .env.local (loaded by Next + db:pull-neon)
```

Fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Local: Docker URL below. Vercel: Neon **pooled** (`…-pooler…`) |
| `DATABASE_URL_UNPOOLED` | Vercel only — Neon **direct** host (migrations / tools) |
| `NEON_DATABASE_URL` | Optional local — Neon direct URL for `npm run db:pull-neon` |
| `AUTH_SECRET` | Auth.js secret (`openssl rand -base64 32`) |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth app |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Optional locally (`trustHost` + pinned `:3000`). Set on Vercel to the canonical origin. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Optional Upstash — Pack-feed poll watermark only |

`npm run dev` / `npm start` bind to **port 3000** (fail if busy) so Discord callbacks stay stable.

Default local DB URL:

```text
postgresql://nuzlocke:nuzlocke@localhost:5432/nuzlocke_manager
```

Discord redirect URL:

`http://localhost:3000/api/auth/callback/discord`

(Optional: also register `:3001` / `:3002` if you ever override the port.)

Then:

```bash
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

If `migrate deploy` fails on a brand-new local volume (no baseline), use `npm run db:push` once, then seed. Prefer migrations for anything that should match production.

Set `PRISMA_QUERY_LOG=1` to log query counts while tuning egress.

### Sync local from Neon

When you want production-shaped data locally (destructive to the local DB):

1. Set `NEON_DATABASE_URL` to the Neon **direct** (non-pooler) URL in `.env.local`
2. Keep `DATABASE_URL` pointed at localhost Docker
3. Run `npm run db:pull-neon`

Requires Postgres 18 client tools (`brew install postgresql@18`). The script refuses non-loopback targets unless `FORCE_REMOTE_TARGET=1`. Process env wins over values in `.env` / `.env.local`.

### After seed

- Discord login auto-joins **Trash Pack 2026** and opens your board (`/challenges/2026-trash-pack/me`)
- GM invite (optional): `TRASHPACK-GM` via `/challenges/2026-trash-pack/join?gm=1`

Flow: Discord login → your trainer board. Done.

Without DB/Discord env, the app still serves **seed read-only** pages.

## Data / egress notes

The app is tuned to keep Neon transfer low:

- **Local-first:** Docker Postgres for development; pull from Neon only when you need a snapshot
- **Page-shaped reads:** boards / meta / memorial / home carousel load only the columns they render
- **Cache Components:** shared season projections use Next.js `"use cache"` + tag invalidation (`updateTag` / `revalidateTag`)
- **Pack feed polls:** lean activity query; optional Upstash watermark so idle polls skip Neon. Fail-open if KV is unset or slow
- **Welcome notification:** upsert at Discord sign-in (and rare missing-row backfill) — not on every header render

Upstash is optional. Leave `KV_*` unset locally and on Vercel until you want the watermark; the feed still works without it.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local server |
| `npm run build` | Local / preview build (`prisma generate` + `next build`) |
| `npm run vercel-build` | Vercel build; production deploys also run `migrate deploy` |
| `npm run db:generate` | Prisma client |
| `npm run db:migrate` | Migrations (dev) |
| `npm run db:migrate:deploy` | Apply committed migrations (any env) |
| `npm run db:push` | Push schema (dev / empty local volume) |
| `npm run db:seed` | Seed Trash Pack 2026 |
| `npm run db:pull-neon` | Replace local DB with a dump from `NEON_DATABASE_URL` |
| `npm run db:studio` | Prisma Studio |

## Deploy on Vercel

1. Import repo
2. Set env vars:
   - `DATABASE_URL` → Neon **pooled** URL
   - `DATABASE_URL_UNPOOLED` → Neon **direct** URL
   - Auth / Discord / app URL for production
   - Optional: `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Pack-feed watermark only)
3. Vercel runs `vercel-build`: `prisma generate`, then `prisma migrate deploy`
   only when `VERCEL_ENV=production`, then `next build`. Preview/local builds
   do not mutate the database.
4. Run `db:seed` once against the production DB (or restore from an existing Neon project)
5. After changing DB env vars, **redeploy** so running instances pick them up

When migrating Neon projects, update Production + Preview (and Development if used) together so preview deploys do not keep hitting the old database.
