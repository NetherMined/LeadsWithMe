# LeadSight — Project Overview & Technical Spec

_Last reviewed: 2026-10-16, after the Supabase → Postgres/Drizzle/Better Auth/Docker migration (plan: `plan-postgres-docker.md`, Phases 1–7). Verified with `docker compose up --build` on a clean volume and an in-container smoke test._

---

## 1. What LeadSight Is

LeadSight is a B2B lead-generation and digital-marketing-audit SaaS for agencies, freelancers and consultants. It:

1. **Finds** local businesses (Google Places API v1)
2. **Enriches** them (website scrape, social links, emails, Brave web search)
3. **Audits** their digital presence: website, social, ads, competitors
4. **Scores** them 0–100 with an A–F grade
5. **Generates** AI marketing plans, website proposals, demo sites and outreach assets (Claude)
6. **Tracks** the sales pipeline (Kanban CRM, follow-ups, before/after proof)
7. **Exports** to Google Sheets, Google Docs, Google Drive and PDF

The goal is that a consultant walks into a sales conversation already knowing what is wrong with a prospect's online presence and what it will cost to fix.

---

## 2. Current Health

### 2.1 Migration Outcome (2026-10-15 → 2026-10-16)

The original Supabase project was deleted (NXDOMAIN), so the app was moved to a self-hosted stack. There was no data to migrate.

| Phase | Commit | Result |
|---|---|---|
| 1. Postgres in Docker + Drizzle schema | `b9d2728` | One baseline migration (`drizzle/0000_baseline.sql`), 17 tables, dev-user seed |
| 2. Better Auth | `b87f1a5` | Google sign-in with Sheets/Docs/Drive scopes, offline access, DB sessions |
| 3. Data layer → Drizzle | `986962a` | ~105 Supabase calls converted; every query scoped by `user_id` (IDOR fixed and tested) |
| 4. Local file storage | `cb13198` | `UPLOAD_DIR` + owner-only `/api/files/[...path]` |
| 5. Containerise | `b7ab432` | Standalone Next build, Debian Chromium, non-root, `db` → `migrate` → `app` |
| 6. Service fixes + hardening | `74430e1` | AI client, Pollinations, PageSpeed, photo proxy, timeouts, SSRF guard, auth on autocomplete, `/api/log` limits |
| 7. Cleanup + docs | — | Supabase packages and code removed, tests/lint fixed, docs updated |

### 2.2 Live Test Results (in the container, 2026-10-16)

| Area | Result | Notes |
|---|---|---|
| `docker compose up --build` from a clean volume | ✅ | Migrations + seed run, app healthy |
| Google Places v1 (search, details, autocomplete, photos) | ✅ | Photos served through `/api/places/photo`; no `key=` in any response |
| PageSpeed Insights | ✅ | API enabled on the Places key; a mobile audit takes ~20–25s |
| Brave Search | ✅ | |
| Anthropic `claude-haiku-4-5-20251001` | ✅ | Plan generation ~35s |
| Pollinations fallback (`gen.pollinations.ai/v1`, `openai/gpt-5.4-mini`) | ✅ | Forced fallback returns a completion |
| Puppeteer (PDF export, screenshots, competitor scrape) | ✅ | Debian Chromium in the image |
| SSRF guard | ✅ | Metadata IP, loopback, `db` service, DNS-to-private hosts and redirects to them are all blocked |
| Ownership | ✅ | Another user's business returns 404 |
| Open PageRank | ⚠️ Not configured | `OPENPAGERANK_API_KEY` unset, so domain authority uses defaults |
| Meta Ad Library | ⚠️ Stub | `lib/scraper/ads.ts` always returns "no ads" |

