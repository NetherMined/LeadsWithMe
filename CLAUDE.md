# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LeadSight** — a B2B lead generation and digital marketing audit SaaS. It finds local businesses via Google Places, audits their digital presence (website, social media, advertising), scores them 0–100, generates AI-powered marketing plans, and exports to Google Sheets/Docs/Drive.

The Next.js application lives in the `leadsight/` subdirectory. All dev commands run from there.

## Commands

Run from `leadsight/`:

```bash
npm run dev       # Dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
npm start         # Production server (after build)
```

## Critical: Next.js Version Warning

This project uses **Next.js 16.2.3**, which has breaking changes from older versions. Before writing any Next.js code, read the relevant guide in `leadsight/node_modules/next/dist/docs/`. APIs, conventions, and file structure may differ from training data.

## Architecture

### Tech Stack
- **Next.js 16 App Router** with `(dashboard)` and `(auth)` route groups
- **Supabase** — PostgreSQL + RLS. Auth via `@supabase/ssr` (cookie-based sessions)
- **Google APIs** — Places v1 (New), Sheets, Docs, Drive
- **Anthropic Claude Haiku** — primary AI; **Pollinations** (`openai-large`) as billing-error fallback
- **Puppeteer Core + @sparticuz/chromium** — serverless-compatible scraping
- **Leaflet** — map on search page, loaded client-only via `next/dynamic` (ssr: false)
- **Tailwind CSS v4** + shadcn/ui + heavy use of inline styles with CSS variables
- **Zod v4** — API request validation

### Source Layout (`leadsight/src/`)

| Path | Purpose |
|------|---------|
| `app/(dashboard)/` | Authenticated pages: search, leads, plans, outreach, exports, proof, account |
| `app/(auth)/` | Login page |
| `app/api/` | All API routes (see below) |
| `components/audit/` | Score gauge, website/social/ads cards, audit button, competitors card |
| `components/leads/` | Lead detail tabs, email enricher, outreach summary |
| `components/outreach/` | Kanban, email preview, Loom script, fee calculator, issue ranker |
| `components/search/` | Map, info panel, business/location inputs |
| `components/proof/` | Case study, snapshot, before/after comparison |
| `components/layout/` | Sidebar, header, nav, theme toggle |
| `components/providers/` | `auth-provider.tsx` — client-side auth context |
| `lib/ai/` | `client.ts` (Claude + Pollinations), `prompts.ts`, `parser.ts` |
| `lib/scraper/` | `website.ts`, `social.ts`, `ads.ts`, `deals.ts`, `web-search.ts`, `emails.ts`, `browser.ts` |
| `lib/scoring/engine.ts` | `calculateDigitalPresenceScore()` |
| `lib/google/` | `auth.ts`, `sheets.ts`, `docs.ts`, `drive.ts` |
| `lib/supabase/` | `client.ts` (browser), `server.ts` (SSR + service role), `middleware.ts`, `queries.ts` |
| `lib/usage/` | `track.ts`, `costs.ts` — API usage + cost tracking |
| `lib/outreach/` | `generator.ts`, `templates.ts`, `positioning.ts` |
| `lib/logger.ts` | Error logger — appends JSONL to `logs/errors.log` |
| `types/` | `business.ts`, `audit.ts`, `score.ts`, `plan.ts`, `export.ts`, `outreach.ts`, `constants.ts`, `helpers.ts` |

