# LeadSight Search Pipeline — Process Documentation

> **Keep this file updated** whenever any function, API call, or data flow in the search pipeline changes.

---

## Overview

The search pipeline finds local businesses via Google Places, enriches each with website scraping and web search data, then persists results to Supabase. The user sees results in real-time on the search page with a map.

---

## 1. User Initiates Search

**File:** `src/app/(dashboard)/search/page.tsx` (client component)

1. User enters a **business type** (e.g., "Hair Salons") and a **location** (e.g., "Durbanville, Cape Town") via two autocomplete inputs:
   - `BusinessTypeInput` — free text with suggestions
   - `LocationInput` — Google Places Autocomplete (returns full description + country)
2. User selects result limit (10 / 20 / 50) and clicks **Search**
3. Client sends `POST /api/search` with JSON body:
   ```json
   { "query": "Hair Salons", "location": "Durbanville, Cape Town", "limit": 20, "country": "South Africa" }
   ```
4. While loading: skeleton cards shown on left, map placeholder on right
5. On success: results stored in `useState`, business cards rendered with map pins

**Saved Searches:** Users can save/re-run searches via `/api/search-sets` (CRUD). Saved searches store query, location, country, limit, last run time, and result count.

---

## 2. API Route: Input Validation

**File:** `src/app/api/search/route.ts` — `POST` handler

```
Input → Zod validation → Auth check → Pipeline
```

1. Parse JSON body with `searchSchema` (Zod):
   - `query` (string, min 1)
   - `location` (string, min 1)
   - `radius` (number, default 10000)
   - `limit` (1–50, default 20)
   - `country` (string, default "")
2. Check `GOOGLE_PLACES_API_KEY` exists
3. Returns 400 on validation failure, 500 if no API key

---

## 3. Google Places Text Search

**API:** `https://maps.googleapis.com/maps/api/place/textsearch/json`

1. Builds query: `"{query} in {location}"` (location comes from autocomplete, includes full description)
2. Parameters: `query`, `radius`, `key`
3. Returns up to `limit` `PlacesResult` objects with:
   - `place_id`, `name`, `formatted_address`
   - `geometry.location` (lat/lng)
   - `rating`, `user_ratings_total`, `types[]`
4. Tracks usage: `trackApiUsage({ service: "google-places", operation: "text-search" })`
5. Returns 502 on API error, empty array on ZERO_RESULTS

---

## 4. Auth Check

**File:** `src/lib/supabase/server.ts` — `getAuthUser()`