### 2.3 Quality Gates

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `npm test` (vitest) | ✅ 31/31 |
| `npm run lint` | ✅ 0 errors, 38 warnings (unused variables) |
| `npm run build` | ✅ |

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router (Turbopack), standalone output | 16.2.3 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn/ui (Radix primitives), inline styles with CSS variables | ^4 |
| Icons | lucide-react | ^0.474 |
| Database | PostgreSQL 16 (Docker) + Drizzle ORM (`postgres.js`) | drizzle-orm ^0.45, drizzle-kit ^0.31 |
| Auth | Better Auth (Google provider, DB sessions, Drizzle adapter) | 1.7 |
| File storage | Local volume (`UPLOAD_DIR`) | — |
| Validation | Zod | ^4.3 |
| AI | Anthropic SDK (Claude Haiku 4.5 default) | `@anthropic-ai/sdk` ^0.135 |
| Outbound HTTP | fetch; `undici` Agent for the SSRF-guarded `safeFetch` | undici ^7.25 |
| Scraping (static) | cheerio + fetch | ^1.2 |
| Scraping (headless) | puppeteer-core + Debian Chromium (Docker) / local Chrome / @sparticuz/chromium | ^24 |
| Maps | Leaflet (client-only via `next/dynamic`), OSM tiles | ^1.9 |
| PDF | Puppeteer HTML→PDF; pdfkit in `lib/pdf/generator.ts` | |
| Google Workspace | googleapis (Sheets, Docs, Drive, OAuth2) | ^171 |
| Tests | Vitest | ^3.2 |
| Lint | ESLint 9 + eslint-config-next | 16.2.3 |
| Runtime | Docker Compose: `db`, `migrate` (one-shot), `app` | node:22-slim |

**Next 16 specifics in use:**
- `src/proxy.ts`, which replaces `middleware.ts`.
- `params` is a `Promise` and is awaited in dynamic routes.
- `src/instrumentation.ts` patches `console.error`.
- Route files only export handlers and route config; helpers live in `lib/`.

---

## 4. External APIs & Services

| Service | Used For | Endpoint | Env Var | Code |
|---|---|---|---|---|
| Google Places API (New) | Text search, place details, photos, autocomplete, competitors, email-enrich website lookup | `places.googleapis.com/v1` | `GOOGLE_PLACES_API_KEY` | `api/search`, `api/audit/competitors`, `api/autocomplete/location`, `api/places/photo`, `api/enrich/emails` |
| PageSpeed Insights v5 | Performance, SEO, accessibility and best-practice scores | `googleapis.com/pagespeedonline/v5` | `PAGESPEED_API_KEY` → `GOOGLE_PLACES_API_KEY` | `lib/scraper/website.ts` |
| Brave Search | Web and social enrichment, competitor sites for proposals | `api.search.brave.com/res/v1/web/search` | `BRAVE_SEARCH_API_KEY` | `lib/scraper/web-search.ts`, `api/audit/website-proposal` |
| Open PageRank | Domain authority | `openpagerank.com/api/v1.0` | `OPENPAGERANK_API_KEY` (unset) | `lib/scraper/ads.ts` |
| Meta Ad Library | Active FB/IG ads | — (stub) | — | `lib/scraper/ads.ts` |
| Anthropic Claude | Plans, proposals, outreach, A/B suggestions, demo HTML | Messages API | `ANTHROPIC_API_KEY`, `AI_MODEL` | `lib/ai/client.ts` |
| Pollinations | AI fallback when Anthropic billing fails | `gen.pollinations.ai/v1/chat/completions` | `POLLINATIONS_API_KEY`, `POLLINATIONS_MODEL` | `lib/ai/client.ts` |
| Deal sites | Deal / promotion detection | wikideals.co.za, daddysdeals.co.za, groupon.co.za (scraped) | — | `lib/scraper/deals.ts` |
| Google Sheets / Docs / Drive | Exports | googleapis via OAuth2 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `lib/google/*` |
| Headless Chromium | Screenshots, PDF, JS-rendered scraping | Debian package in Docker | `CHROME_EXECUTABLE_PATH` | `lib/scraper/browser.ts` |

---

## 5. Application Structure

All app code lives in `leadsight/`. The path alias `@/*` maps to `src/*`.

