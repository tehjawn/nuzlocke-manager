# Nuzlocke Manager

Group Nuzlocke tracker for friend challenges — trainer boards, graveyards, badges, seasons, and Game Master tools.

Built with **Next.js** for deployment on **Vercel**.

## Status

Initial scaffold + domain schema. Full product plan: [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md).

Inspired by the Trash Pack spreadsheet workflow (Introduction, FAQ, Trainers Summary, per-trainer boards).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Prisma 7 + PostgreSQL
- Zod validation schemas (API-ready)

## Getting started

```bash
npm install
cp .env.example .env
# set DATABASE_URL to a Postgres instance
npm run db:generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local Next.js server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Prisma Studio |

## Deploy on Vercel

1. Push this repo to GitHub
2. Import in Vercel
3. Add `DATABASE_URL` (Vercel Postgres / Neon / etc.)
4. Build command: `prisma generate && next build` (add to Vercel settings or a `postinstall` later)

## License

Private / friend-group project unless stated otherwise.
