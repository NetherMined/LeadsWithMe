# LeadSight — Project Overview & Technical Spec

_Last reviewed: 2026-10-15 (live run of `npm run dev` + endpoint probes + static code review)._

---

## 1. What LeadSight Is

LeadSight is a B2B lead-generation and digital-marketing-audit SaaS for agencies, freelancers and consultants. It:

1. **Finds** local businesses (Google Places API v1)
2. **Enriches** them (website scrape, social links, emails, Brave web search)
3. **Audits** their digital presence: website, social, ads, competitors
4. **Scores** them 0–100 with an A–F grade
5. **Generates** AI marketing plans, website proposals and outreach assets (Claude Haiku)
6. **Tracks** the sales pipeline (Kanban CRM, follow-ups, before/after proof)
7. **Exports** to Google Sheets, Google Docs, Google Drive and PDF

The goal is that a consultant walks into a sales conversation already knowing what is wrong with a prospect's online presence and what it will cost to fix.

---

## 2. Current Health (Review Findings)

### 2.1 Live Test Results

The dev server ran on port 3001; port 3000 was already in use by another process.

**Infrastructure and external services**

| Area | Result | Notes |
|---|---|---|
| Dev server boot (Next 16.2.3 / Turbopack) | ✅ Ready in ~1.4s | |
| **Supabase** | ❌ **DOWN** | The project host `metiqdtyqjqydtwzdqqw.supabase.co` returns NXDOMAIN on public DNS (1.1.1.1). The project is deleted or paused. Every DB call fails after a ~7s timeout. |
| Google Places v1 (searchText + details) | ✅ 200 | |
| Google Places autocomplete | ✅ 200 | |
| **PageSpeed Insights** | ❌ 403 | The call reuses `GOOGLE_PLACES_API_KEY`, and that key is restricted, so PageSpeed is blocked. Without a key the call returns 429 (shared quota). |
| Brave Search | ✅ 200 | |
| Anthropic `claude-haiku-4-5-20251001` (main client) | ✅ 200 | |
| Anthropic `claude-haiku-5-5` | ✅ 200 | Available as an upgrade. |
| **Anthropic `claude-3-5-haiku-20241022`** | ❌ 404 | Retired model. It is the default in `lib/demo/generateDemo.ts:226`. |
| **Pollinations `openai-large` @ text.pollinations.ai** | ❌ 404 | The legacy API is deprecated, so **the AI fallback is broken**. |
| Open PageRank | ⚠️ Not configured | `OPENPAGERANK_API_KEY` is unset, so domain authority always falls back to defaults. |
| Meta Ad Library | ⚠️ Stub | `lib/scraper/ads.ts` always returns "no ads". |

**App endpoints**

| Endpoint | Result | Notes |
|---|---|---|
| Pages: `/login`, `/dashboard`, `/search`, `/outreach`, `/account` | ✅ 200 | |
| Pages: `/leads`, `/plans`, `/exports`, `/proof` | ⚠️ 200 in ~7s | They wait for the Supabase timeout, then render empty. |
| `POST /api/search` | ⚠️ 200 in 27s for 2 results | Places works, but the DB upsert fails, so it returns fallback objects with `id = place_id`. |
| `GET /api/search-sets`, `GET /api/outreach/pipeline` | ❌ 500 | `"TypeError: fetch failed"` |
| `GET /api/usage`, `GET /api/outreach/followups` | ⚠️ 200 | They swallow the DB error and return zeros or `[]` silently. |
| `POST /api/audit/website`, `POST /api/score` | ⚠️ 404 | "Business not found" because the DB is down. |
| `POST /api/plan`, `POST /api/export/sheets` | ✅ 400 on bad input | Zod validation works. |
| `POST /api/log` | ✅ 200 | No auth required (see §9). |

**Quality gates**

