# Nuzlocke Manager

Trash Pack's Nuzlocke tracker — league boards, graves, badges, seasons, Discord login, and Game Master tools.

## Phase 2

- Discord login (Auth.js)
- Invite codes → membership (player / GM)
- Claim trainer slots
- Player board editing (status, revive, badges, Pokémon CRUD)
- Species autocomplete (Gen 1–3 focused index)
- GM console (settings, roster, rules, FAQ)
- Activity feed on the league board
- Postgres-backed data with seed fallback for read-only demo

Plan: [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Local setup

```bash
npm install
cp .env.example .env
```

Fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `AUTH_SECRET` | Auth.js secret (`openssl rand -base64 32`) |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth app |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` |

Discord redirect URL:

`http://localhost:3000/api/auth/callback/discord`

Then:

```bash
npm run db:generate
npx prisma db push
npm run db:seed
npm run dev
```

After seed:

- Discord login auto-joins **Trash Pack 2026** and opens your board (`/challenges/2026-trash-pack/me`)
- Demo trainer: Ash Ketchum (example only)
- GM invite (optional): `TRASHPACK-GM` via `/challenges/2026-trash-pack/join?gm=1`

Flow: Discord login → your trainer board. Done.

Without DB/Discord env, the app still serves **seed read-only** pages.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local server |
| `npm run build` | Production build |
| `npm run db:generate` | Prisma client |
| `npm run db:migrate` | Migrations |
| `npm run db:push` | Push schema (dev) |
| `npm run db:seed` | Seed Trash Pack 2026 |
| `npm run db:studio` | Prisma Studio |

## Deploy on Vercel

1. Import repo
2. Set env vars above (use production Discord redirect + `AUTH_URL`)
3. Provision Postgres (Vercel / Neon / etc.)
4. Build runs `prisma generate && next build`
5. Run `db push` / migrate + `db:seed` once against production DB
