# LeadSight — Complete Application Overview

## What Is LeadSight?

LeadSight is a B2B lead generation and digital marketing audit SaaS built for marketing agencies, freelancers, and consultants. The core idea: find local businesses, automatically analyse the quality of their digital presence, score them, and generate a ready-to-present AI marketing improvement plan — all in one workflow.

The target user is a marketing professional who wants to walk into a sales meeting already knowing exactly what is wrong with a prospect's digital presence and what it will cost to fix it.

---

## The Problem It Solves

Before LeadSight, a marketing consultant would manually:
1. Google businesses in a target area
2. Manually check each website, social media, and ad activity
3. Write notes and a proposal from scratch
4. Spend hours on work that generates zero income until a deal closes

LeadSight automates the entire discovery-to-proposal pipeline, producing audit reports and AI-written marketing plans in minutes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router + Tailwind CSS v4 + shadcn/ui |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Auth | Supabase Auth with cookie-based sessions (`@supabase/ssr`) |
| AI | Claude Haiku (primary) + Pollinations `openai-large` (billing fallback) |
| Business Data | Google Places API v1 (New) |
| Website Scraping | Puppeteer Core + @sparticuz/chromium (serverless-compatible) |
| Social Scraping | Cheerio + fetch with User-Agent spoofing |
| Web Search | Brave Search API |
| Maps | Leaflet (client-only, loaded via `next/dynamic`) |
| Validation | Zod v4 |
| Exports | Google Sheets API + Google Docs API + Google Drive API |
| PDF | Puppeteer-based PDF generation |
| Error Logging | Custom JSONL logger + `console.error` patch via instrumentation |

---

## Application Structure

The app lives in `leadsight/` and uses Next.js App Router with two route groups:

- `(dashboard)/` — all authenticated pages
- `(auth)/` — login page

### Dashboard Pages

| Route | Purpose |
|---|---|
| `/dashboard` | Overview / home after login |
| `/search` | Business discovery — search by type and location |
| `/leads` | All saved leads (businesses) |
| `/leads/[id]` | Full audit view for a single business |
| `/leads/[id]/outreach` | Outreach assets for a specific lead |
| `/outreach` | Kanban pipeline CRM for all leads in progress |
| `/proof` | Before/after proof-of-results and case studies |
| `/exports` | History of all exports (Sheets, Docs, Drive, PDF) |
| `/plans` | List of all generated marketing plans |
| `/plans/[id]` | Full marketing plan viewer |
| `/account` | User account and settings |

---

## Core Features and Workflows

### 1. Business Search

**Page:** `/search`
**API:** `POST /api/search`

The user enters a business type (e.g. "restaurants") and a location (e.g. "Cape Town"). The app:

1. Calls **Google Places API v1** text search, fetching up to 20 results
2. For each result, calls the Place Details endpoint to get phone, website, and reviews
3. If a website is found, runs **website enrichment** — scrapes social media links, meta tags, technology hints (WordPress, Shopify, Wix, etc.), and contact emails
4. If no website is found, runs a **Brave web search** to find social media bios that might link to a website, and optionally **generates an AI website proposal** for the listing
5. Upserts all results into the `businesses` Supabase table (deduplicates on `place_id` per user)
6. Displays results as cards on a **Leaflet map** with pins and a side panel

Search results are visually flagged:
- Red border on cards where no website was found
- Social icons indicating which platforms the business is active on
- Each card links to the lead detail page

**Saved Searches:** Users can save searches via `GET/POST/PATCH/DELETE /api/search-sets` and re-run them later.

**Location Autocomplete:** `GET /api/autocomplete/location` provides suggestions as the user types a location.

---

### 2. Lead Management

**Page:** `/leads`
**API:** (reads from Supabase directly)

A table/grid of all saved leads showing: name, category, location, digital presence score, grade badge, and actions. Sortable by name, score, date added. Filterable by category, grade, website presence, and social presence.

---

### 3. Business Audit

**Page:** `/leads/[id]`
**APIs:** `POST /api/audit/website`, `POST /api/audit/social`, `POST /api/audit/ads`