| Check | Result |
|---|---|
| `tsc --noEmit` | ❌ 2 errors. Both are in `src/tests/unit/scoring.test.ts`: the fixtures are missing new `WebsiteAudit` / `AdsAudit` fields. |
| `vitest run` | ❌ 30/31 pass. `calculateStringSimilarity › similar strings score higher` fails (returns 0). |
| `npm run lint` | ❌ 3 errors, 36 warnings. The errors are `no-explicit-any` in `PipelineKanban.tsx` and `screenshotDemo.ts`. |

### 2.2 Must-Fix Before the App Is Usable

1. **Restore or recreate Supabase.**
   - Create a new project and update the `.env.local` URL and keys.
   - Run `supabase/migrations/001–012` in order.
   - Run the `proposal_demos` SQL in `overview/` (it is not yet a migration).
   - Create the `proposal-demos` storage bucket.
   - Create the dev user in `auth.users` that matches `NEXT_PUBLIC_DEV_USER_ID`.
2. **Fix PageSpeed.** Either enable the PageSpeed Insights API on the key's restriction list, or add a dedicated `PAGESPEED_API_KEY` and use it in `lib/scraper/website.ts:281`.
3. **Fix the AI fallback.** Migrate Pollinations to its new endpoint (`enter.pollinations.ai`) and model list, or replace it with a second Claude model or another provider.
4. **Fix the retired model** in `generateDemo.ts`: route it through `lib/ai/client.ts` instead of the duplicate Anthropic client.

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router (Turbopack dev) | 16.2.3 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn/ui (Radix primitives), inline styles with CSS variables | ^4 |
| Icons | lucide-react | ^0.474 |
| Database | Supabase PostgreSQL with RLS | `@supabase/supabase-js` ^2.103 |
| Auth | Supabase Auth with cookie sessions | `@supabase/ssr` ^0.10 |
| Validation | Zod | ^4.3 |
| AI | Anthropic SDK (Claude Haiku 4.5) | `@anthropic-ai/sdk` ^0.39 (old) |
| Scraping (static) | cheerio + fetch | ^1.2 |
| Scraping (headless) | puppeteer-core + @sparticuz/chromium | ^24 / ^147 |
| Maps | Leaflet (client-only via `next/dynamic`) | ^1.9 |
| PDF | Puppeteer HTML→PDF (pdfkit is also installed) | ^0.15 |
| Google Workspace | googleapis (Sheets, Docs, Drive, OAuth2) | ^171 |
| Tests | Vitest | ^3.2 |
| Lint | ESLint 9 + eslint-config-next | 16.2.3 |

**Next 16 specifics already in use:**
- `src/proxy.ts`, which replaces `middleware.ts`.
- `params` is a `Promise` and is awaited in dynamic routes.
- `src/instrumentation.ts` patches `console.error`.

---

## 4. External APIs & Services

