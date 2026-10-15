# LeadSight — System Reference

> **Purpose of this file.** This is the single source of truth for *what every part of LeadSight does and where it lives*. Before you change a function or add something to a page, find that page or API below, see what it touches, then edit. After you ship a change, update the matching entry **and** add a line to the [Changelog](#changelog) at the bottom.

> **How entries are built.** Routes, APIs, tables, and logic files are drawn from the project overview. Where an exact component/variable name isn't documented, the entry describes the *object on the page* by its behaviour and marks it `(confirm name in code)`. Replace those with real names as you touch each file — that's how this doc gets more accurate over time.

---

## Table of Contents

1. [How to use & update this doc](#how-to-use--update-this-doc)
2. [System summary](#system-summary)
3. [Tech stack](#tech-stack)
4. [Global conventions (read before editing anything)](#global-conventions)
5. [Page reference](#page-reference)
6. [API reference](#api-reference)
7. [Logic / library file map](#logic--library-file-map)
8. [Data model](#data-model)
9. [Scoring engine](#scoring-engine)
10. [Feature spotlight: Website Proposal + Demo Site](#feature-spotlight-website-proposal--demo-site)
11. [Environment variables](#environment-variables)
12. [Changelog](#changelog)

---

## How to use & update this doc

- **Find by page:** go to [Page reference](#page-reference), each page has its route, file path, on-page objects, APIs it calls, and the tables/logic behind it.
- **Find by endpoint:** go to [API reference](#api-reference).
- **Find by table or helper file:** go to [Data model](#data-model) or [Logic file map](#logic--library-file-map).
- **When you add a page:** copy the [page entry template](#page-entry-template) and fill it in.
- **When you add an API:** add a row to [API reference](#api-reference) and link it from the page that calls it.
- **When you add a table:** add it to [Data model](#data-model).
- **Always:** add a dated line to the [Changelog](#changelog).

---

## System summary

LeadSight is a B2B lead-generation and digital-audit SaaS for marketing agencies, freelancers, and consultants. The workflow is: **find local businesses → audit their digital presence → score them → generate an AI marketing plan / website proposal → run outreach → export & track in a CRM**. The goal is to walk into a sales meeting already knowing what's wrong with a prospect's digital presence and what it costs to fix.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Auth | Supabase Auth, cookie sessions (`@supabase/ssr`) |
| AI | Claude Haiku (primary) + Pollinations `openai-large` (fallback) |
| Business data | Google Places API v1 |
| Website scraping / screenshots | Puppeteer Core + `@sparticuz/chromium` |
| Social scraping | Cheerio + fetch (UA spoofing) |
| Web search | Brave Search API |
| Maps | Leaflet (client-only via `next/dynamic`) |
| Validation | Zod v4 |
| Exports | Google Sheets / Docs / Drive APIs |
| PDF | Puppeteer-based generation |
| Logging | JSONL logger + `console.error` patch |

App root: `leadsight/`. Source under `leadsight/src/` (the `@/` alias resolves here). Route groups: `(dashboard)/` for authenticated pages, `(auth)/` for login.

---

## Global conventions

These affect almost every edit — check them before changing data or auth logic.

**Auth**
```ts
// Server (API routes, server components)
import { getAuthUser } from "@/lib/supabase/server";
const user = await getAuthUser(); // null if unauthenticated

// Service-role DB access (bypasses RLS) — used in all API routes
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
const adminClient = createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Client
import { createClient } from "@/lib/supabase/client";
```
Dev bypass: `NEXT_PUBLIC_DISABLE_AUTH=true`, mock user via `NEXT_PUBLIC_DEV_USER_ID`.

**`business.id` vs `business.place_id`** — `id` is the Supabase UUID; `place_id` is the Google Place ID. If a search upsert fails, the fallback sets `id = place_id`. Audit/scoring routes **validate that `business.id` is a UUID** before proceeding. Honour this guard in any new route that takes a business id.

**Styling** — pages deliberately mix three things; don't fight them:
- Tailwind classes for layout (`flex`, `grid`, `space-y-6`)
- Inline `style={{}}` with CSS variables for colour/surfaces (`var(--bg-surface)`, `var(--accent)`, `var(--border)`, `var(--text-primary)`)
- shadcn/ui for interactive elements

**Row-Level Security** — every table is RLS-scoped per user. API routes use the service-role key (bypasses RLS); client reads rely on the policies.

**Errors** — `logError()` appends JSONL to `logs/errors.log`; `src/instrumentation.ts` patches `console.error`; client errors post to `/api/log`; `error.tsx` / `global-error.tsx` catch render failures.

---

## Page reference

> File paths assume `leadsight/src/app/(group)/<route>/page.tsx`.

### `/dashboard`
- **File:** `app/(dashboard)/dashboard/page.tsx`
- **Function:** Landing page after login; overview / home.
- **On-page objects:** summary widgets / entry links to Search, Leads, Outreach `(confirm names in code)`.
- **APIs called:** none documented (reads aggregate data — confirm).
- **Data:** reads from Supabase as needed.
- **To modify:** this is the hub; add new top-level navigation/summary cards here.

### `/search`
- **File:** `app/(dashboard)/search/page.tsx`
- **Function:** Business discovery by type + location.
- **On-page objects:**
  - Business-type input + location input with autocomplete
  - "Search" trigger
  - **Leaflet map** with pins (client-only via `next/dynamic`)
  - Results **cards** in a side panel — each card shows social icons, links to the lead detail page, and gets a **red border when no website was found**
  - Red-bordered cards expose **"Generate Website Proposal"** and **"Generate Demo Site"** actions (see [Feature spotlight](#feature-spotlight-website-proposal--demo-site))
  - Saved-search controls
- **APIs called:** `POST /api/search`, `GET /api/autocomplete/location`, `GET/POST/PATCH/DELETE /api/search-sets`, `POST /api/audit/website-proposal`, `POST /api/proposal/demo`
- **Data:** writes/upserts `businesses` (dedupe on `place_id` per user); `search_sets`
- **To modify:** card visuals and the no-website flagging live here; search behaviour lives in `/api/search`.

### `/leads`
- **File:** `app/(dashboard)/leads/page.tsx`
- **Function:** All saved leads in a table/grid.
- **On-page objects:** sortable/filterable table — columns: name, category, location, Digital Presence Score, grade badge, actions. Sort by name/score/date; filter by category, grade, website presence, social presence.
- **APIs called:** reads from Supabase directly (no dedicated route documented).
- **Data:** `businesses`, `scores`
- **To modify:** add columns/filters here; underlying scores come from the scoring engine.

### `/leads/[id]`
- **File:** `app/(dashboard)/leads/[id]/page.tsx`
- **Function:** Full audit view for one business.
- **On-page objects:**
  - Business header (name, category, contact, rating)
  - **"Run Full Audit"** trigger (runs the three audits in parallel)
  - Website-audit panel (PageSpeed, SEO, tech stack, freshness)
  - Social-audit panel (per-platform data, benchmarks, missing-platform highlights)
  - Ads & domain-authority panel
  - Competitor section
  - **Animated circular gauge** showing Digital Presence Score + grade
  - **"Generate Plan"** trigger
  - Email-enrichment trigger
- **APIs called:** `POST /api/audit/website`, `POST /api/audit/social`, `POST /api/audit/ads`, `POST /api/audit/competitors`, `POST /api/score`, `POST /api/plan`, `POST /api/enrich/emails`
- **Data:** `website_audits`, `social_audits`, `ads_audits`, `scores`, `marketing_plans`
- **To modify:** audit display lives here; audit logic lives in the `/api/audit/*` routes; score weighting lives in `lib/scoring/engine.ts`.

### `/leads/[id]/outreach`
- **File:** `app/(dashboard)/leads/[id]/outreach/page.tsx`
- **Function:** Outreach assets for one lead.
- **On-page objects:**
  - AI cold email (referencing specific audit findings)
  - Loom video script (talking points)
  - Fee calculator (prices service based on audit gaps)
  - Issue ranker (prioritises problems by business impact)
- **APIs called:** `POST /api/outreach/generate`
- **Data:** `businesses`, audits, `scores`; (also a natural place to surface `proposal_demos`)
- **To modify:** asset generation lives in `lib/outreach/generator.ts`, `templates.ts`, `positioning.ts`.

### `/outreach`
- **File:** `app/(dashboard)/outreach/page.tsx`
- **Function:** Kanban pipeline CRM across all leads.
- **On-page objects:** Kanban board — stages **Prospecting → Contacted → Follow-up → Proposal Sent → Won/Lost**; drag-and-drop cards; follow-up due-date indicators.
- **APIs called:** `GET/POST/PATCH /api/outreach/pipeline`, `PATCH /api/outreach/status`, `GET /api/outreach/followups`
- **Data:** `outreach_pipeline`
- **To modify:** stage definitions and DnD behaviour here; status persistence in the pipeline/status routes.

### `/proof`
- **File:** `app/(dashboard)/proof/page.tsx`
- **Function:** Before/after proof-of-results and case studies for active clients.
- **On-page objects:** snapshot capture control; side-by-side before/after screenshot comparison (timestamped); case-study documents.
- **APIs called:** `POST /api/proof/snapshot`, `GET/POST /api/proof/case-study/[id]`
- **Data:** `proof_snapshots`, `case_studies`
- **To modify:** screenshot capture logic is `lib/screenshots/capture.ts` (shared with the demo feature).

### `/exports`
- **File:** `app/(dashboard)/exports/page.tsx`
- **Function:** History of all exports (Sheets, Docs, Drive, PDF, Proposal).
- **On-page objects:** export history list with links back to the Google files.
- **APIs called:** `POST /api/export/sheets`, `POST /api/export/docs`, `POST /api/export/drive`, `POST /api/export/pdf`, `POST /api/export/proposal-drive`
- **Data:** `exports`, `user_google_tokens`
- **To modify:** per-format logic in `lib/google/*` and `lib/pdf/generator.ts`.

### `/plans`
- **File:** `app/(dashboard)/plans/page.tsx`
- **Function:** List of all generated marketing plans.
- **On-page objects:** list of plans linking to the viewer.
- **APIs called:** reads `marketing_plans`.
- **Data:** `marketing_plans`

### `/plans/[id]`
- **File:** `app/(dashboard)/plans/[id]/page.tsx`
- **Function:** Full marketing-plan viewer.
- **On-page objects:** **tabbed viewer** — Executive Summary, Website Recommendations, Social Strategy, Advertising Roadmap, Quick Wins, Medium-Term, Long-Term, Outreach Email. Each recommendation shows a **priority badge** (high/medium/low) and **effort tag** (quick win / medium / strategic).
- **APIs called:** `POST /api/plan` (generation); reads `marketing_plans`.
- **Data:** `marketing_plans`
- **To modify:** plan shape comes from `lib/ai/prompts.ts` + `lib/ai/parser.ts`.

### `/account`
- **File:** `app/(dashboard)/account/page.tsx`
- **Function:** User account, settings, and usage display.
- **On-page objects:** account settings; **usage panel** (API call counts + estimated costs).
- **APIs called:** `GET /api/usage`
- **Data:** usage tracking via `lib/usage/track.ts`, `costs.ts`
- **To modify:** cost model in `lib/usage/costs.ts`.

### `(auth)/login`
- **File:** `app/(auth)/login/page.tsx`
- **Function:** Login.
- **On-page objects:** Supabase Auth login form.
- **To modify:** auth helpers in `lib/supabase/server.ts` / `client.ts`.

#### Page entry template
```md
### `/route`
- **File:** app/(group)/route/page.tsx
- **Function:** one-line purpose
- **On-page objects:** list each UI element / section / component
- **APIs called:** endpoints this page hits
- **Data:** tables read/written
- **To modify:** where the real logic lives
```

---

## API reference

| Endpoint | Method(s) | Purpose | Backing logic |
|---|---|---|---|
| `/api/search` | POST | Google Places text search + place details + website enrichment; upsert into `businesses` | Places API, enrichment scrapers |
| `/api/search-sets` | GET/POST/PATCH/DELETE | Save / re-run / edit / delete searches | `search_sets` |
| `/api/autocomplete/location` | GET | Location suggestions while typing | Places API |
| `/api/audit/website` | POST | PageSpeed + SEO + tech detection + content freshness | → `website_audits` |
| `/api/audit/social` | POST | Per-platform scrape + benchmarks + coverage/engagement scores | → `social_audits` |
| `/api/audit/ads` | POST | Meta Ad Library, Google Ads pixel detection, domain authority (Open PageRank) | → `ads_audits` |
| `/api/audit/competitors` | POST | Discover competitors, scrape tech/structure, AI A/B suggestions | feeds PDF reports |
| `/api/audit/website-proposal` | POST | Generate the 9-section website proposal `.md` (no-website leads) | `lib/ai/*`, Brave Search |
| `/api/score` | POST | Composite Digital Presence Score | `lib/scoring/engine.ts` → `scores` |
| `/api/plan` | POST | AI marketing plan (Claude Haiku → Pollinations fallback) | `lib/ai/*` → `marketing_plans` |
| `/api/enrich/emails` | POST | Scrape contact emails from the site | `lib/scraper/emails.ts` |
| `/api/outreach/generate` | POST | Cold email, Loom script, fee calc, issue ranker | `lib/outreach/*` |
| `/api/outreach/pipeline` | GET/POST/PATCH | CRM pipeline read/create/update | `outreach_pipeline` |
| `/api/outreach/status` | PATCH | Move a lead between stages | `outreach_pipeline` |
| `/api/outreach/followups` | GET | Follow-ups due | `outreach_pipeline` |
| `/api/proof/snapshot` | POST | Capture before/after website screenshot | `lib/screenshots/capture.ts` → `proof_snapshots` |
| `/api/proof/case-study/[id]` | GET/POST | Read/create a case study | `case_studies` |
| `/api/export/sheets` | POST | Formatted Google Sheet of leads | `lib/google/sheets.ts` |
| `/api/export/docs` | POST | Marketing plan → Google Doc | `lib/google/docs.ts` |
| `/api/export/drive` | POST | Save file to LeadSight Drive folder | `lib/google/drive.ts` |
| `/api/export/pdf` | POST | Puppeteer PDF of full plan + screenshots | `lib/pdf/generator.ts` |
| `/api/export/proposal-drive` | POST | Proposal `.md` → Google Doc | `lib/google/*` |
| `/api/usage` | GET | API call counts + cost estimates | `lib/usage/*` |
| `/api/log` | POST | Client-side error reporting | `lib/logger.ts` |
| `/api/proposal/demo` | POST | **New** — generate single-file HTML demo, screenshot, store on lead | `lib/demo/*` → `proposal_demos` |

---

## Logic / library file map

| File | Responsibility |
|---|---|
| `lib/supabase/server.ts` | Server auth (`getAuthUser`) + server client |
| `lib/supabase/client.ts` | Browser client |
| `lib/scoring/engine.ts` | Weighted Digital Presence Score |
| `lib/ai/client.ts` | Claude Haiku call + 5-min circuit breaker + Pollinations fallback |
| `lib/ai/prompts.ts` | Prompt templates for plans / proposals |
| `lib/ai/parser.ts` | Parses model JSON (markdown-wrapped, trailing commas) |
| `lib/outreach/generator.ts` | Builds outreach assets |
| `lib/outreach/templates.ts` | Email / script templates |
| `lib/outreach/positioning.ts` | Positioning logic |
| `lib/screenshots/capture.ts` | Chromium screenshot capture (proof + demo) |
| `lib/google/sheets.ts` | Sheets export |
| `lib/google/docs.ts` | Docs export |
| `lib/google/drive.ts` | Drive file/folder ops |
| `lib/pdf/generator.ts` | PDF report (plan + screenshots + competitors) |
| `lib/scraper/emails.ts` | Email enrichment (filters image/CDN false positives) |
| `lib/usage/track.ts` | Usage counters |
| `lib/usage/costs.ts` | Cost model |
| `lib/logger.ts` | JSONL error logger |
| `src/instrumentation.ts` | Patches `console.error` at startup |
| `lib/demo/generateDemo.ts` | **New** — AI prompt + single-file HTML generation |
| `lib/demo/screenshotDemo.ts` | **New** — `setContent` render + desktop/mobile screenshots |

---

## Data model

All tables RLS-scoped per user.

| Table | Holds |
|---|---|
| `businesses` | Core lead data from Google Places |
| `website_audits` | PageSpeed, SEO, tech stack, freshness |
| `social_audits` | Per-platform data + scores |
| `ads_audits` | Meta/Google ads detection, domain authority |
| `scores` | Composite Digital Presence Score |
| `marketing_plans` | AI plan JSON |
| `outreach_pipeline` | CRM stage/status per lead |
| `exports` | Export history + Google file URLs |
| `search_sets` | Saved searches |
| `proof_snapshots` | Before/after screenshot metadata |
| `case_studies` | Proof-of-results documents |
| `user_google_tokens` | OAuth tokens for Google Workspace |
| `proposal_demos` | **New** — generated HTML demo + screenshot URLs, linked to a lead |

---

## Scoring engine

`POST /api/score` → `lib/scoring/engine.ts`. Single **Digital Presence Score (0–100)**:

| Dimension | Weight | Source |
|---|---|---|
| Website quality | 30% | PageSpeed + SEO + freshness |
| Social presence | 25% | Platform coverage |
| Social engagement | 20% | Engagement score |
| Advertising | 15% | Meta + Google ads + domain authority |
| Reviews | 10% | Google rating + review count |

Missing audits → weights redistribute proportionally.

| Score | Grade | Label |
|---|---|---|
| 80–100 | A | Digital Leader |
| 60–79 | B | Strong Online Presence |
| 40–59 | C | Growing Online |
| 20–39 | D | Needs Attention |
| 0–19 | F | Digital Ghost |

**To change weights or grade bands:** edit `lib/scoring/engine.ts` only; the gauge on `/leads/[id]` reads the stored result.

---

## Feature spotlight: Website Proposal + Demo Site

For no-website leads, two outputs:

**1. Website Proposal (`.md`)** — `POST /api/audit/website-proposal`. Generates a 9-section markdown brief (Executive Summary, Brand Identity, Competitor Analysis, Proposed Structure, Content Brief, Design Direction, Technical Recommendations, AI Build Prompt, Next Steps). Returns `{ markdown, filename }` for direct download; `POST /api/export/proposal-drive` saves it as a Google Doc.

**2. Demo Site (single-file HTML)** — `POST /api/proposal/demo`. Generates one self-contained HTML document, screenshots it desktop + mobile via Puppeteer `setContent()` (no localhost server — runs in the existing serverless setup), uploads PNGs to the `proposal-demos` Storage bucket, and saves a `proposal_demos` row linked to the lead.
- **Trigger UI:** `components/ProposalActions.tsx` (both buttons).
- **Logic:** `lib/demo/generateDemo.ts` (prompt + HTML), `lib/demo/screenshotDemo.ts` (render + capture).
- **Constraint to preserve:** the prompt forbids external images/fonts (inline gradients/SVG only) so screenshots render deterministically — loosening this risks blank captures.
- **Open hookups:** surface the demo + screenshots in `/leads/[id]/outreach` (via `lib/outreach/generator.ts`) and in the PDF (`lib/pdf/generator.ts`).

---

## Environment variables

```
# Public
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_DISABLE_AUTH        # "true" to skip auth in dev
NEXT_PUBLIC_DEV_USER_ID         # mock dev user UUID

# Server
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PLACES_API_KEY           # also PageSpeed Insights
ANTHROPIC_API_KEY
POLLINATIONS_API_KEY            # optional fallback
BRAVE_SEARCH_API_KEY
LOG_DIR                         # optional, defaults to <cwd>/logs

# Added for demo feature (optional)
CHROME_EXECUTABLE_PATH          # local Chrome path for Puppeteer in dev
AI_MODEL                        # override default Haiku model id
```

Dev commands (from `leadsight/`): `npm run dev`, `npm run build`, `npm run lint`, `npm start`.

---

## Changelog

> Add a dated line whenever you change the system. Newest at top.

- **2026-05-30** — Created this reference doc from the project overview. Added Website Demo Site feature: `POST /api/proposal/demo`, `lib/demo/generateDemo.ts`, `lib/demo/screenshotDemo.ts`, `components/ProposalActions.tsx`, and the `proposal_demos` table + `proposal-demos` Storage bucket.
