# LeadSight System Documentation

> Last updated: 2026-04-28

---

## 1. Overview

LeadSight is a B2B lead generation and digital marketing audit SaaS. It finds local businesses via Google Places, audits their digital presence (website, social, ads), scores them 0–100, generates AI-powered marketing plans, and exports results to Google Sheets, Docs, Drive, and PDF.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.2.3, React 19, App Router, Turbopack |
| Styling | Tailwind CSS v4, Radix UI primitives, shadcn/ui |
| Database | Supabase (PostgreSQL + RLS + SSR Auth) |
| AI | Anthropic SDK (`@anthropic-ai/sdk ^0.88.0`) — Claude Haiku 4.5 |
| Scraping | Puppeteer Core `^24.40.0` + `@sparticuz/chromium ^147.0.0` (serverless) |
| HTML parsing | Cheerio (fast, no browser, used in website scraper) |
| Export | `pdfkit ^0.18.0`, `googleapis ^171.4.0` (Sheets, Docs, Drive) |
| Validation | Zod v4 on all API routes |
| Testing | Vitest `^4.1.4` with coverage-v8 |
| Maps | react-leaflet (geographic lead visualization) |

**Serverless config:** `next.config.ts` marks `pdfkit`, `puppeteer-core`, and `@sparticuz/chromium` as `serverExternalPackages` to prevent bundling issues on Vercel.

---

## 2. Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI (App Router pages + React components)                   │
│  /search  /leads  /leads/[id]  /plans  /exports  /account  │
└──────────────────────┬──────────────────────────────────────┘
                       │ fetch / server actions