The lead detail page runs three parallel audits when the user clicks "Run Full Audit":

#### Website Audit (`/api/audit/website`)
- **PageSpeed Insights**: performance, SEO, accessibility, and best-practices scores (0–100 each)
- **SEO scan**: title tag, meta description, H1 count, image alt text %, structured data, sitemap, robots.txt, canonical URL, Open Graph tags
- **Technology detection**: CMS (WordPress, Shopify, Wix, Squarespace, Webflow, custom), analytics (GA4, Meta Pixel), chat widgets, SSL, mobile viewport
- **Content freshness**: checks blog/news, extracts latest post date, scores recency
- Results stored in `website_audits` table

#### Social Media Audit (`/api/audit/social`)
- Per-platform scrapers for: Facebook, Instagram, LinkedIn, TikTok, Twitter/X, YouTube
- Extracts: existence, verified status, follower count, recent post count, engagement rate, last post date, bio completeness
- **Industry benchmarks**: maps business category to expected platform mix (e.g. restaurants = Instagram critical, LinkedIn irrelevant)
- Calculates platform coverage score and engagement score
- Highlights missing platforms that are critical for the business type
- Results stored in `social_audits` table

#### Ads & Domain Authority Audit (`/api/audit/ads`)
- **Meta Ad Library**: checks for active Facebook/Instagram ads
- **Google Ads detection**: checks for Google Ads tracking pixels (`gtag` with `AW-` prefix) and remarketing pixels as a probabilistic signal
- **Domain authority**: uses Open PageRank API (free, 10k lookups/month) to estimate backlink strength
- Results stored in `ads_audits` table

#### Competitor Analysis (`/api/audit/competitors`)
- Discovers top local competitors in the same category
- Scrapes their tech stack, page structure, and design patterns
- AI generates A/B testing suggestions based on differences between the business and its competitors
- Results power the competitor section in PDF reports

---

### 4. Digital Presence Scoring

**API:** `POST /api/score`
**Logic:** `lib/scoring/engine.ts`

After audits complete, the app calculates a single **Digital Presence Score (0–100)** using weighted sub-scores:

| Dimension | Weight | Source |
|---|---|---|
| Website quality | 30% | PageSpeed + SEO + freshness |
| Social presence | 25% | Platform coverage score |
| Social engagement | 20% | Engagement score |
| Advertising | 15% | Meta ads + Google ads + domain authority |
| Reviews | 10% | Google rating + review count |

**Grade scale:**

| Score | Grade | Label |
|---|---|---|
| 80–100 | A | Digital Leader |
| 60–79 | B | Strong Online Presence |
| 40–59 | C | Growing Online |
| 20–39 | D | Needs Attention |
| 0–19 | F | Digital Ghost |

If any audit is missing, weights redistribute proportionally. Score and grade are stored in the `scores` table and displayed as an animated circular gauge on the lead detail page.

---

### 5. AI Marketing Plan Generation

**Page:** `/plans/[id]`
**API:** `POST /api/plan`
**AI:** `lib/ai/client.ts`, `lib/ai/prompts.ts`, `lib/ai/parser.ts`

The user clicks "Generate Plan" on a lead. The app:

1. Fetches the full business profile: business info + all three audits + score
2. Builds a data-rich prompt referencing specific audit findings
3. Calls **Claude Haiku** (primary). If a billing or quota error is detected, a 5-minute circuit breaker opens and the app falls back to **Pollinations** (`openai-large` via OpenAI-compatible endpoint)
4. Parses the JSON response (handles markdown-wrapped JSON, trailing commas, etc.)
5. Stores the plan in `marketing_plans` table

The generated plan includes:
- Executive summary
- Website recommendations (with priority and effort level)
- Social media strategy
- Advertising roadmap
- Quick wins (high impact, low effort actions)
- Medium-term actions
- Long-term strategy
- A draft cold outreach email referencing specific findings

Plans are displayed in a tabbed viewer. Each recommendation shows its priority badge (high/medium/low) and effort tag (quick win / medium / strategic).