Path alias `@/*` maps to `./src/*`.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/search` | POST | Google Places search + website/web-search enrichment |
| `/api/audit/website` | POST | PageSpeed + SEO + tech stack + content freshness |
| `/api/audit/social` | POST | Social channel scoring |
| `/api/audit/ads` | POST | Meta/Google ad detection + domain authority |
| `/api/audit/competitors` | POST | Competitor discovery |
| `/api/score` | POST | Compute `DigitalPresenceScore` from audit data |
| `/api/plan` | POST | AI marketing plan generation |
| `/api/export/sheets` | POST | Export to Google Sheets |
| `/api/export/docs` | POST | Export to Google Docs |
| `/api/export/drive` | POST | Export to Google Drive |
| `/api/export/pdf` | POST | Generate PDF report |
| `/api/enrich/emails` | POST | Email address enrichment |
| `/api/outreach/generate` | POST | Generate outreach assets |
| `/api/outreach/pipeline` | GET/POST/PATCH | CRM pipeline CRUD |
| `/api/outreach/status` | PATCH | Update lead status |
| `/api/outreach/followups` | GET | Due follow-ups |
| `/api/proof/snapshot` | POST | Capture before/after screenshot |
| `/api/proof/case-study/[id]` | GET/POST | Case study management |
| `/api/search-sets` | GET/POST/PATCH/DELETE | Saved search management |
| `/api/usage` | GET | API usage stats |
| `/api/autocomplete/location` | GET | Location autocomplete |
| `/api/log` | POST | Client-side error reporting |
| `/api/admin/delete-records` | DELETE | Admin data cleanup |

### Data Flow
1. Search page: `POST /api/search` → Google Places API v1 → per-place Detail fetch + website enrichment + web search enrichment → upsert to `businesses` table
2. Lead detail: `POST /api/audit/*` (3 parallel) → upsert audit tables → `POST /api/score` → `scores` table
3. AI plan: `POST /api/plan` → `getFullBusinessProfile()` → `buildPlanPrompt()` → Claude Haiku (fallback: Pollinations) → `marketing_plans` table
4. Export: fetch business + audit + score + plan → write to Sheets/Docs/Drive

### Auth Pattern

```ts
// Server-side (API routes and server components)
import { getAuthUser } from "@/lib/supabase/server";
const user = await getAuthUser(); // returns null if unauthenticated

// Service-role DB access (bypasses RLS) — used in all API routes
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
const adminClient = createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Client-side
import { createClient } from "@/lib/supabase/client";
```

**Dev auth bypass**: set `NEXT_PUBLIC_DISABLE_AUTH=true` to skip auth entirely. The mock user ID is set via `NEXT_PUBLIC_DEV_USER_ID` (defaults to a hardcoded UUID in `server.ts`).

### AI Client (`lib/ai/client.ts`)

`generateCompletion(systemPrompt, userPrompt, options?)` tries Claude Haiku first. If a billing/quota error is detected, it opens a 5-minute circuit breaker and falls back to Pollinations (`openai-large` via OpenAI-compatible endpoint). Throws if both fail.

### Styling Convention

Pages use a mix of:
- Tailwind classes for layout (`flex`, `space-y-6`, `grid`, etc.)
- Inline `style={{ ... }}` with CSS variables (`var(--bg-surface)`, `var(--accent)`, `var(--border)`, `var(--text-primary)`, etc.) for colors and surface theming

Do not fight this pattern — both coexist intentionally.

### Business `id` vs `place_id`

`Business.id` is the Supabase UUID. `Business.place_id` is the Google Place ID. When a Supabase insert fails in `/api/search`, the fallback object sets `id = place_id` (a Google Place ID string, not a UUID). Audit routes that require a real DB record guard against this — always validate that `business.id` is a UUID before calling audit/score/plan endpoints.

### Scoring Weights (`types/constants.ts`)

| Dimension | Weight |
|-----------|--------|
| Website | 30% |
| Social presence | 25% |
| Engagement | 20% |
| Advertising | 15% |
| Reviews | 10% |

Grades: A (80–100), B (60–79), C (40–59), D (20–39), F (0–19).

### Error Logging (`lib/logger.ts`)

`logError(entry)` appends JSONL to `logs/errors.log` (ignored by git). `src/instrumentation.ts` patches `console.error` at server startup so all existing `console.error` calls are automatically captured. Client-side errors are reported via `POST /api/log` by `ErrorReporter` (mounted in root layout) and the `error.tsx` / `global-error.tsx` boundaries.

## Environment Variables

```
# Public (client-accessible)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_DISABLE_AUTH    # "true" to skip auth in dev
NEXT_PUBLIC_DEV_USER_ID     # UUID of mock dev user

# Server-only
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PLACES_API_KEY
ANTHROPIC_API_KEY
POLLINATIONS_API_KEY        # Optional — Pollinations fallback for AI
LOG_DIR                     # Optional — defaults to <cwd>/logs
```

## Project Documentation

**Read at every session start**: `overview/summary.md` — current project state, feature status, key conventions.

Detailed specs in `Project/` (16 files, `00-INDEX.md` through `16-REVIEW-CHECKPOINTS.md`). `LeadSight-Multi-Agent-Build-Plan.md` at the root is the master build plan.
