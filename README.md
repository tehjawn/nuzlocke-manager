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

### Writing migrations

`prisma/migrations` is one linear history, and two people authoring against it in
parallel can diverge without anything failing at merge time. Two conventions keep
that from happening:

- **Generate migrations with `npm run db:migrate`** (`prisma migrate dev`) so the
  directory carries a real second-precision timestamp. Hand-picked round
  timestamps (`…180000`) are how two branches end up claiming the same slot.
- **Prefer one migration per PR** — smaller to review and to roll back. Several
  are safe and CI only mentions it; the ordering rules apply to each one.
- **Re-timestamp after rebasing** if someone else's migration landed first. Rename
  the directory only — the SQL does not change.

CI checks these on every PR (`.github/workflows/migration-checks.yml`), and
rejects any change to a migration that already exists on `main`. It also rejects
a `prisma/schema.prisma` edit that changes DDL without a matching migration
(the `db push` without `migrate dev` hole). Run the checks yourself before
pushing:

```bash
scripts/check-migration-order.sh                 # ordering, duplicates, edits to applied migrations
DATABASE_URL="postgresql://nuzlocke:nuzlocke@localhost:5432/scratch" \
  scripts/check-migration-replay.sh              # applies your migrations to a scratch DB
```

The replay check wants a database it can clobber — point it at a scratch one, not
your dev database. It builds the schema as of `main`, applies only the migrations
your branch adds (if any), then asserts the result matches `prisma/schema.prisma`.

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

## AI assist (optional)