```
src/
  app/
    (auth)/login/             Login page
    (dashboard)/              dashboard, search, leads, leads/[id], leads/[id]/outreach,
                              plans, plans/[id], outreach, proof, exports, account
    api/                      API routes (§6)
  components/
    account/ audit/ dashboard/ export/ layout/ leads/ outreach/
    plans/ proof/ providers/ report/ search/ ui/
  lib/
    ai/          client.ts (Claude + fallback), prompts.ts, parser.ts
    auth/        index.ts (Better Auth), server.ts (getAuthUser), client.ts (authClient)
    competitor/  finder, scraper, compare, ab-tests
    db/          client.ts (drizzle), schema.ts, queries.ts
    demo/        generateDemo (AI HTML demo), screenshotDemo
    google/      auth (tokens), places (photo paths), sheets, docs, drive
    net/         safe-fetch (SSRF guard for fetch and Puppeteer)
    outreach/    generator, templates, positioning
    pdf/         generator
    scoring/     engine.ts (calculateDigitalPresenceScore)
    scraper/     website, social, ads, deals, emails, web-search, browser
    screenshots/ capture
    storage/     local.ts (UPLOAD_DIR)
    usage/       track, costs
    logger.ts, storage-preference.ts, utils.ts (cn, mapWithConcurrency)
  types/         business, audit, score, plan, export, outreach, constants, helpers
  tests/unit/    scoring, parser, helpers
  proxy.ts       Session-cookie gate: /login redirect for pages, 401 for /api/*
  instrumentation.ts
drizzle/         SQL migrations (0000_baseline)
scripts/         migrate.ts, seed-dev.ts
Dockerfile, docker-compose.yml, .env.example
```

The old Supabase migrations are archived in `archive/supabase/` at the repo root.

---

## 6. API Reference

All routes require a session except `/api/auth/*` and `/api/log`. Every business-scoped route checks ownership and returns 404 for another user's record.

| Route | Method(s) | Purpose | Zod |
|---|---|---|---|
| `/api/auth/[...all]` | GET/POST | Better Auth (Google OAuth callback, sessions) | — |
| `/api/search` | POST | Places search → details → enrichment (5 at a time) → upsert `businesses` | ✅ |
| `/api/search-sets` | GET/POST/PATCH/DELETE | Saved searches | ✅ |
| `/api/autocomplete/location` | GET `?q=` | Places autocomplete | — |
| `/api/places/photo` | GET `?name=` | Photo proxy: adds the key server-side, 302 to the image | regex |
| `/api/businesses/[id]/proposal` | GET | Score and latest proposal demo (search info panel) | — |
| `/api/audit/website` | POST | PageSpeed, SEO, tech stack, freshness → `website_audits`; returns `warnings` | ✅ |
| `/api/audit/social` | POST | Social channel audit → `social_audits` | ✅ |
| `/api/audit/ads` | POST | Ads pixels, domain authority → `ads_audits` | ✅ |
| `/api/audit/competitors` | POST | Competitor discovery, comparison and A/B suggestions | ✅ |
| `/api/audit/website-proposal` | POST | AI website proposal (Markdown) for businesses with no website | ✅ |
| `/api/score` | POST | Compute `DigitalPresenceScore` → `scores` | ✅ |
| `/api/plan` | POST | AI marketing plan → `marketing_plans` | ✅ |
| `/api/enrich/emails` | POST | Email discovery | ✅ |
| `/api/export/sheets` | POST | Google Sheets export | ✅ |
| `/api/export/docs` | POST | Google Docs export | ✅ |
| `/api/export/pdf` | POST | Puppeteer PDF report (optionally with competitor comparison) | ✅ |
| `/api/export/proposal-drive` | POST | Proposal → Google Doc in Drive | ✅ |
| `/api/proposal/demo` | POST | Demo site generation, screenshots, local storage | ✅ |
| `/api/proposal/demo-upload` | POST | Upload HTML demo or set a demo URL → `proposal_demos` | ✅ |
| `/api/files/[...path]` | GET | Owner-only file server for uploads | — |
| `/api/outreach/generate` | POST | Outreach assets (email, Loom script, fees, issues) | ✅ |
| `/api/outreach/pipeline` | GET/POST/PATCH | CRM pipeline CRUD | ✅ |
| `/api/outreach/status` | GET | Outreach assets and audit status for one business | ❌ |
| `/api/outreach/followups` | GET | Follow-ups that are due | — |
| `/api/proof/snapshot` | POST | Before/after screenshot capture | ✅ |
| `/api/proof/case-study/[id]` | GET | Case study, assembled from snapshots and pipeline data | ❌ |
| `/api/usage` | GET | API usage and cost stats | — |
| `/api/log` | POST | Client error reporting (public; 16 KB cap, 30 req/min per IP) | ✅ |
| `/api/admin/delete-records` | POST | Delete the caller's own data | ✅ |

