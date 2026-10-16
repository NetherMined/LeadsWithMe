# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LeadSight** — a B2B lead generation and digital marketing audit SaaS. It finds local businesses via Google Places, audits their digital presence (website, social media, advertising), scores them 0–100, generates AI-powered marketing plans, and exports to Google Sheets/Docs/Drive.

The Next.js application lives in the `leadsight/` subdirectory. All dev commands run from there.

## Commands

Run from `leadsight/`:

```bash
npm run dev          # Dev server at http://localhost:3001
npm run build        # Production build (standalone output)
npm run lint         # ESLint
npm test             # Vitest unit tests
npm start            # Production server on :3001 (after build)

npm run db:up        # Start only the Postgres container (host port 5433)
npm run db:generate  # Generate a Drizzle migration from src/lib/db/schema.ts
npm run db:migrate   # Apply migrations in drizzle/
npm run db:seed      # Create the dev user (DEV_USER_ID)
npm run db:studio    # Drizzle Studio
npm run docker:up    # Build and start db + migrate + app (app on host port 3001)
```

Ports: the app uses **3001** (3000 is taken by another local stack) and Postgres uses host port **5433** (5432 is a local Windows Postgres). Inside compose the app listens on 3000 and reaches the db at `db:5432`.

## Critical: Next.js Version Warning

This project uses **Next.js 16.2.3**, which has breaking changes from older versions. Before writing any Next.js code, read the relevant guide in `leadsight/node_modules/next/dist/docs/`. APIs, conventions, and file structure may differ from training data. Route handler files may only export handlers and route config (`maxDuration`, etc.) — put helpers in `lib/`.

## Architecture

### Tech Stack
- **Next.js 16 App Router** with `(dashboard)` and `(auth)` route groups; `src/proxy.ts` is the request gate
- **PostgreSQL 16** (Docker) + **Drizzle ORM** (`postgres.js` driver). No RLS — every query is scoped by `user_id` in code
- **Better Auth** — Google sign-in, database sessions, Google API tokens in the `accounts` table
- **Local file storage** under `UPLOAD_DIR`, served by `/api/files/[...path]`
- **Google APIs** — Places v1 (New), PageSpeed Insights, Sheets, Docs, Drive
- **Anthropic Claude** (default `claude-haiku-4-5-20251001`) — primary AI; **Pollinations** (`gen.pollinations.ai/v1`) as billing-error fallback
- **Puppeteer Core** — Debian Chromium in Docker (`CHROME_EXECUTABLE_PATH`), local Chrome on Windows/macOS, `@sparticuz/chromium` on serverless Linux
- **Leaflet** — map on search page, loaded client-only via `next/dynamic` (ssr: false)
- **Tailwind CSS v4** + shadcn/ui + heavy use of inline styles with CSS variables
- **Zod v4** — API request validation
- **Docker Compose** — `db`, one-shot `migrate`, and `app` services

### Source Layout (`leadsight/src/`)

| Path | Purpose |
|------|---------|
| `app/(dashboard)/` | Authenticated pages: search, leads, plans, outreach, exports, proof, account |
| `app/(auth)/` | Login page |
| `app/api/` | All API routes (see below) |
| `proxy.ts` | Optimistic session-cookie gate: redirects pages to `/login`, 401s `/api/*` |
| `components/audit/` | Score gauge, website/social/ads cards, audit button, competitors card |
| `components/leads/` | Lead detail tabs, email enricher, outreach summary, proposal downloads |
| `components/outreach/` | Kanban, email preview, Loom script, fee calculator, issue ranker |
| `components/search/` | Map, info panel, business/location inputs |
| `components/proof/` | Case study, snapshot, before/after comparison |
| `components/layout/` | Sidebar, header, nav, theme toggle |
| `components/providers/` | `auth-provider.tsx` — client-side session context |
| `lib/auth/` | `index.ts` (Better Auth config), `server.ts` (`getAuthUser`), `client.ts` (`authClient`) |
| `lib/db/` | `client.ts` (Drizzle `db`), `schema.ts` (all tables), `queries.ts` (user-scoped queries) |
| `lib/storage/local.ts` | Save/read user files under `UPLOAD_DIR` with path-traversal protection |
| `lib/net/safe-fetch.ts` | `safeFetch()`, `assertPublicUrl()`, `guardPage()` — SSRF guard |
| `lib/ai/` | `client.ts` (Claude + Pollinations), `prompts.ts`, `parser.ts` |
| `lib/scraper/` | `website.ts`, `social.ts`, `ads.ts`, `deals.ts`, `web-search.ts`, `emails.ts`, `browser.ts` |
| `lib/competitor/`, `lib/screenshots/`, `lib/pdf/` | Competitor deep-scrape, page screenshots, PDF report |
| `lib/demo/` | AI demo-site generation + screenshots |
| `lib/scoring/engine.ts` | `calculateDigitalPresenceScore()` |
| `lib/google/` | `auth.ts` (tokens), `places.ts` (photo proxy paths), `sheets.ts`, `docs.ts`, `drive.ts` |
| `lib/usage/` | `track.ts`, `costs.ts` — API usage + cost tracking |
| `lib/outreach/` | `generator.ts`, `templates.ts`, `positioning.ts` |
| `lib/logger.ts` | Error logger — appends JSONL to `logs/errors.log` |
| `types/` | `business.ts`, `audit.ts`, `score.ts`, `plan.ts`, `export.ts`, `outreach.ts`, `constants.ts`, `helpers.ts` |