Jump Ask (#184 / #300) calls Google AI Studio (Gemini Flash-Lite) through the Vercel AI SDK, server-side only (`POST /api/ai/jump`).

1. Create a key at <https://aistudio.google.com/apikey>
2. Put it in `.env.local` as `GOOGLE_GENERATIVE_AI_API_KEY` (never commit it)
3. On Vercel, add the same var to **Production + Preview**, then redeploy

Smoke check (requires a signed-in session cookie):

```bash
curl -X POST http://localhost:3000/api/ai/jump -H 'Content-Type: application/json' -d '{"question":"who is ahead?"}'
```

Unauthenticated returns `401`. Signed in with no key set returns `501` — the assist path is fail-open, so the rest of the app is unaffected when the key is absent. Per-user limits are in-memory (5/min, 50/day); move to Upstash/KV if this becomes more than an experiment.

Ask runs are logged to `AiAskLog` for ops (question, answer, tokens, status) — not user-facing chat history. Retention is keep-forever for v1; browse via Prisma Studio.

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

### Preview deployments (label-gated)

Automatic Git preview builds are skipped (`vercel.json` → `ignoreCommand`). A PR
gets a preview only when it has the GitHub label **`deploy preview`**:

1. Create a **full account** [Vercel token](https://vercel.com/account/tokens)
   (not a scoped/custom `vcp_…` project token — those break `vercel pull` /
   `vercel deploy` with “Could not retrieve Project Settings”).
2. Add it as the repository Actions secret `VERCEL_TOKEN`
   (`gh secret set VERCEL_TOKEN`).
3. On a PR, add the `deploy preview` label. GitHub Actions builds and deploys a
   preview and comments the URL. Later pushes to that PR redeploy while the
   label remains.
4. Cleanup is automatic when you **remove the label**, **merge**, or **close**
   the PR: the label is cleared (on close/merge) and matching non-production
   Vercel preview deployments are deleted, along with the PR's Neon branch and
   its alias slot. Production deployments are never touched.

Each labelled preview gets its **own Neon branch** (`preview/pr-<n>`, copy-on-write
from production) and runs migrations against that branch only, so preview testing
never reads or writes production data.

#### Signing in on a preview

Deployment URLs contain a per-deployment hash, and Discord requires redirect URIs
to match exactly, so previews are aliased onto a fixed pool of hostnames:

```text
nuzlocke-preview-1.vercel.app
nuzlocke-preview-2.vercel.app
nuzlocke-preview-3.vercel.app
```

Each is registered in the Discord OAuth app as
`https://<host>/api/auth/callback/discord`. **Use the slot URL from the PR
comment, not the raw deployment URL** — sign-in only works on the former.

The pool size caps how many previews can be logged into at once; the workflow
fails with a clear error naming the occupying PRs when all slots are held. To add
a fourth, register another redirect URI in Discord and extend the
`PREVIEW_SLOT_HOSTS` default in `scripts/vercel-preview-slot.sh`.

Fork PRs are skipped (Actions cannot use this secret on fork `pull_request`
events). Production deploys from the production branch are unchanged.

#### Secrets and variables

| Name | Kind | Source |
|---|---|---|
| `VERCEL_TOKEN` | secret | Manual — a **full account** token |
| `NEON_API_KEY` | secret | Provisioned by the Neon GitHub integration |
| `NEON_PROJECT_ID` | variable | Provisioned by the Neon GitHub integration |

#### Safety invariants

Preview automation must never touch production. These are enforced in code, not
by convention:

- Preview jobs only ever set env vars **per deployment** (`vercel deploy --env`);
  they never run `vercel env add/rm`, so Production env vars cannot be rewritten.
- The deploy never passes `--prod`. It also must not pass `--target`, which makes
  Vercel evaluate the Ignored Build Step and cancel the deployment.
- The Neon branch name is derived solely from the PR number, so cleanup cannot
  resolve to `main`. Creation additionally asserts the branch is not the default
  branch and has a parent.
- Anything unexpected **aborts**: a missing Neon config, an empty connection
  string, or a branch that looks like production fails the job rather than
  falling back to the shared Preview env, which still points at production.
- Teardown is idempotent — unlabel then close runs it twice by design.

#### Sweeping leftovers

`preview-sweep.yml` runs nightly as a backstop for previews that escaped
teardown (a cancelled cleanup run, a transient API failure). It only considers
branches matching `preview/pr-<n>` whose PR is closed, missing, or no longer
labelled, so it cannot remove an active preview. Neon branches also carry a
7-day `expires_at` as a second backstop.

Run it on demand from the Actions tab if a slot or branch appears stuck.

#### Neon Free budget

Verified 2026-08-07 (`free-nuzlocke-manager-1`): **10 branches per project**
(including `production`), **0.5 GB storage**, **100 CU-hours/month**, and
**5 GB transfer/month**. Quota resets on the 1st.

**Scale to zero (production):** Free always suspends after **5 minutes** idle.
`suspend_timeout_seconds: 0` on the endpoint means “use plan default,” not
“never suspend” — the Free plan cannot customize or disable that interval
(API returns “modifying the suspend interval is not permitted”). Production
already shows regular `suspend_compute` / `start_compute` pairs when quiet.

**Pooler:** Production Vercel `DATABASE_URL` must be the Neon **pooled** host
(`…-pooler…`); `DATABASE_URL_UNPOOLED` stays direct for `prisma migrate deploy`.
Confirmed 2026-08-07. Runtime uses `attachDatabasePool` + a short pg idle
timeout so Fluid isolates release connections and Neon can actually idle.

The deploy workflow checks the branch count before creating one and fails with
the list of currently held preview branches rather than falling back to the
production database. Override the cap with the `NEON_BRANCH_LIMIT` repository
variable if the plan changes.

Two knock-on effects worth knowing:

- Each preview branch runs its own compute, autosuspending after 5 minutes idle.
  Compute hours are shared, so many long-lived previews eat the monthly budget
  even when the branch count is fine.
- Branches are copy-on-write, so they cost almost nothing at creation, but
  migrations and smoke-test writes accrue against the 0.5 GB limit.
- Transfer is the tighter Free cliff at hobby traffic (~3 GB in the first ~5
  days of this project). Scale-to-zero helps CU-hours; query/caching work is
  what cuts transfer.

When migrating Neon projects, update Production + Preview (and Development if used) together so preview deploys do not keep hitting the old database.