---

## 7. Data Model (Drizzle, `src/lib/db/schema.ts`)

| Table | Key Columns / Notes |
|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth. Google access/refresh tokens live in `accounts`. |
| `businesses` | `id` uuid, `user_id`, `place_id` (unique per user), contact, address, socials, emails, `web_results`, deals, `photo_references` + key-free `photo_primary`/`photos` |
| `website_audits` | PageSpeed scores, SEO flags, CMS, analytics, freshness (scoped through `business_id`) |
| `social_audits` | Per-platform JSON, coverage and engagement scores |
| `ads_audits` | Meta/Google ads, remarketing pixel, domain authority |
| `scores` | Overall score, grade, five sub-scores |
| `marketing_plans` | Plan JSON, `user_id` |
| `exports` | Export history and Google file URLs |
| `search_sets` | Saved searches |
| `api_usage` | Per-call usage and cost |
| `outreach_assets`, `outreach_pipeline`, `proof_snapshots` | CRM and proof |
| `proposal_demos` | `business_id`, `user_id`, `html`, `proposal_md`, `demo_site_url`, desktop/mobile screenshot URLs |

- There is no RLS. Isolation is enforced in the query layer: every read and write filters by `user_id`, or by `business_id` after an ownership check.
- Audit, score and plan rows cascade-delete with the business.

---

## 8. Core Flows

1. **Search.** `POST /api/search`:
   - Places `searchText` returns up to `limit` results (max 50).
   - Each result gets a details call, a website scrape (socials, emails, tech hints) and Brave enrichment, 5 places at a time.
   - Results are upserted into `businesses`. If the upsert fails, the fallback object uses `id = place_id`, and the UI must check for a real UUID before calling audits.
2. **Audit.** The Run Audit button runs website → social → ads → competitors → score in sequence and shows errors and warnings (for example, PageSpeed unavailable).
3. **Scoring** (`lib/scoring/engine.ts`):
   - Weights: Website 30%, Social presence 25%, Engagement 20%, Advertising 15%, Reviews 10%.
   - Weights are redistributed when an audit is missing.
   - Grades: A ≥80, B ≥60, C ≥40, D ≥20, F <20.
4. **Plan.** `getFullBusinessProfile(id, userId)` → `buildPlanPrompt()` → `generateCompletion()` → `parsePlanResponse()` → `marketing_plans`.
5. **Website proposal.** For businesses with no website:
   - Brave finds competitor sites.
   - Claude writes a nine-section Markdown proposal.
   - The proposal can be downloaded, exported to Drive, or paired with a generated or uploaded demo site.
6. **Outreach.** Generated assets go into the Kanban pipeline, with follow-up reminders.
7. **Proof.** Before/after screenshots feed a case study.
8. **Exports.** Sheets (colour-coded grades), Docs (plan), PDF (Puppeteer) and Drive (proposal). Each export is logged in `exports`.

### Auth Model

- `getAuthUser()` (`lib/auth/server.ts`) validates the Better Auth session and returns `{ id, email, name }`. When server-only `DISABLE_AUTH=true` it returns the seeded `DEV_USER_ID` user.
- `src/proxy.ts` checks for a session cookie: pages redirect to `/login`, and `/api/*` returns 401 (except `/api/auth` and `/api/log`).
- `getValidGoogleToken(userId)` reads and refreshes the Google token from `accounts`.

### AI Client