---

### 6. AI Website Proposal Generator

**Triggered from:** Search results page (red-bordered cards — businesses with no website) **and** lead detail page (`/leads/[id]`)
**APIs:** `POST /api/audit/website-proposal`, `POST /api/proposal/demo-upload`
**Export:** `POST /api/export/proposal-drive`
**Component:** `ProposalDownloads` (`src/components/leads/proposal-downloads.tsx`)

For any business that has no website, LeadSight can generate a full, ready-to-present website proposal document — a complete brief a consultant can hand to a client or use to pitch website design services.

**How it works:**

1. The user clicks "Generate Website Proposal" on a red-bordered search card (no website detected) **or** on the lead detail page
2. The API fetches the business details: name, category, address, phone, rating, description, social links, and any web results previously scraped
3. It runs a **Brave Search** for `{category} {city} website` and collects up to 5 real competitor websites, filtering out directories (Yelp, TripAdvisor, Yellow Pages) and social platforms
4. **Claude Haiku** (with Pollinations fallback) generates a comprehensive proposal in Markdown format
5. A **progress bar** is shown in the UI during generation

**The generated `.md` document contains 9 sections:**

| Section | Content |
|---|---|
| Executive Summary | Opportunity overview and recommended approach |
| Brand Identity Analysis | Inferred brand personality, target audience, key differentiators (based on social presence and category) |
| Competitor Analysis | For each competitor found: what they do well, gaps to exploit, design patterns worth referencing |
| Proposed Website Structure | Pages and sections — homepage hero, services, about, testimonials, contact, plus category-specific pages |
| Content Brief | Per-page headline copy suggestions, key messages, photo/media requirements, call-to-action text |
| Design Direction | Colour palette with hex codes, typography, visual style, mobile-first considerations |
| Technical Recommendations | Platform recommendation (Next.js / Webflow / WordPress), essential features, SEO foundation, performance targets |
| AI Build Prompt | A complete, ready-to-paste prompt for Cursor / Claude / Bolt to generate a demo website |
| Next Steps | Numbered action list to get started |

**Proposal output options:**

- **Download as `.md` file** — the API returns `{ markdown, filename }` where `filename` is `{business-name}-website-proposal.md`. The frontend downloads this directly to the user's computer.
- **Export to Google Drive** — `POST /api/export/proposal-drive` creates a Google Doc titled `Website Proposal - {Business Name} - {date}`, inserts the markdown as plain text, moves it to the user's "LeadSight" Drive folder, and logs it in the `exports` table.

**Demo site (`ProposalDownloads` component on lead detail page):**

After a proposal `.md` is generated and stored in the DB, the `ProposalDownloads` component appears on the lead detail page. It provides:

- **Download Proposal (.md)** — re-downloads the stored proposal markdown
- **Upload HTML Demo** — file picker to upload a custom `.html` demo site file. Stored via `POST /api/proposal/demo-upload` into the `proposal_demos` table
- **Demo Site URL** — optional URL field. If set, the "View Site" button opens this URL instead of the uploaded HTML
- **View Site button** — appears after an HTML file is uploaded or a URL is set; opens the demo in a new browser tab

HTML generation is intentionally disabled in the app — the upload flow is the supported path. The `proposal_demos` table stores: `business_id`, `html` (nullable text), `demo_site_url` (nullable).

The `BusinessInfoPanel` (search results side panel) also surfaces download buttons for the proposal `.md` and demo `.html` for any lead that already has them stored.

This feature targets the largest gap in local business digital presence — the complete absence of a website — and converts that gap directly into a billable proposal.

---

### 7. Email Enrichment

**API:** `POST /api/enrich/emails`
**Logic:** `lib/scraper/emails.ts`
**Component:** `EmailEnricher` (`src/components/leads/email-enricher.tsx`)

From the lead detail page, the user can trigger email enrichment. The scraper:
- Visits the business website and scans for `mailto:` links and text-pattern emails
- Returns a deduplicated list of contact emails

