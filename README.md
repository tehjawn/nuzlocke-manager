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
- Memorial, tournament stub, encounter ledger, trainer compare, type chart, share links
- Activity feed on the league board + notifications / welcome modal
- Postgres-backed data with seed fallback for read-only demo

Plan: [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Local setup

**Prefer local Postgres for development** so `next dev` does not burn Neon data-transfer quota. Production stays on Neon (or similar) via Vercel env.

```bash
npm install
docker compose up -d
cp .env.example .env
```

Fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres — localhost via Docker for local; Neon pooled URL on Vercel |
| `AUTH_SECRET` | Auth.js secret (`openssl rand -base64 32`) |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth app |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Optional Upstash (activity poll watermark) |

Discord redirect URL:

`http://localhost:3000/api/auth/callback/discord`

Then:

```bash
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Set `PRISMA_QUERY_LOG=1` to log query counts while tuning egress.

After seed:

- Discord login auto-joins **Trash Pack 2026** and opens your board (`/challenges/2026-trash-pack/me`)
- Demo trainer: Ash Ketchum (example only)
- GM invite (optional): `TRASHPACK-GM` via `/challenges/2026-trash-pack/join?gm=1`

Flow: Discord login → your trainer board. Done.

Without DB/Discord env, the app still serves **seed read-only** pages.

## Scripts

| Script | Purpose |
|---|---|
| `pn dev` | Local server |
| `pn build` | Local / preview build (`prisma generate` + `next build`) |
| `pn vercel-build` | Vercel build; production deploys also run `migrate deploy` |
| `pn db:generate` | Prisma client |
| `pn db:migrate` | Migrations (dev) |
| `pn db:migrate:deploy` | Apply committed migrations (any env) |
| `pn db:push` | Push schema (dev) |
| `pn db:seed` | Seed Trash Pack 2026 |
| `pn db:pull-neon` | Replace local DB with a dump from `NEON_DATABASE_URL` |
| `pn db:studio` | Prisma Studio |

## Deploy on Vercel

1. Import repo
2. Set env vars above (use production Discord redirect + `AUTH_URL`)
3. Provision Postgres (Vercel / Neon / etc.)
4. Vercel runs `vercel-build`: `prisma generate`, then `prisma migrate deploy`
   only when `VERCEL_ENV=production`, then `next build`. Preview/local builds
   do not mutate the database.
5. Run `db:seed` once against the production DB
