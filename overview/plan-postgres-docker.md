# Plan: Replace Supabase with Postgres + Drizzle + Auth, and Containerise LeadSight

_Created: 2026-10-15. Status: **completed 2026-10-16** (Phases 1–7). Auth = Better Auth; service fixes folded in as Phase 6. App runs on host port 3001 (not 3000) and Postgres on 5433._

## Goal

1. Remove every Supabase dependency:
   - DB client
   - Auth (`@supabase/ssr`)
   - Storage
   - RLS-based schema
2. Replace it with:
   - **PostgreSQL 16** for data
   - **Drizzle ORM** for queries
   - **Better Auth** (self-hosted), keeping Google sign-in
   - a **local file volume** for storage
3. Run everything with one command, `docker compose up`, using two services: `db` and `app`.

## Starting Point

- The old Supabase project no longer exists, so **there is no data to migrate**. We start from a clean schema.

| What uses Supabase | Count |
|---|---|
| Files importing it | 46 |
| Query-builder calls | ~105 (`select`, `eq`, `single`, `order`, `upsert`, …) |
| Embedded selects (joins) | 5 |
| Client-side DB usage | 3 files (`login`, `auth-provider`, `business-info-panel`) |
| Storage calls | 1 (`api/proposal/demo`) |
| `auth.users` / `auth.uid()` references in migrations | 43 |

- Google sign-in also captures **Google API tokens** (Sheets, Docs, Drive) in `auth/callback`. The new auth must keep:
  - `access_type=offline`
  - those scopes
  - refresh-token storage

## Auth Library: Better Auth 1.7 (Decided)

Auth.js v5 is still beta, and its maintainers (the Better Auth team) recommend Better Auth for new projects. Better Auth has a built-in Drizzle adapter, database sessions with a cookie cache, and `getAccessToken()` that auto-refreshes Google tokens for the Sheets, Docs and Drive exports.

## Target Architecture

```
docker compose
 ├─ db   postgres:16-alpine
 │       volume: pgdata; healthcheck: pg_isready
 ├─ migrate (one-shot)
 │       runs drizzle migrations, then the dev seed
 └─ app  Next.js standalone (node:22-slim + Debian chromium)
         ports 3000; volumes: uploads → /data/uploads, logs → /app/logs
         env: DATABASE_URL, AUTH_SECRET, GOOGLE_*, ANTHROPIC_API_KEY, BRAVE_SEARCH_API_KEY, …
```

```
src/lib/db/
  client.ts      postgres.js pool + drizzle()     (server-only)
  schema.ts      every table, typed
  queries/       businesses, audits, plans, outreach, exports, usage…
                 every read and write takes userId (fixes the IDOR)
src/lib/auth/
  server.ts      getAuthUser(): same signature callers already use
  client.ts      useSession / signIn / signOut for the client
src/lib/storage/
  local.ts       save/read files under UPLOAD_DIR, served by /api/files/[...path]
drizzle/         generated SQL migrations (replaces supabase/migrations)
```

## Phases

Execution pauses after each phase for your confirmation.

### Phase 1: Postgres in Docker and the Drizzle Schema

- Add `docker-compose.yml` with the `db` service (Postgres 16, volume, healthcheck) on port 5432.
- Add `drizzle-orm`, `postgres` (postgres.js) and `drizzle-kit`, plus `drizzle.config.ts`.
- Write `src/lib/db/schema.ts`, consolidating migrations 001–012 and `proposal_demos` into one baseline:
  - Point `auth.users` foreign keys at the auth library's `user` table.
  - Drop the RLS policies. Isolation will be enforced in the query layer.
  - Fix the schema bugs from the review: add `user_id` to `marketing_plans`, and add the `proposal_demos` table.
  - Keep all indexes and unique constraints (for example `businesses(user_id, place_id)`).
- Generate the baseline migration.
- Add `scripts/seed-dev.ts`, which creates the dev user matching `DEV_USER_ID`.
- **Verify:** `docker compose up db`, run the migration, check the tables with `psql \dt`, and run the seed.

### Phase 2: Auth Replacement

- Install the chosen library and configure the Google provider:
  - scopes: `openid email profile spreadsheets documents drive.file`
  - `access_type=offline`, `prompt=consent`
- Add an auth route handler (`/api/auth/[...all]`) and delete `src/app/auth/callback`.
- Reimplement `getAuthUser()` with the same return shape (`{ id, email, name }`) so the 26 routes keep working.
- Keep the dev bypass, renamed to server-only `DISABLE_AUTH`.
- Rewrite `src/proxy.ts`: redirect signed-out users to `/login` for dashboard routes, and return 401 for `/api/*` except `/api/auth`.
- Rewrite `auth-provider.tsx` and the `login` page with the library's client.
- Rewrite `lib/google/auth.ts`:
  - `getValidGoogleToken()` reads and refreshes tokens from the auth `account` table.
  - Drop the separate `user_google_tokens` table.
- **Verify:**
  - Google sign-in round trip on localhost.
  - The session survives a reload.
  - `/dashboard` redirects when signed out.
  - A Sheets export obtains a token.
- **Setup needed from you:** add `http://localhost:3000/api/auth/callback/google` to the redirect URIs of your Google OAuth client.

### Phase 3: Data-Layer Migration (the Largest Phase)

Convert all ~105 Supabase calls to Drizzle in three sub-batches, running `tsc` after each:

| Sub-batch | Scope |
|---|---|
| 3a | `lib/`: `queries.ts`, `usage/track.ts`, `competitor/finder.ts`, `ai/prompts.ts`, `types/report.ts` |
| 3b | API routes: search, search-sets, audits ×5, score, plan, enrich, exports ×4, outreach ×4, proof ×2, proposal ×2, usage, admin |
| 3c | Server pages: leads, leads/[id], outreach, plans, plans/[id], exports, proof. Also move the client-side queries in `business-info-panel.tsx` behind a new `GET /api/businesses/[id]/proposal` route. |

Rules for the conversion:
- Every business-scoped query filters by `user_id` (fixes the IDOR).
- Embedded selects become Drizzle joins.
- DB errors become 5xx responses instead of silently empty results.
- Fix `admin/delete-records` and `export/docs` against the new schema.

**Verify:**
- `tsc`, lint and vitest are clean.
- Re-run the endpoint smoke test from the review: search → audit → score → plan → outreach → export flow.
- A second test user cannot read the first user's business (403 or 404).

### Phase 4: File Storage

- Add `lib/storage/local.ts`, which writes to `UPLOAD_DIR` (default `./data/uploads`).
- Add `GET /api/files/[...path]`, an auth-checked file server with path-traversal protection.
- Switch `api/proposal/demo` from Supabase Storage to the local store.
- **Verify:** upload a demo HTML file, view it, and confirm another user gets 404.

### Phase 5: Containerise the App

- Set `output: "standalone"` in `next.config.ts`.
- Add `Dockerfile` (multi-stage: deps → build → runner):
  - `node:22-slim` base, plus the Debian `chromium` package and fonts
  - `CHROME_EXECUTABLE_PATH=/usr/bin/chromium`
  - non-root user
- Update `lib/scraper/browser.ts` and `lib/demo/screenshotDemo.ts` to share one launcher that prefers `CHROME_EXECUTABLE_PATH`.
- Add `.dockerignore`.
- Add the `migrate` one-shot service and the `app` service to `docker-compose.yml`, with `depends_on` conditions and volumes for uploads and logs.
- Add `.env.example` with the new variable set: `DATABASE_URL` and `AUTH_SECRET` added, Supabase variables removed.
- Add npm scripts: `db:generate`, `db:migrate`, `db:seed`, `docker:up`, and `test`.
- **Verify:**
  - `docker compose up --build` from clean.
  - Migrations apply and the app is healthy on :3000.
  - Puppeteer PDF export and screenshots work inside the container.
  - Full smoke test passes.

### Phase 6: External-Service Fixes and Hardening (Folded In)

- **AI:**
  - Upgrade `@anthropic-ai/sdk` from 0.39 to current.
  - Route `lib/demo/generateDemo.ts` through `lib/ai/client.ts`. This removes the retired `claude-3-5-haiku-20241022` default and the duplicate client.
  - Make the model configurable through `AI_MODEL` (default `claude-haiku-4-5-20251001`, with `claude-haiku-5-5` as an option).
  - Detect billing errors by `error.status` and error type instead of matching message strings.
  - Add a timeout to the fallback call.
- **Pollinations fallback:** migrate from the legacy `text.pollinations.ai/openai` (404) to the current Pollinations API (endpoint and model list to be confirmed against their docs). If no suitable model exists, make the fallback provider configurable.
- **PageSpeed:** read a dedicated `PAGESPEED_API_KEY` (falling back to `GOOGLE_PLACES_API_KEY`), and surface the 403 clearly in the audit result. **Setup needed from you:** create the key, or enable the PageSpeed Insights API on the existing key's restriction list.
- **Places photo key leak:** store photo *resource names* only, and serve images through an auth-checked `GET /api/places/photo?name=…` that adds the key server-side.
- **Legacy Places Details** in `enrich/emails`: move to Places v1 and URL-encode parameters.
- **Timeouts:** add `AbortSignal.timeout` to every external fetch. Set `maxDuration` on the search, audit, plan, competitors and proposal routes.
- **Search latency:** run per-place details and enrichment with bounded concurrency (5 at a time).
- **SSRF guard:** add a shared `safeFetch()` that rejects private, loopback, link-local and metadata IPs (after DNS resolution) for `business.website` and `demoSiteUrl` fetches.
- **Auth hardening:** require auth on `/api/autocomplete/location`. Add a size cap and simple per-IP rate limit to `/api/log`.
- **Verify:**
  - Live probe of each service from inside the container: Places, PageSpeed, Brave, Claude, fallback.
  - A website audit returns PageSpeed scores.
  - No `key=` appears in any API response.
  - An SSRF probe to `http://169.254.169.254` is rejected.

### Phase 7: Cleanup and Documentation

- Uninstall `@supabase/ssr` and `@supabase/supabase-js`.
- Delete `src/lib/supabase/`.
- Move `supabase/` to `archive/supabase/` for reference.
- Update root `CLAUDE.md` (stack, auth pattern, env vars, commands, and the route-table fixes from the review), `overview/project_overview.md` and the README.
- Fix the two broken unit-test fixtures and the failing `calculateStringSimilarity` test.
- **Verify:** `grep -r supabase src` is empty, and build, lint and tests are green.

## Out of Scope

Nothing from the review is deferred. Everything is covered in Phases 1–7.

## Risks

| Risk | Mitigation |
|---|---|
| Auth-library differences break the Google API token flow | Phase 2 verifies a real Sheets export before moving on. |
| Hidden PostgREST behaviour: `.single()` throws on 0 rows, and JSON columns are returned already parsed | A shared `first()` helper and typed `jsonb` columns. Review each converted route. |
| Chromium in the container is large (~400 MB image) | Accepted. Slim base, single layer. |
| `proxy.ts` with DB sessions | Use an optimistic cookie check in the proxy, and do full validation in `getAuthUser()`. |