| Service | Used For | Endpoint | Env Var | Code |
|---|---|---|---|---|
| Google Places API (New) | Text search, place details, photos, autocomplete, competitor discovery | `places.googleapis.com/v1` | `GOOGLE_PLACES_API_KEY` | `api/search`, `api/audit/competitors`, `api/autocomplete/location` |
| Google Places (Legacy) Details | Email enrichment lookup | `maps.googleapis.com/maps/api/place/details/json` | `GOOGLE_PLACES_API_KEY` | `api/enrich/emails:44` (deprecated) |
| PageSpeed Insights v5 | Performance, SEO, accessibility and best-practice scores | `googleapis.com/pagespeedonline/v5` | reuses `GOOGLE_PLACES_API_KEY` | `lib/scraper/website.ts:281` |
| Brave Search | Web and social enrichment, competitor sites for proposals | `api.search.brave.com/res/v1/web/search` | `BRAVE_SEARCH_API_KEY` | `lib/scraper/web-search.ts`, `api/audit/website-proposal` |
| Open PageRank | Domain authority | `openpagerank.com/api/v1.0` | `OPENPAGERANK_API_KEY` (unset) | `lib/scraper/ads.ts:78` |
| Meta Ad Library | Active FB/IG ads | — (stub) | — | `lib/scraper/ads.ts:24` |
| Anthropic Claude | Plans, proposals, outreach, A/B suggestions, demo HTML | Messages API | `ANTHROPIC_API_KEY`, `AI_MODEL` | `lib/ai/client.ts`, `lib/demo/generateDemo.ts` |
| Pollinations | AI fallback when Anthropic billing fails | `text.pollinations.ai/openai` (legacy, 404) | `POLLINATIONS_API_KEY` | `lib/ai/client.ts:66` |
| Deal sites | Deal / promotion detection | wikideals.co.za, daddysdeals.co.za, groupon.co.za (scraped) | — | `lib/scraper/deals.ts` |
| Google Sheets / Docs / Drive | Exports | googleapis via OAuth2 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `lib/google/*` |
| Supabase | DB, Auth, Storage (`proposal-demos` bucket) | project URL | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/*` |
| Headless Chromium | Screenshots, PDF, JS-rendered scraping | local Chrome or @sparticuz | `CHROME_EXECUTABLE_PATH` | `lib/scraper/browser.ts`, `lib/demo/screenshotDemo.ts` |

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
    auth/callback/            Supabase OAuth callback
  components/
    account/ audit/ dashboard/ export/ layout/ leads/ outreach/
    plans/ proof/ providers/ report/ search/ ui/
  lib/
    ai/          client.ts (Claude + fallback), prompts.ts, parser.ts
    competitor/  finder, scraper, compare, ab-tests
    demo/        generateDemo (AI HTML demo), screenshotDemo
    google/      auth, sheets, docs, drive
    outreach/    generator, templates, positioning
    pdf/         generator
    scoring/     engine.ts (calculateDigitalPresenceScore)
    scraper/     website, social, ads, deals, emails, web-search, browser
    screenshots/ capture
    supabase/    client, server, middleware, queries
    usage/       track, costs
    logger.ts, storage-preference.ts, utils.ts
  types/         business, audit, score, plan, export, outreach, constants, helpers
  tests/unit/    scoring, parser, helpers
  proxy.ts       Session refresh (no auth redirect)
  instrumentation.ts
supabase/migrations/  001–012
```

---

## 6. API Reference (Actual, as of This Review)

| Route | Method(s) | Purpose | Auth | Zod |
|---|---|---|---|---|
| `/api/search` | POST | Places search → details → enrichment → upsert `businesses` | ✅ | ✅ |
| `/api/search-sets` | GET/POST/PATCH/DELETE | Saved searches | ✅ | ✅ |
| `/api/autocomplete/location` | GET `?q=` | Places autocomplete | ❌ | — |
| `/api/audit/website` | POST | PageSpeed, SEO, tech stack, freshness → `website_audits` | ✅ ⚠️IDOR | ✅ |
| `/api/audit/social` | POST | Social channel audit → `social_audits` | ✅ ⚠️IDOR | ✅ |
| `/api/audit/ads` | POST | Ads pixels, domain authority → `ads_audits` | ✅ ⚠️IDOR | ✅ |
| `/api/audit/competitors` | POST | Competitor discovery, comparison and A/B suggestions | ✅ ⚠️IDOR | ✅ |
| `/api/audit/website-proposal` | POST | AI website proposal (Markdown) for businesses with no website | ✅ ⚠️IDOR | ✅ |
| `/api/score` | POST | Compute `DigitalPresenceScore` → `scores` | ✅ ⚠️IDOR | ✅ |
| `/api/plan` | POST | AI marketing plan → `marketing_plans` | ✅ ⚠️IDOR | ✅ |
| `/api/enrich/emails` | POST | Email discovery | ✅ ⚠️IDOR | ✅ |
| `/api/export/sheets` | POST | Google Sheets export | ✅ | ✅ |
| `/api/export/docs` | POST | Google Docs export (**broken**: filters on a nonexistent `marketing_plans.user_id`) | ✅ | ✅ |
| `/api/export/pdf` | POST | Puppeteer PDF report | ✅ | ✅ |
| `/api/export/proposal-drive` | POST | Proposal → Google Doc in Drive | ✅ | ✅ |
| `/api/proposal/demo` | POST | Demo site generation and storage | ✅ | ✅ |
| `/api/proposal/demo-upload` | POST | Upload HTML demo or set a demo URL → `proposal_demos` | ✅ | ✅ |
| `/api/outreach/generate` | POST | Outreach assets (email, Loom script, fees, issues) | ✅ | ✅ |
| `/api/outreach/pipeline` | GET/POST/PATCH | CRM pipeline CRUD | ✅ | ✅ |
| `/api/outreach/status` | GET | Lead outreach status | ✅ | ❌ |
| `/api/outreach/followups` | GET | Follow-ups that are due | ✅ | — |
| `/api/proof/snapshot` | POST | Before/after screenshot capture | ✅ | ✅ |
| `/api/proof/case-study/[id]` | GET | Case study, assembled from snapshots and pipeline data | ✅ | ❌ |
| `/api/usage` | GET | API usage and cost stats | ✅ | — |
| `/api/log` | POST | Client error reporting | ❌ | ✅ |
| `/api/admin/delete-records` | POST | Delete the caller's own data (**broken**: filters on `user_id` columns that don't exist) | ✅ | ✅ |
| `/auth/callback` | GET | Supabase OAuth code exchange | — | — |

> The root `CLAUDE.md` is out of date. It lists `/api/export/drive`, which doesn't exist, and gives the wrong methods for `admin/delete-records`, `outreach/status` and `proof/case-study`. It also omits the website-proposal and proposal routes.

---

## 7. Data Model (Supabase)

| Table | Migration | Key Columns / Notes |
|---|---|---|
| `businesses` | 001 (+005, 006, 009) | `id` uuid, `user_id`, `place_id` (unique per user), contact, address, socials, emails, `web_results`, deals |
| `website_audits` | 001 (+010) | PageSpeed scores, SEO flags, CMS, analytics, freshness. **No `user_id`.** |
| `social_audits` | 001 (+010) | Per-platform JSON, coverage and engagement scores |
| `ads_audits` | 001 (+010) | Meta/Google ads, remarketing pixel, domain authority |
| `scores` | 001 | Overall score, grade, five sub-scores |
| `marketing_plans` | 001 | Plan JSON. **No `user_id`**, but `export/docs` queries one. |
| `exports` | 001 | Export history and Google file URLs |
| `user_google_tokens` | 001 | OAuth refresh tokens (one row per user) |
| `search_sets` | 007, 012 | Saved searches |
| `api_usage` | 008 | Per-call usage and cost |
| `outreach_assets`, `outreach_pipeline`, `proof_snapshots` | 011 | CRM and proof |
| `proposal_demos` | **No migration** (SQL is in `overview/proposal_demos*.sql`) | `business_id`, `html`, `demo_site_url` |

- RLS is enabled. However, all API routes use the **service-role** client, which bypasses RLS. Data isolation therefore depends entirely on explicit `.eq("user_id", …)` filters.
- Audit, score and plan rows reach the user only through `business_id`. Audit and score rows cascade-delete with the business.

---

## 8. Core Flows

1. **Search.** `POST /api/search`:
   - Places `searchText` returns up to `limit` results (max 50).
   - Each result gets a details call, a website scrape (socials, emails, tech hints) and Brave enrichment.
   - Results are upserted into `businesses`. If the upsert fails, the fallback object uses `id = place_id`, and the UI must check for a real UUID before calling audits.
2. **Audit.** The lead page runs `audit/website`, `audit/social` and `audit/ads` in parallel, then `POST /api/score`.
3. **Scoring** (`lib/scoring/engine.ts`):
   - Weights: Website 30%, Social presence 25%, Engagement 20%, Advertising 15%, Reviews 10%.
   - Weights are redistributed when an audit is missing.
   - Grades: A ≥80, B ≥60, C ≥40, D ≥20, F <20.
4. **Plan.** `getFullBusinessProfile()` → `buildPlanPrompt()` → `generateCompletion()` (Claude Haiku 4.5, 4,000 max tokens) → `parsePlanResponse()` → `marketing_plans`.
5. **Website proposal.** For businesses with no website:
   - Brave finds competitor sites.
   - Claude writes a nine-section Markdown proposal.
   - The proposal can be downloaded, exported to Drive, or paired with an uploaded demo HTML or demo URL.
6. **Outreach.** Generated assets go into the Kanban pipeline (Prospecting → Contacted → Follow-up → Proposal Sent → Won/Lost), with follow-up reminders.
7. **Proof.** Before/after screenshots feed a case study.
8. **Exports.** Sheets (colour-coded grades), Docs (plan), PDF (Puppeteer) and Drive (proposal). Each export is logged in `exports`.

### Auth Model

- `getAuthUser()` (`lib/supabase/server.ts`) returns the Supabase user. When `NEXT_PUBLIC_DISABLE_AUTH=true` it returns a mock user instead.
- `src/proxy.ts` only refreshes the session cookie. It does **not** redirect unauthenticated users.

### AI Client

- `generateCompletion(system, user, {model, maxTokens})` calls Claude first.
- If the error message matches a billing pattern ("credit balance", "quota" or "insufficient"), it opens a 5-minute circuit breaker and falls back to Pollinations, with up to two 429 retries.

### Logging

- `lib/logger.ts` appends JSONL to `logs/errors.log`.
- `instrumentation.ts` mirrors `console.error` into that log.
- Client errors arrive through `/api/log`, the `ErrorReporter` component and the error boundaries.

---

## 9. Environment Variables

| Var | Scope | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | public | ✅ | **The current project no longer exists.** |
| `SUPABASE_SERVICE_ROLE_KEY` | server | ✅ | |
| `SUPABASE_URL`, `DB_PASSWORD`, `DB_URL` | server | — | Present in `.env.local`, not read by app code. |
| `NEXT_PUBLIC_APP_URL` | public | ✅ | Defined twice in `.env.local`. |
| `NEXT_PUBLIC_DISABLE_AUTH` | public | dev | Being public means a mistaken prod value disables auth. |
| `NEXT_PUBLIC_DEV_USER_ID` | public | dev | Must exist in `auth.users`. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | server | exports | OAuth redirect: `/callback` |
| `GOOGLE_PLACES_API_KEY` | server | ✅ | Also used for PageSpeed, which is currently blocked by the key restriction. |
| `ANTHROPIC_API_KEY` | server | ✅ | |
| `AI_MODEL` | server | — | Only read by `generateDemo.ts`. |
| `POLLINATIONS_API_KEY` | server | — | The fallback endpoint is deprecated. |
| `BRAVE_SEARCH_API_KEY` | server | ✅ | |
| `OPENPAGERANK_API_KEY` | server | — | Unset, so domain authority is always the default. |
| `CHROME_EXECUTABLE_PATH` | server | Windows dev | For Puppeteer. |
| `LOG_DIR` | server | — | Defaults to `<cwd>/logs`. |

---

## 10. Room for Improvement (Prioritised)

### P0: Broken or Security-Critical

1. **Restore Supabase.** See §2.2.
2. **IDOR.** Any logged-in user can audit, score, plan or enrich another user's business by UUID.
   - The audit, score, plan, enrich and website-proposal routes, and `getFullBusinessProfile`, fetch `businesses` by `id` only.
   - The `plans`, `plans/[id]`, `leads/[id]` and `leads/[id]/outreach` pages are also unscoped.
   - Fix: add `.eq("user_id", user.id)`, or use the RLS-scoped server client for reads.
3. **Places API key leak.** Photo URLs embed `&key=…` (`api/search:233-234`), and those URLs are stored in the DB and sent to the browser. Proxy photos through a server route instead.
4. **Fix the AI fallback** (Pollinations 404) and **the retired Claude 3.5 Haiku default** in `generateDemo.ts`.
5. **Fix PageSpeed 403**: use a dedicated key or update the key restriction.
6. **Schema bugs:**
   - Add `user_id` to `marketing_plans`, or join through `businesses`. Without this, Docs export and `delete-records` are broken.
   - Add a migration for `proposal_demos` and the storage bucket.

### P1: Reliability

7. **Auth redirect in `proxy.ts`** for dashboard routes. Require auth on `/api/autocomplete/location` (it currently spends the Places quota unauthenticated) and rate-limit `/api/log`.
8. **Timeouts** with `AbortSignal.timeout` on every external fetch. These are currently missing on:
   - Pollinations
   - Places in search and competitors
   - legacy Places Details
   - `generateDemo`
9. **`maxDuration`** on the search, plan and audit routes. Search took 27s for 2 results, which will exceed default serverless limits.
10. **Search latency.**
    - Per-place details and enrichment run in sequence.
    - Use bounded concurrency (for example, 5 at a time).
    - Request details fields in the `searchText` field mask to remove N+1 detail calls.
    - Cache enrichment by `place_id`.
11. **Surface DB failures.** `/api/usage` and `/api/outreach/followups` return empty success when the DB is down. Return 5xx so the UI can show it.
12. **Parallel audit race.** The score can be computed before all three audits finish writing. Compute the score server-side after `Promise.all`, or use a single `/api/audit/full` orchestrator.
13. **SSRF guard.** Server-side fetches of `business.website` and the user-supplied `demoSiteUrl` should block private, link-local and metadata IPs.
14. **Usage tracking is fire-and-forget**, so rows can be lost on serverless. Await it or use `after()` from `next/server`.

### P2: Modernisation and Quality

15. **Upgrade `@anthropic-ai/sdk`** from 0.39 to current.
    - Consider `claude-haiku-5-5` (verified working with the current key).
    - Use structured outputs or tool use for plan JSON instead of regex parsing.
    - Use prompt caching for the large static system prompts.
    - Detect billing errors by `error.status`/type, not by message string.
16. **Replace legacy Places Details** in `enrich/emails` with Places v1, and URL-encode `place_id`.
17. **Implement Meta Ad Library**, which needs a Graph API token, or label ads detection in the UI as pixel-based only.
18. **Single browser factory.** `screenshotDemo.ts` duplicates `lib/scraper/browser.ts`. Use one helper with `finally { browser.close() }`.
19. **Tests:**
    - Fix the 2 TS errors in fixtures and the failing `calculateStringSimilarity` test.
    - Add a `"test": "vitest run"` script.
    - Add route-level tests for auth and ownership, plus mocked scraper tests.
20. **Lint:** fix the 3 `no-explicit-any` errors and clear the 36 warnings (mostly unused variables).
21. **Docs drift.** Update `CLAUDE.md`: remove `/api/export/drive`, correct the HTTP methods, add the proposal routes, `lib/competitor`, `lib/demo`, `lib/pdf`, `lib/screenshots`, and the `BRAVE_SEARCH_API_KEY`, `OPENPAGERANK_API_KEY`, `AI_MODEL` and `CHROME_EXECUTABLE_PATH` env vars.
22. **Housekeeping:**
    - Remove the duplicate `NEXT_PUBLIC_APP_URL` and the unused `DB_*` vars from `.env.local`.
    - Remove `pdfkit` if it is unused.
    - Rename `NEXT_PUBLIC_DISABLE_AUTH` to a server-only flag.
23. **Background jobs.** Move long audits and enrichment to a queue (Vercel Queues/Workflow, Supabase Edge Functions or pg-boss) with progress polling, instead of long HTTP requests.
24. **Observability.** The JSONL file logger does not work on a read-only serverless filesystem. Add Sentry or OpenTelemetry for production.

---

## 11. Dev Commands

Run these from `leadsight/`:

```bash
npm run dev       # http://localhost:3000 (falls back to 3001 if busy)
npm run build
npm run lint
npx vitest run    # no npm "test" script yet
npx tsc --noEmit
```