Other top-level folders in `leadsight/`: `drizzle/` (generated SQL migrations), `scripts/` (`migrate.ts`, `seed-dev.ts`), `Dockerfile`, `docker-compose.yml`. The old Supabase migrations are kept for reference in `archive/supabase/` at the repo root.

Path alias `@/*` maps to `./src/*`.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...all]` | GET/POST | Better Auth handler (Google OAuth callback, sessions) |
| `/api/search` | POST | Google Places search + website/web-search enrichment (5 places at a time) |
| `/api/search-sets` | GET/POST/PATCH/DELETE | Saved search management |
| `/api/autocomplete/location` | GET | Location autocomplete |
| `/api/places/photo` | GET | Places photo proxy — adds the API key server-side, redirects to the image |
| `/api/businesses/[id]/proposal` | GET | Score and latest proposal demo for the search info panel |
| `/api/audit/website` | POST | PageSpeed + SEO + tech stack + content freshness; returns `warnings` |
| `/api/audit/website-proposal` | POST | AI website proposal |
| `/api/audit/social` | POST | Social channel scoring |
| `/api/audit/ads` | POST | Meta/Google ad detection + domain authority |
| `/api/audit/competitors` | POST | Competitor discovery |
| `/api/score` | POST | Compute `DigitalPresenceScore` from audit data |
| `/api/plan` | POST | AI marketing plan generation |
| `/api/enrich/emails` | POST | Email address enrichment |
| `/api/export/sheets` | POST | Export to Google Sheets |
| `/api/export/docs` | POST | Export to Google Docs |
| `/api/export/proposal-drive` | POST | Save the proposal as a Google Doc in the LeadSight Drive folder |
| `/api/export/pdf` | POST | Generate PDF report (Puppeteer) |
| `/api/proposal/demo` | POST | Generate AI demo site + screenshots |
| `/api/proposal/demo-upload` | POST | Upload demo HTML / set demo site URL |
| `/api/files/[...path]` | GET | Serve a user's uploaded file (owner only) |
| `/api/outreach/generate` | POST | Generate outreach assets |
| `/api/outreach/pipeline` | GET/POST/PATCH | CRM pipeline CRUD |
| `/api/outreach/status` | GET | Outreach assets and audit status for one business |
| `/api/outreach/followups` | GET | Due follow-ups |
| `/api/proof/snapshot` | POST | Capture before/after snapshot |
| `/api/proof/case-study/[id]` | GET | Case study data |
| `/api/usage` | GET | API usage stats |
| `/api/log` | POST | Client-side error reporting (public; 16 KB cap, 30 req/min per IP) |
| `/api/admin/delete-records` | POST | Admin data cleanup |

### Data Flow
1. Search page: `POST /api/search` → Google Places API v1 → per-place Detail fetch + website enrichment + web search enrichment → upsert to `businesses` (unique on `user_id, place_id`)
2. Lead detail: `POST /api/audit/*` → upsert audit tables → `POST /api/score` → `scores` table
3. AI plan: `POST /api/plan` → `getFullBusinessProfile(id, userId)` → `buildPlanPrompt()` → Claude (fallback: Pollinations) → `marketing_plans` table
4. Export: fetch business + audit + score + plan → write to Sheets/Docs/Drive with the user's Google token, or render a PDF

### Auth Pattern

```ts
// Server-side (API routes and server components)
import { getAuthUser } from "@/lib/auth/server";
const user = await getAuthUser(); // { id, email, name } or null

// Database access — always scope by the caller
import { db } from "@/lib/db/client";
import { getBusinessById } from "@/lib/db/queries";
const business = await getBusinessById(id, user.id); // null if missing or not owned

// Google API token (auto-refreshed from the Better Auth accounts table)
import { getValidGoogleToken } from "@/lib/google/auth";

// Client-side
import { authClient } from "@/lib/auth/client";
```

`src/proxy.ts` only checks that a session cookie exists; full validation happens in `getAuthUser()`. Return 404 (not 403) for another user's records.

**Dev auth bypass**: set server-only `DISABLE_AUTH=true` to skip auth. The mock user is `DEV_USER_ID`, created by `npm run db:seed` (the compose `migrate` service seeds it automatically when `DEV_USER_ID` is set).

Google OAuth redirect URI: `http://localhost:3001/api/auth/callback/google`. Sign-in requests offline access with Sheets, Docs and Drive scopes; the user must tick those boxes on the consent screen or exports fail.

### Outbound Requests

- Fetches of business websites or URLs scraped from them must use `safeFetch()` from `lib/net/safe-fetch.ts`. It blocks private, loopback, link-local and metadata addresses at connect time and on every redirect. Fixed third-party APIs (Places, Brave, OpenPageRank) use plain `fetch`.
- Before `page.goto()` on such a URL, call `assertPublicUrl(url)` and `guardPage(page)`.
- Every external fetch needs `signal: AbortSignal.timeout(ms)`. Long routes export `maxDuration`.
- Never put API keys in URLs that reach the client or the database. Places photos go through `/api/places/photo` (`placePhotoPath()` in `lib/google/places.ts`).

### AI Client (`lib/ai/client.ts`)

`generateCompletion(systemPrompt, userPrompt, options?)` calls Claude (`options.model` → `AI_MODEL` → `claude-haiku-4-5-20251001`). On a billing error (HTTP 402 / `billing_error`, or the legacy 400 "credit balance" error) it opens a 5-minute circuit breaker and falls back to Pollinations (`POLLINATIONS_MODEL`, default `openai/gpt-5.4-mini`). Other errors are thrown. All AI features, including demo generation, go through this function.

### Styling Convention

Pages use a mix of:
- Tailwind classes for layout (`flex`, `space-y-6`, `grid`, etc.)
- Inline `style={{ ... }}` with CSS variables (`var(--bg-surface)`, `var(--accent)`, `var(--border)`, `var(--text-primary)`, etc.) for colors and surface theming

Do not fight this pattern — both coexist intentionally.

### Business `id` vs `place_id`

`Business.id` is the database UUID. `Business.place_id` is the Google Place ID. When a database insert fails in `/api/search`, the fallback object sets `id = place_id` (not a UUID). Audit, score and plan routes validate `business_id` as a UUID — check `business.id` before calling them.

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

`logError(entry)` appends JSONL to `logs/errors.log` (ignored by git; a volume in Docker). `src/instrumentation.ts` patches `console.error` at server startup so all existing `console.error` calls are automatically captured. Client-side errors are reported via `POST /api/log` by `ErrorReporter` (mounted in root layout) and the `error.tsx` / `global-error.tsx` boundaries.

## Environment Variables

See `leadsight/.env.example`. Copy it to `leadsight/.env.local`; docker compose reads `.env.local` too and overrides `DATABASE_URL` and `UPLOAD_DIR` for the containers.

```
# Database and auth
DATABASE_URL                # postgres://leadsight:leadsight@localhost:5433/leadsight for local dev
BETTER_AUTH_SECRET          # openssl rand -base64 32
BETTER_AUTH_URL             # http://localhost:3001
NEXT_PUBLIC_APP_URL         # http://localhost:3001

# Google
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PLACES_API_KEY
PAGESPEED_API_KEY           # Optional — falls back to GOOGLE_PLACES_API_KEY (PageSpeed API must be enabled on it)

# AI
ANTHROPIC_API_KEY
AI_MODEL                    # Optional — default claude-haiku-4-5-20251001
POLLINATIONS_API_KEY        # Optional — enables the fallback
POLLINATIONS_MODEL          # Optional — default openai/gpt-5.4-mini

# Optional services and paths
BRAVE_SEARCH_API_KEY        # Web search enrichment, competitor discovery
OPENPAGERANK_API_KEY        # Domain authority
UPLOAD_DIR                  # Default ./data/uploads (/data/uploads in Docker)
CHROME_EXECUTABLE_PATH      # Chrome/Chromium binary for Puppeteer
LOG_DIR                     # Default <cwd>/logs

# Dev only (server-side)
DISABLE_AUTH                # "true" to skip auth
DEV_USER_ID                 # UUID of the seeded dev user
```

The GitHub repo is public: never commit `.env*` (except `.env.example`) or `.claude/settings.local.json`.

## Project Documentation

**Read at every session start**: `overview/summary.md` — links to the current project state and feature overview.

`overview/plan-postgres-docker.md` is the (completed) Supabase → Postgres/Drizzle/Better Auth/Docker migration plan. `overview/project_overview.md` holds the technical spec, health notes and backlog.