┌──────────────────────▼──────────────────────────────────────┐
│  API Routes  (src/app/api/**)                               │
│  /search  /audit/*  /score  /plan  /export/*  /usage  etc. │
└──────┬─────────┬──────────┬──────────┬───────────┬──────────┘
       │         │          │          │           │
  Google     Scrapers    Scoring     AI lib    Google
  Places     (website,   engine    (Claude +  Workspace
  API v1     social,               Pollins.)  (Sheets/Docs/Drive)
             ads, email)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Supabase PostgreSQL                                        │
│  10 tables: businesses, website_audits, social_audits,      │
│  ads_audits, scores, marketing_plans, exports,              │
│  user_google_tokens, search_sets, api_usage                 │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow diagram

```
search → audit → score → plan → outreach → pipeline → fix-and-prove → export
                                    │           │           │
                                    │           │           └── snapshot before/after
                                    │           └── status tracking, follow-ups
                                    └── personalised assets (loom script, email, dm)
```

### Source Layout

```
src/
  app/
    (auth)/           Auth pages (login, callback)
    (dashboard)/      Protected pages with shared layout
      search/         Lead search UI + map
      leads/          Lead list + lead detail [id]
      plans/          Plan list + plan detail [id]
      exports/        Export history
      account/        Account + Google OAuth + usage
    api/              All serverless API routes
  components/
    ui/               shadcn/ui primitives
    layout/           Nav, sidebar, header
    search/           SearchForm, LocationInput, BusinessMap
    leads/            LeadCard, EmailEnricher
    audit/            WebsiteCard, SocialCard, AdsCard, CompetitorsCard, ScoreGauge, AuditButton
    plans/            PlanCard, GeneratePlanButton
    export/           ExportButton
    report/           PdfPreview
  lib/
    ai/               client.ts, prompts.ts, parser.ts
    scraper/          browser.ts, website.ts, web-search.ts, social.ts, ads.ts, emails.ts, deals.ts
    google/           auth.ts, sheets.ts, docs.ts, drive.ts
    competitor/       finder.ts, compare.ts, ab-tests.ts, scraper.ts
    scoring/          engine.ts
    pdf/              generator.ts
    screenshots/      capture.ts
    usage/            track.ts, costs.ts
    supabase/         client.ts, server.ts, queries.ts, middleware.ts
  types/
    business.ts       Business interface (50+ fields)
    audit.ts          WebsiteAudit, SocialAudit, AdsAudit types
    score.ts          DigitalPresenceScore, Grade
    plan.ts           MarketingPlan, PlanSection
    export.ts         Export types
    constants.ts      APP_CONSTANTS, scoring weights
    helpers.ts        formatTimestamp(), calculateStringSimilarity()
```

---

## 3. Environment Variables

### Public (client-accessible)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for browser client |
| `NEXT_PUBLIC_APP_URL` | App base URL (used for OAuth callback) |
| `NEXT_PUBLIC_DISABLE_AUTH` | Set `true` to bypass auth in development |
| `NEXT_PUBLIC_DEV_USER_ID` | Dev user UUID when auth is disabled |

### Server-only

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS in API routes |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_PLACES_API_KEY` | Google Places API v1 key (billing enabled required) |
| `ANTHROPIC_API_KEY` | Claude API key for AI plan generation |
| `BRAVE_SEARCH_API_KEY` | (Optional) Brave Search for web enrichment |
| `OPENPAGERANK_API_KEY` | (Optional) OpenPageRank for domain authority |

> **Note:** All API routes use the Supabase **admin client** (service role key) to bypass RLS. Auth ownership is enforced via `WHERE user_id = user.id` clauses in queries, not via RLS policies.

---

## 4. Database Schema

### Migration history

| File | Change |
|------|--------|
| `001_create_tables.sql` | Creates all 8 core tables |
| `002_rls_policies.sql` | Enables RLS on all tables; audit tables use JOIN-based policies through `businesses.user_id` |
| `003_indexes.sql` | Indexes on `user_id`, `place_id`, `category`, all `business_id` FKs, `scores.total_score`, `exports.user_id` |
| `004_unique_constraints.sql` | Unique on `business_id` in audit/score/plan tables — enables upsert semantics |
| `005_add_deals.sql` | Adds `has_deals`, `deals_keywords` to `website_audits` |
| `006_enrich_fields.sql` | Adds enrichment fields (emails array, mobile, WhatsApp, social links) |
| `007_search_sets.sql` | Adds `search_sets` table |
| `008_api_usage.sql` | Adds `api_usage` table |
| `009_data_reference_fields.sql` | Additional data reference fields |
| `010_audit_enhancements.sql` | Audit enhancement fields |

### Core tables

#### `businesses`
Central data model. 50+ columns covering:
- **Identity:** `place_id`, `name`, `address`, `address_street/suburb/city/postal_code/country`, `lat`, `lng`, `google_maps_url`, `feature_id`
- **Contact:** `phone`, `mobile`, `email`, `emails` (array), `whatsapp`, `website`
- **Reviews:** `rating`, `review_count`, `rating_distribution` (JSONB), `reviews` (JSONB array)
- **Hours:** `hours` (weekday_text), `hours_weekly` (structured), `is_open_now`, `current_status`
- **Photos:** `photo_count`, `photos` (URL array), `photo_primary`, `photo_references`
- **Knowledge Panel:** `popular_times` (JSONB), `live_busyness`, `typical_visit_duration`, `review_topics`, `web_results`
- **Ownership:** `is_claimed`, `gmb_claim_url`
- **Competitors:** `competitors` (JSONB array of `CompetitorInfo`)
- **System:** `user_id`, `search_term`, `category`, `created_at`, `updated_at`

#### `website_audits`
One row per business (unique `business_id`).
- Performance: `performance_score`, `seo_score`, `accessibility_score`
- Tech: `has_ssl`, `is_mobile_friendly`, `cms_platform`, `tech_stack` (JSONB), `has_analytics`, `has_chat_widget`, `has_cookie_consent`
- Content: `meta_title`, `meta_description`, `og_image`, `page_count_estimate`, `last_updated`
- Deals: `has_deals`, `deals_keywords` (array)
- Contact: `contact_emails` (array, up to 10)
- Freshness: `blog_active`, `days_since_update`

#### `social_audits`
One row per business (unique `business_id`).
- `platform_coverage_score`, `engagement_score`
- Per-platform: `has_facebook`, `facebook_url`, `facebook_followers`, `facebook_last_post`
- Per-platform: `has_instagram`, `instagram_url`, `instagram_followers`, `instagram_last_post`
- Per-platform: `has_twitter`, `has_linkedin`, `has_youtube`, `has_tiktok` (+ URL/follower/post fields per platform)

#### `ads_audits`
One row per business (unique `business_id`).
- `has_meta_ads`, `meta_ad_count`, `meta_ad_categories` (array)
- `has_google_ads`, `has_remarketing_pixel`
- `domain_authority`, `backlink_estimate`

#### `scores`
One row per business (unique `business_id`).
- `total_score` (0–100), `grade` (A/B/C/D/F), `label` (descriptive text)
- Component scores: `website_score`, `social_score`, `engagement_score`, `advertising_score`, `reviews_score`

#### `marketing_plans`
One row per business (unique `business_id`).
- `plan_data` (JSONB — full MarketingPlan structure)
- `model_used` (default: `claude-haiku-4-5`)
- `created_at`, `updated_at`

#### `user_google_tokens`
OAuth token storage per user.
- `user_id`, `access_token`, `refresh_token`, `expires_at`, `scopes`

#### `search_sets`
Saved searches.
- `user_id`, `name`, `query`, `location`, `country`, `limit_count`
- `last_run_at`, `result_count`

#### `exports`
Export history.
- `user_id`, `type` (sheets/docs/pdf), `google_file_id`, `google_file_url`, `business_ids` (array)

#### `api_usage`
API cost tracking.
- `user_id`, `service`, `operation`, `calls`, `estimated_cost`
- `input_tokens`, `output_tokens` (for Anthropic cost calculation)
- `created_at`

---

## 5. API Endpoints

All routes require auth via `getAuthUser()`. Admin Supabase client is used server-side to bypass RLS.

### `POST /api/search`

Search for businesses using Google Places API v1.

**Input (JSON):**
```json
{
  "query": "plumbers",
  "location": "Cape Town, South Africa",
  "limit": 10
}
```

**Pipeline (11 steps):**
1. Zod validate input
2. Auth check via `getAuthUser()`
3. Google Places v1 Text Search (`POST https://places.googleapis.com/v1/places:searchText`)
4. Per-business parallel enrichment — three sources run concurrently:
   - (a) Google Place Details API
   - (b) Website scraping via Cheerio (`enrichWebsite()`)
   - (c) Brave Search web enrichment (`enrichFromWebSearch()`)
5. URL validation: `isBlockedDomain()` rejects Yelp, YellowPages, social platforms returned by Places
6. Website similarity validation: trigram Jaccard similarity >= 0.4 threshold
7. Data merge: Google Places data > website scrape > Brave web search (fill nulls only)
8. Existing record re-enrichment: updates only changed fields (social links, email, mobile)
9. Supabase upsert on `place_id`
10. Track API usage
11. Return JSON array of businesses

**Brave Search:** Optional. If `BRAVE_SEARCH_API_KEY` missing, silently skipped. 5s `Promise.race` timeout.

---

### `GET/POST/PATCH/DELETE /api/search-sets`

CRUD for saved searches.

| Method | Action |
|--------|--------|
| `GET` | List all search sets for user, ordered by `created_at DESC` |
| `POST` | Create: `{ name, query, location, country?, limit_count? }` |
| `PATCH` | Update: `{ id, last_run_at?, result_count? }` — called after re-running |
| `DELETE` | Delete: `?id=uuid` query param |

**Create schema:** `name` 1–100 chars, `query` min 1, `location` min 1, `limit_count` 1–50 (default 20).

---

### `GET /api/autocomplete/location`

Location autocomplete backed by Google Places API v1.

**Input:** `?q=cape+town` (min 2 chars)

**Backend call:**
```
POST https://places.googleapis.com/v1/places:autocomplete
Headers: X-Goog-Api-Key: {GOOGLE_PLACES_API_KEY}
Body: { input: q, languageCode: "en", includedPrimaryTypes: ["(regions)"] }
```

**Output:**
```json
[
  { "label": "Cape Town", "full": "Cape Town, South Africa", "country": "South Africa", "place_id": "..." }
]
```

Suggestions capped at 8. Usage tracked per authenticated user.

---

### `POST /api/audit/website`

Audits a business's website for performance, SEO, tech stack, deals, and freshness.

**Input:** `{ business_id: uuid }`

**Pipeline (parallel after HTML fetch):**
1. Fetch website HTML (10s timeout)
2. In parallel via `Promise.all`:
   - `runPageSpeedAudit` — PageSpeed Insights API
   - `runSeoScan` — title, description, og:image, structured data
   - `detectTechStack` — 60+ technology patterns across 8 categories
   - `checkContentFreshness` — blog activity, days since update
   - `searchExternalDeals` — external deal detection

**Tech stack categories:** platforms (15 CMS/frameworks), analytics (10 tools), advertising (6 ad pixels), payment (5 providers), email_marketing (6 tools), customer_support (8 tools), hosting_cdn (6), social_proof (4).

**Contact extraction:** `mailto:` regex from raw HTML, up to 10 unique addresses.

**Output:** Upserted to `website_audits` (one row per business). PageSpeed usage tracked.

---

### `POST /api/audit/social`

Audits a business's social media presence.

**Input:** `{ business_id: uuid }`

**Process:** Scrapes social profiles found in the business record. Calculates `platform_coverage_score` and `engagement_score` via `calculateSocialScores()` in `lib/scraper/social.ts`.

**Social link extraction (3-pass):**
1. HTML anchor hrefs
2. JSON-LD `sameAs` property
3. Raw HTML regex via `SOCIAL_PATTERNS`

**Output:** Upserted to `social_audits`.

---

### `POST /api/audit/ads`

Audits a business's advertising presence and domain authority.

**Input:** `{ business_id: uuid }`

**Three parallel checks:**
1. `checkMetaAds(businessName)` — **stub**, always returns `false` (Meta blocks unauthenticated requests)
2. `checkGoogleAds(websiteUrl)` — detects 3 ad types via HTML regex:
   - Conversion tracking (`AW-` prefix in gtag config)
   - Remarketing pixel (`google_conversion_id`)
   - Display ads (`googletag.cmd`)
3. `estimateDomainAuthority(hostname)` — calls OpenPageRank API (optional; null if `OPENPAGERANK_API_KEY` missing)

**Output:** Upserted to `ads_audits`.

> **Known limitation:** Meta Ad Library blocks unauthenticated server-side requests. `has_meta_ads` will always be `false`.

---

### `POST /api/audit/competitors`

Finds competitor businesses via Google Places Text Search.

**Input:** `{ business_id: uuid }`

**Process:**
1. Fetch business from Supabase (needs `category`, `address_city`)
2. Query: `{category} in {city}` via `POST https://places.googleapis.com/v1/places:searchText`
   - `X-Goog-Api-Key` header auth
   - `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount`
   - `maxResultCount: 10`
3. Filter out the queried business's own `place_id`
4. Take up to 5 candidates
5. For each: fetch Place Details (phone, website) via second Places API call
6. Persist `competitors` array back to `businesses` table

**City fallback:** `address_city` column → last segment of `address` field.

**Tracking:** `trackApiUsage` called per text-search and place-details operation.

---

### `POST /api/score`

Computes a digital presence score from all available audit data.

**Input:** `{ business_id: uuid }`

**Process:**
1. Fetch in parallel: `businesses`, `website_audits`, `social_audits`, `ads_audits`
2. Call `calculateDigitalPresenceScore()` from `lib/scoring/engine.ts`
3. Upsert to `scores` (one row per business)

Null audits are passed if not yet run — partial scoring is supported.

---

### `POST /api/plan`

Generates an AI marketing plan for a business.

**Input:** `{ business_id: uuid }`

**Process:**
1. `getFullBusinessProfile()` — fetches all 5 audit tables in parallel
2. `buildPlanPrompt()` — constructs structured prompt with all business data
3. `generateCompletion()` — Claude Haiku 4.5 with Pollinations fallback (see §7)
4. `parsePlanResponse()` — JSON repair and validation
5. Upsert to `marketing_plans`

---

### `POST /api/export/sheets`

Export leads + scores to a new Google Sheets spreadsheet.

**Input:** `{ business_ids: uuid[] }`

**Process:**
1. `getValidGoogleToken(userId)` — refreshes OAuth token if needed
2. Fetch businesses + scores in parallel
3. `exportLeadsToSheet()` — creates spreadsheet, writes headers + rows
4. Formatting: bold headers, frozen row 1, auto-resize, grade color-coding
5. Move file to "LeadSight" Drive folder (`getOrCreateLeadSightFolder()`)
6. Record in `exports` table

---

### `POST /api/export/docs`

Export a marketing plan to Google Docs.

**Input:** `{ plan_id: uuid }`

**Process:**
1. `getValidGoogleToken(userId)`
2. Fetch `marketing_plan` joined with business
3. `exportPlanToDoc()` — creates document, inserts all plan sections via `batchUpdate` (reverse-order insertion to maintain position indexing)
4. Move to "LeadSight" Drive folder
5. Record in `exports` table

---

### `POST /api/export/drive`

**Status: stub** — returns `{ business_ids, status: "pending" }`. Not yet implemented.

---

### `POST /api/export/pdf`

Generates a PDF report for a business. Uses `lib/pdf/generator.ts` with PDFKit.

---

### `GET /api/usage`

Returns API cost summary for the authenticated user.

**Three parallel queries:**
1. By-service aggregate (current billing month) — cost, calls, free-tier %
2. By-day aggregate (last 30 days) — daily spend trend
3. Recent 20 API calls — for debugging

**Free tier limits:**

| Service | Free Tier |
|---------|-----------|
| Google Places | $200/month credit |
| PageSpeed Insights | 25,000 calls/day |
| Anthropic (Haiku 4.5) | Pay-per-use |
| Pollinations AI | Free |

**Status thresholds:** >85% of free tier = red, >60% = amber, else green.

---

### `POST /api/enrich/emails`

Enriches a business's email contacts by scraping contact pages.

**Input:** `{ business_id: uuid }`

**Process:** `lib/scraper/emails.ts` probes 10 contact page paths:
`/contact`, `/contact-us`, `/contacts`, `/about`, `/about-us`, `/team`, `/staff`, `/reach-us`, `/get-in-touch`, `/info`

**Email extraction (4 methods):**
1. `mailto:` hrefs — high confidence
2. Cloudflare `data-cfemail` XOR decoding — high confidence
3. JSON-LD email fields — high confidence
4. Text near contact keywords — medium confidence
5. Raw body regex — low confidence

**Mobile extraction:** `tel:` hrefs with 7+ digits + South African patterns (07x/08x prefixes).

---

### `POST /api/outreach/generate`

Generates personalised outreach asset package for one business.

**Input:** `{ business_id: uuid, positioning_profile?: string, target_currency?: string, flat_fee?: number, delivery_days?: number }`

**Pipeline:**
1. `getFullBusinessProfile(business_id)` — fetches all audit tables in parallel
2. Pull existing `marketing_plans.plan_data` if present
3. `rankIssues(audits)` — deterministic top-3 issue picker (no LLM). Severity order: SSL missing (critical) > PageSpeed mobile < 50 (high) > not mobile-friendly (high) > no contact form (medium) > meta description missing (medium) > content stale >365 days (low)
4. `generateOutreachAssets()` — Claude Haiku 4.5 + Pollinations fallback
5. Upsert to `outreach_assets`
6. Track usage

**Output JSON schema:**
```json
{
  "loom_script": { "hook": "string", "problem_1": "string", "problem_2": "string", "close": "string" },
  "email_subject": "string",
  "email_body": "string (markdown, ≤90 words)",
  "linkedin_connect_note": "string (<300 chars)",
  "linkedin_followup": "string"
}
```

---

### `GET/POST/PATCH /api/outreach/pipeline`

CRUD for prospect pipeline state.

| Method | Action |
|--------|--------|
| `GET` | List with optional `?status=replied` filter, ordered by `last_contact_at DESC` |
| `POST` | Create: `{ business_id, status, channel, first_contact_at }` — auto-sets `status: 'contacted'` |
| `PATCH` | Update: `{ id, status?, reply_received_at?, outcome_notes?, won_amount?, lost_reason?, next_followup_at? }` |

Upsert on `business_id` for POST.

---

### `GET /api/outreach/followups`

Returns prospects with `next_followup_at <= now() AND status IN ('contacted', 'replied', 'negotiating')`. Used for daily reminder widget.

---

### `POST /api/proof/snapshot`

Captures PageSpeed snapshot for proof-of-fix tracking.

**Input:** `{ business_id: uuid, phase: 'before' | 'after', notes?: string }`

**Pipeline:** Fetch business URL → re-run `runPageSpeedAudit` → optionally capture screenshot → insert to `proof_snapshots`.

---

### `GET /api/proof/case-study/[business_id]`

Returns matched before/after pair with computed deltas.

**Output:**
```json
{
  "business": { "name": "...", "category": "..." },
  "before": { "pagespeed_mobile": 34, "pagespeed_desktop": 58, "seo_score": 45, "accessibility_score": 62 },
  "after": { "pagespeed_mobile": 89, "pagespeed_desktop": 95, "seo_score": 88, "accessibility_score": 95 },
  "deltas": { "pagespeed_mobile_delta": 55, "pagespeed_desktop_delta": 37 },
  "won_amount": 320,
  "outcome_notes": "..."
}
```

---

## 6. Scoring Engine

**File:** `src/lib/scoring/engine.ts`

### Formula

```
total_score = (website_score × 0.30)
            + (social_score × 0.25)
            + (engagement_score × 0.20)
            + (advertising_score × 0.15)
            + (reviews_score × 0.10)
```

### Component calculations

**Website score** (0–100):
- Average of `performance_score`, `seo_score`, `accessibility_score` from PageSpeed
- Bonuses: SSL (+5), mobile-friendly (+5), active blog updated <30 days (+10)
- Capped at 100

**Social score** (0–100):
- `platform_coverage_score` from `social_audits` (calculated by `calculateSocialScores()`)

**Engagement score** (0–100):
- `engagement_score` from `social_audits`

**Advertising score** (0–100):
- Base: 20
- `has_meta_ads`: +30
- `has_google_ads`: +20
- `domain_authority` normalized to 30 points
- Capped at 100

**Reviews score** (0–100):
- `(rating / 5) × 60 + min(review_count / 100, 1) × 40`
- Zero if no rating

### Grade thresholds

| Score | Grade | Label |
|-------|-------|-------|
| 80–100 | A | Digital Leader |
| 60–79 | B | Strong Online Presence |
| 40–59 | C | Growing Online |
| 20–39 | D | Needs Attention |
| 0–19 | F | Digital Ghost |

### `outreach_priority_score` (derived)

Identifies best cold outreach targets — businesses bad enough to need help but established enough to afford it.

```
outreach_priority_score = (100 - total_score) × signal_multiplier

signal_multiplier =
  1.0 base
  × 1.3 if rating >= 4.0        (quality-conscious business)
  × 1.3 if review_count >= 50   (established, has revenue)
  × 1.5 if is_claimed = true    (engaged owner, will reply)
  × 0.5 if total_score >= 80    (already a digital leader)
  × 0.3 if total_score < 20     (likely abandoned)
  × 1.4 if has_deals = true     (marketing-aware)
```

Best targets: **score 40–65 range with rating ≥ 4.0 and review_count ≥ 50**. Returned at query time; not persisted.

The `/outreach` pipeline page sorts by this score by default.

---

## 7. AI Plan Generation

**File:** `src/lib/ai/client.ts`

### Primary: Claude Haiku 4.5

- Model: `claude-haiku-4-5-20251001`
- `maxTokens: 6000`
- Cost: $0.00000025/input token, $0.00000125/output token

### Fallback: Pollinations AI

- Model: `openai-large`
- Activates only on billing/quota errors from Anthropic
- Circuit breaker: Anthropic billing errors disable Claude for 5 minutes (`anthropicBillingErrorUntil` timestamp)
- Pollinations 429 handling: respects `Retry-After` header, up to 2 retry attempts

### Plan prompt structure (`src/lib/ai/prompts.ts`)

Output JSON schema enforced:
```json
{
  "executive_summary": "string",
  "website": { "title": "string", "items": [] },
  "social": { "title": "string", "items": [] },
  "advertising": { "title": "string", "items": [] },
  "quick_wins": ["string"],
  "medium_term": ["string"],
  "long_term": ["string"],
  "outreach_email_draft": "string"
}
```

### JSON repair (`src/lib/ai/parser.ts`)

Handles common LLM JSON failures:
1. `fixLiteralNewlinesInStrings()` — escapes control chars
2. `repairJson()` — fixes unescaped quotes and missing commas at exact V8 error positions

### Cost tracking

`trackApiUsage()` records `service: "anthropic"` or `"pollinations"` with `input_tokens` and `output_tokens`. Never throws — silently ignores errors.

### Outreach prompt additions

`buildOutreachPrompt()` added alongside `buildPlanPrompt()`. Key constraints:
- No technical acronyms (Core Web Vitals, LCP, etc.) — use plain language ("your phone ringing")
- Issue grounding — pass ranked issues as facts; model must not invent beyond these three
- Local currency formatting based on `target_currency`; never use `$` for non-US prospects
- No fake urgency — concrete deadlines ("done by next Friday") only
- Length caps: email body ≤ 90 words; LinkedIn note ≤ 280 chars; Loom sections within second-counts
- Tone: "addressing a busy practice owner who gets 20 cold emails a day"

---

## 8. Competitor Analysis

**Route:** `POST /api/audit/competitors`
**Lib:** `src/lib/competitor/` (finder.ts, compare.ts, ab-tests.ts, scraper.ts)

### How it works

1. Business category + city extracted from `businesses` table
2. Text search: `{category} in {city}` → Google Places API v1 `searchText`
3. Up to 10 candidates returned; business's own `place_id` filtered out
4. Top 5 enriched with Place Details (phone, websiteUri)
5. Stored as `CompetitorInfo[]` in `businesses.competitors` (JSONB)

### CompetitorInfo fields

```typescript
{
  place_id: string
  name: string
  rating: number
  review_count: number
  website: string | null
  address: string
  phone: string | null
}
```

### Competitor comparison

`lib/competitor/compare.ts` and `lib/competitor/ab-tests.ts` provide deeper analysis (full scraping of competitor websites, A/B test detection). The `CompetitorsCard` UI component renders competitor data on the lead detail page — only shown when `business.competitors` array is non-empty.

---

## 9. Google OAuth & Export

**File:** `src/lib/google/auth.ts`

### OAuth scopes

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/drive.file
```

`drive.file` = narrow scope — only files created by the app.

### Token flow

1. User clicks "Connect Google" in Account page
2. Redirect to Google OAuth consent screen
3. Callback: `{NEXT_PUBLIC_APP_URL}/auth/callback`
4. Tokens stored in `user_google_tokens` table
5. `getValidGoogleToken(userId)` — checks expiry with 5-minute buffer; calls `refreshGoogleToken()` if expired; updates row
6. `revokeGoogleAccess(userId)` — calls Google's revoke endpoint, then deletes token row

### Google Sheets export (`lib/google/sheets.ts`)

Creates spreadsheet titled `"LeadSight Export - {date}"`:
- Headers + lead rows written
- Bold headers, frozen row 1, auto-resize columns
- Grade column color-coded (A=green, B=light green, C=yellow, D=orange, F=red)

### Google Docs export (`lib/google/docs.ts`)

Creates document with all plan sections via `batchUpdate`. Sections inserted in **reverse order** to maintain correct character position indexing.

### Drive organization (`lib/google/drive.ts`)

`getOrCreateLeadSightFolder()` searches for existing "LeadSight" folder; creates it on first use. All Sheets and Docs exports are moved into this folder.

---

## 10. Web Scraping Pipeline

### Website scraper (`lib/scraper/website.ts`)

**Transport:** Cheerio (no browser) — fast, serverless-safe, 8-second timeout.

**Tech stack detection** — 8 categories, 60+ technologies:

| Category | Count | Examples |
|----------|-------|---------|
| platforms | 15 | WordPress, Shopify, Wix, Squarespace, Webflow |
| analytics | 10 | Google Analytics, Hotjar, Mixpanel, Segment |
| advertising | 6 | Meta Pixel, Google Ads, TikTok Pixel |
| payment | 5 | Stripe, PayPal, Square |
| email_marketing | 6 | Mailchimp, Klaviyo, ActiveCampaign |
| customer_support | 8 | Intercom, Zendesk, Tidio, Crisp |
| hosting_cdn | 6 | Cloudflare, AWS, Fastly |
| social_proof | 4 | Trustpilot, Google Reviews widget |

### Social scraper (`lib/scraper/social.ts`)

3-pass social link extraction: HTML anchor hrefs → JSON-LD `sameAs` → raw HTML regex via `SOCIAL_PATTERNS`.

### Ads scraper (`lib/scraper/ads.ts`)

- Meta Ads: stub (always returns false)
- Google Ads: 3 HTML regex patterns
- Domain authority: OpenPageRank API (optional)

### Email scraper (`lib/scraper/emails.ts`)

Probes 10 contact paths. 5 extraction methods with confidence levels. Handles Cloudflare email obfuscation (`data-cfemail` XOR decoding with first byte of hex string).

### Brave Search enrichment (`lib/scraper/web-search.ts`)

Discovers social profiles, directory pages, and alternative websites. 5-second timeout via `Promise.race`. Silently skipped if `BRAVE_SEARCH_API_KEY` not set.

### Deals detection (`lib/scraper/deals.ts`)

`detectDealsAndSpecials()` scans on-page content. `searchExternalDeals()` queries external sources. Results stored in `website_audits.has_deals` and `deals_keywords`.

### Headless browser (`lib/scraper/browser.ts`)

Puppeteer Core + `@sparticuz/chromium` for JavaScript-heavy pages and screenshots. Used by `lib/screenshots/capture.ts`.

---

## 11. Auth Architecture

**Files:** `src/lib/supabase/server.ts`, `client.ts`, `middleware.ts`

### Three Supabase client types

| Client | Key | Used for |
|--------|-----|---------|
| `createBrowserClient` | Anon key | Client-side React components |
| `createServerClient` | Anon key + cookies | SSR, middleware session refresh |
| Admin client (service role) | Service role key | All API route mutations |

### Session refresh

`updateSession()` middleware runs on every request: calls `supabase.auth.getUser()`, updates cookie state on the response.

### Dev bypass mode

Set `NEXT_PUBLIC_DISABLE_AUTH=true` to skip auth. `getAuthUser()` returns hardcoded dev user with ID from `NEXT_PUBLIC_DEV_USER_ID`. Useful for local development without Supabase auth setup.

---

## 12. Usage & Cost Tracking

**Files:** `src/lib/usage/track.ts`, `src/lib/usage/costs.ts`

### Services tracked

| Service | Operations tracked |
|---------|-------------------|
| `google-places` | `text-search`, `place-details`, `autocomplete` |
| `pagespeed` | `analyze` |
| `anthropic` | `plan-generation` (with token counts) |
| `pollinations` | `plan-generation` |
| `brave-search` | `web-enrichment` |
| `openpagerank` | `domain-authority` |

### Cost model

- **Google Places:** $200/month free credit — system tracks remaining balance from `estimated_cost` sum
- **Anthropic Haiku 4.5:** $0.00000025/input token, $0.00000125/output token
- **PageSpeed, Pollinations:** Free

### `trackApiUsage()`

Inserts to `api_usage` table via service role client. Never throws — silently ignores errors. RLS: users can SELECT own rows; INSERT is service-role-only.

---

## 13. Running the Project

### Prerequisites

1. Node.js 20+
2. Supabase project (free tier works)
3. Google Cloud project with Places API v1 enabled + OAuth 2.0 client
4. Anthropic API key (or use Pollinations fallback — free)

### Setup

```bash
# 1. Install dependencies
cd leadsight
npm install

# 2. Copy and fill environment variables
cp .env.example .env.local
# Fill all required vars (see §3)

# 3. Run Supabase migrations
# In Supabase Dashboard → SQL Editor, run each migration in order:
# supabase/migrations/001_create_tables.sql through 010_audit_enhancements.sql

# 4. Start dev server
npm run dev
# App available at http://localhost:3000
```

### Development without Google Auth

Set in `.env.local`:
```
NEXT_PUBLIC_DISABLE_AUTH=true
NEXT_PUBLIC_DEV_USER_ID=<any-uuid>
```

### Commands

```bash
npm run dev       # Dev server (Turbopack) at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
npm start         # Production server (after build)
npx vitest        # Run tests
npx vitest --coverage  # Tests with coverage report
```

### Test a search manually

```bash
# With dev server running:
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"plumbers","location":"Cape Town, South Africa","limit":5}'
```

### Test location autocomplete

```bash
curl "http://localhost:3000/api/autocomplete/location?q=cape+town"
```

### Test scoring

```bash
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{"business_id":"<uuid-from-search>"}'
```

---

## 14. Implementation Status

| Phase | Feature | Status |
|-------|---------|--------|
| SA-1 | Types, constants, helpers, Supabase clients, shadcn/ui | Complete |
| SA-2 | Database migrations (10 migrations) | Complete |
| SA-3 | Google OAuth flow + token storage/refresh/revoke | Complete |
| SA-4 | Business search API (Places v1, enrichment, upsert) | Complete |
| SA-5 | Website auditor (PageSpeed, SEO, tech stack, deals) | Complete |
| SA-6 | Social auditor (platform detection, scoring) | Complete |
| SA-7 | Ads auditor (Google Ads detection, domain authority) | Complete (Meta Ads: stub) |
| SA-8 | Scoring engine (weighted 5-component formula) | Complete |
| SA-9 | AI plan generator (Claude + Pollinations fallback) | Complete |
| SA-10 | Google export (Sheets, Docs, Drive folder) | Complete (Drive stub pending) |
| SA-11 | Dashboard UI (9 pages, 40 components) | Complete |
| SA-12 | Outreach asset generator (Loom + email + LinkedIn) | Complete |
| SA-13 | Pipeline tracker (CRM-lite kanban) | Complete |
| SA-14 | Proof-of-fix snapshot system | Complete |
| SA-15 | Case study PDF generator | Complete |
| SA-16 | Outreach priority scoring | Complete |
| SA-17 | Vertical/geo targeting presets | Complete |

### Known limitations

- **Meta Ads detection:** Always returns false. Meta Ad Library blocks unauthenticated requests.
- **`/api/export/drive`:** Stub only — returns pending status.
- **Brave Search:** Optional. If key not set, web enrichment step is silently skipped.
- **OpenPageRank:** Optional. Domain authority shows null if key not set.

---

## 15. Key File Index

| File | Purpose |
|------|---------|
| `src/app/api/search/route.ts` | Main lead search pipeline |
| `src/app/api/audit/website/route.ts` | Website audit orchestrator |
| `src/app/api/audit/social/route.ts` | Social audit orchestrator |
| `src/app/api/audit/ads/route.ts` | Ads audit orchestrator |
| `src/app/api/audit/competitors/route.ts` | Competitor finder via Places API |
| `src/app/api/score/route.ts` | Scoring endpoint |
| `src/app/api/plan/route.ts` | AI plan generation endpoint |
| `src/app/api/export/sheets/route.ts` | Google Sheets export |
| `src/app/api/export/docs/route.ts` | Google Docs export |
| `src/app/api/usage/route.ts` | Usage & cost dashboard data |
| `src/app/api/search-sets/route.ts` | Saved search CRUD |
| `src/app/api/autocomplete/location/route.ts` | Location autocomplete proxy |
| `src/app/api/enrich/emails/route.ts` | Email enrichment |
| `src/lib/ai/client.ts` | Claude + Pollinations AI client |
| `src/lib/ai/prompts.ts` | Plan generation prompt builder |
| `src/lib/ai/parser.ts` | LLM JSON repair parser |
| `src/lib/scoring/engine.ts` | Digital presence scoring formula |
| `src/lib/scraper/website.ts` | Website HTML scraper + tech detection |
| `src/lib/scraper/emails.ts` | Email extraction (10 paths, 5 methods) |
| `src/lib/scraper/ads.ts` | Google Ads + Meta Ads + domain authority |
| `src/lib/scraper/social.ts` | Social profile scraper |
| `src/lib/scraper/web-search.ts` | Brave Search enrichment |
| `src/lib/google/auth.ts` | Google OAuth token management |
| `src/lib/google/sheets.ts` | Sheets export with formatting |
| `src/lib/google/docs.ts` | Docs export via batchUpdate |
| `src/lib/google/drive.ts` | Drive folder management |
| `src/lib/usage/track.ts` | API usage event recording |
| `src/lib/usage/costs.ts` | Cost calculations per service |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/lib/supabase/queries.ts` | Shared query helpers |
| `src/types/business.ts` | Business interface (50+ fields) |
| `src/types/constants.ts` | APP_CONSTANTS, scoring weights |
| `src/app/api/outreach/generate/route.ts` | Outreach asset generation endpoint |
| `src/app/api/outreach/pipeline/route.ts` | Pipeline CRUD |
| `src/app/api/outreach/followups/route.ts` | Follow-up reminder data |
| `src/app/api/proof/snapshot/route.ts` | Before/after PageSpeed capture |
| `src/app/api/proof/case-study/[id]/route.ts` | Case study data assembly |
| `src/lib/outreach/generator.ts` | Asset generator orchestrator |
| `src/lib/outreach/positioning.ts` | Positioning profile presets |
| `src/lib/outreach/templates.ts` | Hardcoded fallback templates |
| `supabase/migrations/` | Full schema history (001–010) |
| `supabase/migrations/011_outreach_pipeline.sql` | Outreach pipeline schema |
| `supabase/migrations/012_search_sets_extension.sql` | Search sets targeting extension |
| `process.md` | Search pipeline living documentation |

---

## 16. Outreach Workflow

### New database tables (migration 011)

**`outreach_assets`** — One row per business per outreach attempt (no unique constraint on business_id — allows iteration).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `user_id` | uuid | |
| `loom_script` | text | 90-second script (hook/problem1/problem2/close) |
| `email_subject` | text | Cold email subject |
| `email_body` | text | Cold email body (markdown) |
| `linkedin_connect_note` | text | <300 char connection request |
| `linkedin_followup` | text | Post-accept message |
| `flat_fee_amount` | numeric(10,2) | Quoted price |
| `flat_fee_currency` | text | GBP/USD/AUD/EUR/ZAR |
| `delivery_days` | int | Promised turnaround |
| `identified_issues` | jsonb | Top 3 issues (type, severity, fix_estimate) |
| `loom_url` | text nullable | Filled after recording |

**`outreach_pipeline`** — One row per business (unique on `business_id`).

| Column | Type | Purpose |
|--------|------|---------|
| `status` | text | `not_contacted`/`contacted`/`replied`/`negotiating`/`won`/`lost`/`ghosted` |
| `channel` | text | `email`/`linkedin`/`both` |
| `first_contact_at`, `last_contact_at` | timestamptz | |
| `reply_received_at` | timestamptz nullable | |
| `outcome_notes` | text | |
| `won_amount` | numeric nullable | |
| `lost_reason` | text nullable | `price`/`no_response`/`not_interested`/`competitor`/`other` |
| `next_followup_at` | timestamptz nullable | Follow-up reminder |

**`proof_snapshots`** — Two rows per project (before + after).

| Column | Type | Purpose |
|--------|------|---------|
| `phase` | text | `before`/`after` |
| `pagespeed_mobile`, `pagespeed_desktop` | int | |
| `seo_score`, `accessibility_score` | int | |
| `screenshot_url` | text nullable | |
| `notes` | text | What was changed |

### New library files

| File | Purpose |
|------|---------|
| `src/lib/outreach/generator.ts` | `rankIssues()`, `buildOutreachPrompt()`, `generateOutreachAssets()`, `parseOutreachResponse()` |
| `src/lib/outreach/positioning.ts` | `DEFAULT_POSITIONING` — "Broken Website Rescue Service" defaults (GBP, 5 days, £280–600) |
| `src/lib/outreach/templates.ts` | Hardcoded fallback templates for AI failure/rate-limit scenarios |

### New UI pages

| Page | Description |
|------|-------------|
| `/outreach` | Kanban board — columns per pipeline status, drag-and-drop updates status, filter by city/score/category |
| `/leads/[id]/outreach` | Asset workspace tab — issue panel, Loom script, email draft, LinkedIn variant, fee inputs, status buttons |
| `/proof` | Case study generator — before/after snapshot pairs, one-page PDF export |

### Vertical/geo targeting presets

`search_sets` extended with `positioning_profile_id` and `target_currency`. Built-in presets:

| Preset | Query | Market |
|--------|-------|--------|
| UK Dentists Tier-2 | `dentist` | Manchester, Leeds, Bristol, Nottingham — GBP |
| UK Law Firms SMB | `solicitor` | Manchester, Leeds, Birmingham, Glasgow — GBP |
| US Plumbers | `plumber` | Austin, Charlotte, Phoenix, Tampa — USD |
| AU Dentists | `dentist` | Perth, Adelaide, Brisbane suburbs — AUD |
| Cape Town Local | `service businesses` | Cape Town — ZAR |

### Cost estimate

~2,000 input + 1,200 output tokens per outreach generation ≈ **$0.002 per prospect** at Haiku 4.5 rates. 25 prospects/sprint ≈ $0.05.

### 48-Hour Playbook alignment

| Playbook step | System support |
|---------------|----------------|
| Find 50 prospects | Existing search + new geo presets |
| Identify 3 issues per prospect | Existing audits + deterministic `rankIssues()` |
| Generate Loom script + email | New outreach generator |
| Track replies and close | New pipeline kanban |
| Capture proof of work | New snapshot system |
| Build case studies | New case study PDF generator |

Time per prospect: 12 min (manual) → 3 min (review + record + send).