- `generateCompletion(system, user, {model, maxTokens})` calls Claude (`AI_MODEL`, default `claude-haiku-4-5-20251001`) with a 120s timeout.
- On a billing error (402 / `billing_error`, or the legacy 400 credit-balance error) it opens a 5-minute circuit breaker and falls back to Pollinations, with up to two 429 retries and a 120s timeout.

### Outbound Request Safety

- `safeFetch()` validates every resolved address at connect time (blocking DNS rebinding) and re-checks each redirect hop. It is used for business websites and URLs scraped from them.
- `assertPublicUrl()` + `guardPage()` protect Puppeteer navigation: every request the page makes is checked.

### Logging

- `lib/logger.ts` appends JSONL to `logs/errors.log` (a Docker volume).
- `instrumentation.ts` mirrors `console.error` into that log.
- Client errors arrive through `/api/log`, the `ErrorReporter` component and the error boundaries.

---

## 9. Environment Variables

See `leadsight/.env.example`.

| Var | Scope | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | server | ✅ | Overridden to `db:5432` inside compose |
| `BETTER_AUTH_SECRET` | server | ✅ | |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | server / public | ✅ | `http://localhost:3001` |
| `GOOGLE_CLIENT_ID` / `_SECRET` | server | ✅ | Redirect: `/api/auth/callback/google` |
| `GOOGLE_PLACES_API_KEY` | server | ✅ | PageSpeed Insights API must be enabled on it unless `PAGESPEED_API_KEY` is set |
| `PAGESPEED_API_KEY` | server | — | Dedicated PageSpeed key |
| `ANTHROPIC_API_KEY` | server | ✅ | |
| `AI_MODEL` | server | — | Default `claude-haiku-4-5-20251001` |
| `POLLINATIONS_API_KEY`, `POLLINATIONS_MODEL` | server | — | Fallback; default model `openai/gpt-5.4-mini` |
| `BRAVE_SEARCH_API_KEY` | server | ✅ | |
| `OPENPAGERANK_API_KEY` | server | — | Unset, so domain authority is always the default |
| `UPLOAD_DIR` | server | — | Default `./data/uploads` (`/data/uploads` in Docker) |
| `CHROME_EXECUTABLE_PATH` | server | — | Set in the Docker image |
| `LOG_DIR` | server | — | Defaults to `<cwd>/logs` |
| `DISABLE_AUTH`, `DEV_USER_ID` | server | dev | Auth bypass and seeded dev user |

---

## 10. Room for Improvement (Prioritised)

### P1: Reliability

1. **Usage tracking is fire-and-forget**, so rows can be lost when a request ends early. Await it or use `after()` from `next/server`.
2. **Search cost.** Request details fields in the `searchText` field mask to remove the N+1 detail calls, and cache enrichment by `place_id`.
3. **Puppeteer demo screenshots** use `page.setContent()` with AI-generated HTML that loads CDN assets; those requests are not passed through `guardPage()`.
4. **Rate limiting** on `/api/log` is per process and in memory; use a shared store if the app ever runs more than one instance.

### P2: Modernisation and Quality

5. **AI:** consider `claude-haiku-5-5`, use structured outputs or tool use for plan JSON instead of regex parsing, and use prompt caching for the large static system prompts.
6. **Implement Meta Ad Library** (needs a Graph API token), or label ads detection in the UI as pixel-based only.
7. **Tests:** add route-level tests for auth and ownership, `safeFetch` tests, and mocked scraper tests.
8. **Lint:** clear the 38 warnings (mostly unused variables).
9. **Background jobs.** Move long audits and enrichment to a queue (for example pg-boss) with progress polling, instead of long HTTP requests.
10. **Observability.** Add Sentry or OpenTelemetry alongside the JSONL file logger.

---

## 11. Dev Commands

Run these from `leadsight/`:

```bash
npm run dev          # http://localhost:3001
npm run build
npm run lint
npm test
npx tsc --noEmit
npm run db:up        # Postgres only (host port 5433)
npm run db:migrate && npm run db:seed
npm run docker:up    # full stack, app on http://localhost:3001
```