**Three-layer false-positive defence** (file-extension TLD filter):

Naive email regex was accepting strings like `artboard-11@3x-300x300.png` as valid emails. A defence was added at all three points in the pipeline:

1. **`lib/scraper/emails.ts`** — `isValidEmail()` rejects emails whose TLD matches a file/web extension blocklist (`png`, `jpg`, `gif`, `svg`, `css`, `js`, `ts`, `json`, `html`, `woff2`, `pdf`, `php`, etc.) before any pattern checks
2. **`src/app/api/enrich/emails/route.ts`** — Existing stored emails are filtered through the same blocklist before being merged with newly-scraped results, cleaning dirty DB data on the next enrichment run
3. **`src/components/leads/email-enricher.tsx`** — Both the "Known Emails" section visibility guard and the render loop filter `existingEmails` using the same file-extension suffix regex, preventing stale bad data from displaying even before a re-enrichment run

---

### 8. Outreach CRM

**Pages:** `/outreach`, `/leads/[id]/outreach`
**APIs:** `POST /api/outreach/generate`, `GET/POST/PATCH /api/outreach/pipeline`, `PATCH /api/outreach/status`, `GET /api/outreach/followups`
**Logic:** `lib/outreach/generator.ts`, `lib/outreach/templates.ts`, `lib/outreach/positioning.ts`

The outreach module turns audited leads into a sales pipeline.

**Per-lead outreach assets** (`/leads/[id]/outreach`):
- AI-generated cold email based on specific audit findings
- Loom video script (screen-record walkthrough talking points)
- Fee calculator (estimates service pricing based on audit gaps)
- Issue ranker (prioritises problems by business impact)

**Pipeline Kanban** (`/outreach`):
- Kanban board with stages: Prospecting → Contacted → Follow-up → Proposal Sent → Won/Lost
- Drag-and-drop status updates
- Follow-up due date tracking via `/api/outreach/followups`

---

### 9. Proof of Results

**Page:** `/proof`
**APIs:** `POST /api/proof/snapshot`, `GET/POST /api/proof/case-study/[id]`
**Logic:** `lib/screenshots/capture.ts`

For active clients (businesses you are already working with), the proof module:
- Captures **before/after screenshots** of the client's website at any point in time
- Stores snapshots with timestamps for side-by-side comparison
- Generates **case study documents** combining the original audit score, improvements made, and final results
- Useful for showing prospects the tangible results of your work

---

### 10. Exports

**Page:** `/exports`
**APIs:** `POST /api/export/sheets`, `POST /api/export/docs`, `POST /api/export/drive`, `POST /api/export/pdf`, `POST /api/export/proposal-drive`
**Logic:** `lib/google/sheets.ts`, `lib/google/docs.ts`, `lib/google/drive.ts`, `lib/pdf/generator.ts`

All exports are stored in an `exports` table with a link back to the Google file.

#### Google Sheets Export
- Creates a formatted spreadsheet titled "LeadSight Export — {date}"
- Columns: Name, Address, Phone, Website, Category, Rating, Reviews, social links, Digital Score, Grade, sub-scores
- Bold headers, colour-coded grade column (green A/B, yellow C, red D/F), frozen header row, auto-resized columns
- File saved to a "LeadSight" folder in the user's Google Drive

#### Google Docs Export
- Creates a structured document titled "Marketing Plan — {business name} — {date}"
- Sections: Executive Summary, Website Recommendations, Social Media Strategy, Advertising Roadmap, Quick Wins, Medium-Term, Long-Term, Outreach Email Template
- Heading styles applied (H1/H2), saved to LeadSight Drive folder

#### PDF Report
- Puppeteer-rendered PDF combining the full marketing plan with website screenshots
- Includes competitor comparison and AI-generated A/B testing suggestions
- Professional layout, suitable for printing or emailing to prospects

#### Website Proposal Export
- See **Section 6** — exports the AI-generated website proposal `.md` directly to a Google Doc in the user's Drive
- Logged in the `exports` table alongside all other exports

---