1. Called after Places search (so we don't waste API calls for unauthenticated users)
2. Returns 401 if no authenticated user
3. User ID used for per-user business records and usage tracking

---

## 5. Per-Business Enrichment (Parallel)

All businesses are enriched in parallel via `Promise.all()`. For each business, three stages run:

### 5a. Google Place Details

**API:** `https://maps.googleapis.com/maps/api/place/details/json`

Fields requested: `formatted_phone_number`, `international_phone_number`, `website`, `url`, `opening_hours`, `editorial_summary`, `address_components`, `photos`, `reviews`

Extracts:
| Field | Source |
|-------|--------|
| `phone` | `formatted_phone_number` or `international_phone_number` |
| `website` | `website` field |
| `hours` | `opening_hours.weekday_text[]` |
| `hours_weekly` | Built from `opening_hours.periods[]` via `buildStructuredHours()` |
| `google_maps_url` | `url` (maps link) |
| `description` | `editorial_summary.overview` |
| `is_open_now` | `opening_hours.open_now` |
| `addressParsed` | `address_components` via `parseAddressComponents()` → street, suburb, city, postal_code, country |
| `photos` | Up to 5 photo URLs built from `photo_reference` |
| `reviews` | Raw review objects (author, rating, text, time) |

Tracks usage: `trackApiUsage({ service: "google-places", operation: "place-details" })`

### 5b. Website Enrichment

**File:** `src/lib/scraper/website.ts` — `enrichWebsite(url)`

**Only runs if business has a website** from Place Details. Before scraping, the URL is validated with `isBlockedDomain()` — directory URLs (Yelp, YellowPages, etc.) or social platform URLs returned by Google Places are rejected and set to `null`.

1. Fetches website HTML with 8s timeout, browser-like User-Agent
2. Parses with Cheerio
3. Extracts:

| Data | Method |
|------|--------|
| **Social links** | 3-pass: `<a href>` tags → JSON-LD `sameAs` → raw HTML regex. Uses `SOCIAL_PATTERNS` (facebook, instagram, linkedin, tiktok, twitter, youtube) |
| **Emails** | `extractEmails()` — `mailto:` hrefs + plain text regex. Filters tracking domains (sentry, wixpress, etc.). Max 10. |
| **Mobiles** | `extractMobiles()` — `tel:` hrefs (7+ digits) + SA mobile patterns (07x/08x). Max 5. |
| **WhatsApp** | `extractWhatsApp()` — wa.me or api.whatsapp.com links |
| **Meta** | `<title>`, `<meta name="description">`, OG tags |
| **Technologies** | CMS detection (WordPress, Shopify, etc.), Google Analytics, Meta Pixel |

Returns `WebsiteEnrichment` → `socialLinks`, `emails`, `contactEmail`, `mobiles`, `whatsapp`, `metaTitle`, `metaDescription`, `technologies`

### 5c. Web Search Enrichment (Brave Search)

**File:** `src/lib/scraper/web-search.ts` — `enrichFromWebSearch(businessName, city, existingData)`

**Runs for ALL businesses** (with or without websites). Wrapped in 5s `Promise.race` timeout.

**Env:** `BRAVE_SEARCH_API_KEY` — if missing, silently skipped.

1. **API call:** `GET https://api.search.brave.com/res/v1/web/search?q="Business Name" "City"&count=10`
   - Header: `X-Subscription-Token: {key}`
   - 5s `AbortSignal.timeout`

2. **Classify each result URL** via `classifyUrl()`:
   - **Social domain** (facebook.com, instagram.com, linkedin.com, tiktok.com, twitter.com, x.com, youtube.com) → extract social link via `SOCIAL_PATTERNS`
   - **Directory domain** (32-entry blocklist including Yelp, YellowPages, TripAdvisor, BBB, SA-specific dirs like yellosa.co.za/brabys.com, review platforms, ad tracking domains) → queue for contact scraping (max 2 pages)
   - **Website candidate** → if no existing website, validate via `calculateStringSimilarity()` (trigram similarity, threshold >= 0.4 between business name and domain)

3. **Scrape directory pages** (up to 2): fetch HTML → `extractEmails()`, `extractMobiles()`, `extractWhatsApp()`

4. **Website discovery returns URL only** — the route handles scraping it (no double-scrape)

5. **Build `WebResult[]`** from all search results for the `web_results` DB field

Returns `WebSearchEnrichment` → `website`, `socialLinks` (partial), `emails`, `mobile`, `whatsapp`, `webResults`

---

## 6. Cross-Reference & Merge

**Priority order:** Places data > Website scrape > Web search (only fill nulls)

After all three enrichment stages complete for a business:

```
socialLinks  = website scrape result (full SocialLinks)
             ← web search fills only null platforms
             ← if BOTH sources found a platform → confirmed ✓ (logged)

email        = Places email (always null currently)
             ← website scrape contactEmail
             ← web search emails[0]

emails       = deduplicated (lowercased) across all sources before DB insert

website      = Places website (validated: directory URLs rejected)
             ← web search discovered website (if Places had none)

mobile       = website scrape mobiles[0]
             ← web search mobile

whatsapp     = website scrape whatsapp
             ← web search whatsapp
```

If web search discovers a website (and Places had none), it is scraped **once** via `enrichWebsite()` in `route.ts` — not inside `web-search.ts`.

Confirmation signal logged to console: `[Search] ✓ {BusinessName}: {platform} confirmed by web search`

`socialChannelCount` = count of non-null social links (used for scoring later)

---

## 7. Database Persistence

**Database:** Supabase (PostgreSQL via `@supabase/supabase-js`)
**Table:** `businesses`
**Client:** `adminClient` (service role key, bypasses RLS)

### 7a. Existing Record Check

For each business, checks if `place_id` + `user_id` combination already exists:

```sql
SELECT id FROM businesses WHERE place_id = ? AND user_id = ?
```

**If exists:**
1. Fetches full record
2. Checks if enrichment is needed: `allSocialsNull || !email || !website || !mobile || !whatsapp || no web_results`
3. Checks if new data is available: compares enriched data against existing DB record field-by-field
4. If both conditions true → builds update payload (only changed fields) → `UPDATE businesses SET ... WHERE id = ?`
5. Otherwise returns existing record as-is

**Important:** The update condition checks for ANY new data (social links, emails, mobile, whatsapp, web_results) — not just website. This allows businesses without websites to still get enriched from web search.

### 7b. New Record Insert

If no existing record:

```sql
INSERT INTO businesses (
  user_id, place_id, name, address, phone, website, email, emails,
  mobile, whatsapp, hours, search_term, category, rating, review_count,
  latitude, longitude, social_links, google_maps_url, description,
  is_open_now, hours_weekly, photo_references, photo_count, photo_primary,
  photos, reviews, address_street, address_suburb, address_city,
  address_postal_code, address_country, social_channel_count, web_results
) VALUES (...)
```

`category` defaults to the first Google Places `type` (underscores replaced with spaces), or the search query.

---

## 8. Response

Returns JSON to the client:

```json
{
  "businesses": [ ...Business[] ],
  "count": 20
}
```

The search page receives this and:
1. Stores in `results` state
2. Renders business cards (left panel) with: name, address, rating, phone, website, social icons, "View Audit" link
3. Centers map on first result with lat/lng
4. Shows result count

---

## 9. Lead Detail Page

**File:** `src/app/(dashboard)/leads/[id]/page.tsx` (server component)

When user clicks "View Audit" on a search result:

1. Fetches from Supabase in parallel:
   - `businesses` → full business record
   - `website_audits` → latest website audit
   - `social_audits` → latest social audit
   - `ads_audits` → latest ads audit
   - `scores` → latest digital presence score
   - `marketing_plans` → latest plan ID

2. Renders:
   - **Header card:** name, address, rating, search term badge, action buttons (Audit, Generate Plan, Export)
   - **Contact grid:** phone, mobile, WhatsApp, email, website
   - **Social links:** colored badges for each platform
   - **Opening hours:** collapsible details
   - **Email enricher** component
   - **Audit grid:** Score gauge, Website card, Social card, Ads card
   - **Competitors card** (if available)

---

## 10. API Usage Tracking

**File:** `src/lib/usage/track.ts` — `trackApiUsage(event)`

Every external API call is tracked in the `api_usage` table:

| Call | Service | Operation |
|------|---------|-----------|
| Places Text Search | `google-places` | `text-search` |
| Place Details (per business) | `google-places` | `place-details` |

Cost estimation via `estimateCost()` from `src/lib/usage/costs.ts`.

**Not currently tracked:** Brave Search API calls, website scrape fetches, directory page scrapes.

---

## 11. Helper Functions

### `parseAddressComponents(components)`
Extracts street, suburb, city, postal_code, country from Google's `address_components` array. Handles `street_number` + `route` concatenation, falls back to `neighborhood` for suburb.

### `buildStructuredHours(periods)`
Converts Google's `opening_hours.periods` (day index + open/close times) into a structured object keyed by day name. Handles multiple periods per day and closed days.

### `calculateStringSimilarity(a, b)` — `src/types/helpers.ts`
Used by web search to validate website candidates. Compares business name to domain name. Threshold: >= 0.4.

**Algorithm:** Trigram-based Jaccard similarity. Splits each normalized string into overlapping 3-character windows, computes `intersection / max(t1.size, t2.size)`. Short-circuits: identical strings → 1.0; substring containment (e.g. "joes cafe" vs "joescafe") → 0.9. Replaces old character-set Jaccard which scored "smith" = "mints" = 1.0.

### `isBlockedDomain(url)` / `getDomain(url)` — `src/lib/scraper/web-search.ts`
`getDomain()` extracts hostname minus `www.`. `isBlockedDomain()` returns true for directory domains, social platforms, or generic Google URLs. Used by the route to validate Places website URLs and also to retroactively fix stored directory URLs on re-search.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
│  SearchPage → POST /api/search { query, location, limit }      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Route: /api/search                       │
│  1. Zod validate input                                          │
│  2. Google Places Text Search → N businesses                    │
│  3. Auth check (getAuthUser)                                    │
│  4. For EACH business (Promise.all):                            │
│     ┌───────────────────────────────────────────────────────┐   │
│     │ a. Place Details API → phone, website, hours, photos  │   │
│     │ b. enrichWebsite(url) → socials, emails, mobile, WA   │   │
│     │ c. enrichFromWebSearch(name, city) → web results,     │   │
│     │    socials, emails, mobile, WA, website discovery      │   │
│     └───────────────────────────────────────────────────────┘   │
│  5. Merge: Places > website scrape > web search (fill nulls)   │
│  6. Supabase: check existing → update OR insert                │
│  7. Return { businesses, count }                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SearchPage (Client)                           │
│  • Business cards (left) — name, contact, socials               │
│  • BusinessMap (right) — Leaflet map with pins                  │
│  • "View Audit →" links to /leads/[id]                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               Lead Detail Page: /leads/[id]                     │
│  • Reads business + audits + score + plan from Supabase         │
│  • Shows full contact info, socials, hours, audit results       │
│  • Action buttons: Audit, Generate Plan, Export                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Index

| File | Role |
|------|------|
| `src/app/(dashboard)/search/page.tsx` | Search UI — form, results list, map |
| `src/app/api/search/route.ts` | Search API — orchestrates entire pipeline |
| `src/lib/scraper/website.ts` | Website scraper — social links, emails, mobile, WA, tech stack |
| `src/lib/scraper/web-search.ts` | Brave Search enrichment — discovers social profiles, directories, websites |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Lead detail — displays all business data |
| `src/types/business.ts` | Types: `Business`, `SocialLinks`, `WebResult`, `SearchSet` |
| `src/types/helpers.ts` | `calculateStringSimilarity()` |
| `src/lib/usage/track.ts` | API usage tracking to `api_usage` table |
| `src/lib/supabase/server.ts` | `getAuthUser()` — server-side auth |
| `src/components/search/business-type-input.tsx` | Business type autocomplete |
| `src/components/search/location-input.tsx` | Location autocomplete (Google Places) |
| `src/components/search/business-map.tsx` | Leaflet map component |

---

## Environment Variables (Search Pipeline)

| Variable | Required | Used By |
|----------|----------|---------|
| `GOOGLE_PLACES_API_KEY` | Yes | Text Search, Place Details, photos |
| `BRAVE_SEARCH_API_KEY` | No | Web search enrichment (graceful skip if missing) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Database client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin database access |

---

*Last updated: 2026-04-15 — Search pipeline hardening: URL validation, trigram similarity, expanded blocklist, cross-reference confirmation, email deduplication*
