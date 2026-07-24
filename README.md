# Nuzlocke Manager

Friend-group Nuzlocke clubhouse — league boards, graves, badges, and season archives with a warm Gen 3 feel.

Built with **Next.js** for **Vercel**.

## v1 (this branch)

Read-only Phase 1 MVP:

- Hoenn Clubhouse design system (chunky frames, warm parchment)
- Trash Pack 2026 seed data (rules, FAQ, 6 trainers, sample boards)
- League board, rules, FAQ, and per-trainer boards with sprites

Auth, editing, and Postgres-backed persistence land in Phase 2+.

Full plan: [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then the **2026 league board**.

Optional DB (Phase 2+):

```bash
cp .env.example .env
# set DATABASE_URL
npm run db:generate
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |

## Deploy on Vercel

Import the GitHub repo, deploy. v1 is static seed data — no database required yet.