### 11. Usage Tracking

**API:** `GET /api/usage`
**Logic:** `lib/usage/track.ts`, `lib/usage/costs.ts`

Tracks API call counts and estimated costs per user. Covers Google Places calls, AI tokens used, PageSpeed calls, and export operations. Displayed on the account page.

---

### 12. Error Logging

**Logic:** `lib/logger.ts`, `src/instrumentation.ts`

- `logError()` appends JSONL to `logs/errors.log`
- `instrumentation.ts` patches `console.error` at server startup so all existing calls are auto-captured
- Client-side errors reported via `POST /api/log` by the `ErrorReporter` component
- `error.tsx` and `global-error.tsx` boundaries catch rendering failures

---

## Data Architecture

### Key Tables (Supabase PostgreSQL)

| Table | Purpose |
|---|---|
| `businesses` | Core lead data from Google Places |
| `website_audits` | PageSpeed, SEO, tech stack, freshness results |
| `social_audits` | Per-platform channel data and scores |
| `ads_audits` | Meta/Google ads detection, domain authority |
| `scores` | Composite Digital Presence Score per business |
| `marketing_plans` | AI-generated plan JSON |
| `outreach_pipeline` | CRM stage and status per lead |
| `exports` | Export history with Google file URLs |
| `search_sets` | Saved searches |
| `proof_snapshots` | Before/after screenshot metadata |
| `case_studies` | Proof-of-results documents |
| `proposal_demos` | Uploaded HTML demo sites and optional demo_site_url per business |
| `user_google_tokens` | OAuth tokens for Google Workspace APIs |

All tables use Row-Level Security — each user only sees their own data.

### `business.id` vs `business.place_id`

`Business.id` is the Supabase UUID. `Business.place_id` is the Google Place ID string. When a Supabase upsert fails during search, the fallback sets `id = place_id`. Audit and scoring routes guard against this by validating that `business.id` is a UUID before proceeding.

---

## Auth Pattern

```typescript
// Server-side (API routes, server components)
import { getAuthUser } from "@/lib/supabase/server";
const user = await getAuthUser(); // returns null if unauthenticated

// Service-role DB access (bypasses RLS) — used in all API routes
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
const adminClient = createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Client-side
import { createClient } from "@/lib/supabase/client";
```

**Dev bypass:** Set `NEXT_PUBLIC_DISABLE_AUTH=true` to skip auth entirely. Mock user ID configured via `NEXT_PUBLIC_DEV_USER_ID`.

---

## Environment Variables

```
# Public (client-accessible)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_DISABLE_AUTH       # "true" to skip auth in dev
NEXT_PUBLIC_DEV_USER_ID        # UUID of mock dev user

# Server-only
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PLACES_API_KEY          # Also used for PageSpeed Insights
ANTHROPIC_API_KEY
POLLINATIONS_API_KEY           # Optional — billing fallback
BRAVE_SEARCH_API_KEY           # Web search enrichment
LOG_DIR                        # Optional — defaults to <cwd>/logs
```

---

## AI Cost Model

The AI layer is designed to be near-zero cost:

- **Claude Haiku**: ~$0.25/million input tokens. A typical plan generation uses ~2,000 tokens = ~$0.0005 per plan.
- **Pollinations fallback**: Free (community-hosted), activated only on billing errors.
- At 500 plans/month, total AI cost stays under R50/month.

A 5-minute circuit breaker prevents repeated Anthropic calls during quota errors, automatically switching to Pollinations until the window expires.

---

## Development Commands

All commands run from `leadsight/`:

```bash
npm run dev       # Dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
npm start         # Production server (requires build first)
```

---

## Styling Convention

Pages use a deliberate mix of:
- **Tailwind classes** for layout (`flex`, `grid`, `space-y-6`, etc.)
- **Inline `style={{}}`** with CSS variables (`var(--bg-surface)`, `var(--accent)`, `var(--border)`, `var(--text-primary)`) for colours and surface theming
- **shadcn/ui** components for interactive elements

Both patterns coexist intentionally — do not fight them.
