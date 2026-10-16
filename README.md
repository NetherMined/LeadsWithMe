# LeadSight

LeadSight is a lead-generation and digital-marketing audit tool for agencies, freelancers and consultants. It finds local businesses on Google, audits how well they show up online, scores them 0–100, and writes the marketing plan, website proposal and outreach email you need to win them as clients.

The idea: walk into a sales conversation already knowing what is wrong with a prospect's online presence and what it would cost to fix.

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [One-time setup](#one-time-setup)
- [Configuration reference](#configuration-reference)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Features

| Area | What you get |
|---|---|
| **Search** | Find businesses by type and location (Google Places), on a map. Each result is enriched with its website, phone, emails, social profiles, opening hours, reviews and photos. Searches can be saved and re-run. |
| **Audit** | Website (Google PageSpeed scores, SEO checks, CMS and tech stack, analytics, SSL, mobile, blog freshness, deals), social presence and engagement, advertising (Meta/Google pixels, domain authority) and competitors. |
| **Score** | A 0–100 digital-presence score with an A–F grade: website 30%, social 25%, engagement 20%, advertising 15%, reviews 10%. |
| **AI plans** | A marketing plan per business: executive summary, website, social and advertising recommendations, quick wins and medium/long-term actions. |
| **Website proposals** | For businesses without a website: competitor research plus a nine-section proposal, and an optional AI-generated demo site with desktop and mobile screenshots. |
| **Outreach** | Personalised email, Loom video script, fee suggestion and ranked issues, plus a Kanban pipeline with follow-up reminders. |
| **Proof** | Before/after screenshots that become a case study. |
| **Exports** | Google Sheets (colour-coded grades), Google Docs (plan), Google Drive (proposal) and a PDF report with optional competitor comparison. |
| **Usage** | Per-service API call counts and estimated cost on the account page. |

## How it works

```
Browser ──► Next.js app (port 3001) ──► PostgreSQL 16
               │
               ├─► Google Places / PageSpeed / Sheets / Docs / Drive
               ├─► Brave Search, Open PageRank, deal sites
               ├─► Headless Chromium (PDFs, screenshots, competitor scraping)
               └─► AI: Muse Spark via the local OpenCode service ─(fallback)─► Pollinations
```

1. **Search** calls Google Places, then enriches each place (5 at a time) by scraping its website and running a Brave web search. Results are saved per user.
2. **Run Audit** checks the website, social channels, ads and competitors, then computes the score.
3. **AI features** (plan, proposal, demo site, outreach) send a prompt to Muse Spark through your local OpenCode CLI. If OpenCode is not running, they fall back to Pollinations.
4. **Exports** use your Google account's Sheets, Docs and Drive permissions, granted at sign-in.

Every record belongs to the signed-in user; another user's data returns 404.

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, standalone build), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Leaflet + OpenStreetMap |
| Database | PostgreSQL 16, Drizzle ORM (`postgres.js`) |
| Auth | Better Auth with Google sign-in, database sessions |
| AI | Muse Spark (`opencode/muse-spark-1.3-contributor-free`) through the OpenCode CLI; Pollinations fallback |
| Scraping | cheerio, Puppeteer Core with Chromium |
| Google | Places API (New), PageSpeed Insights, Sheets, Docs, Drive (`googleapis`) |
| Validation and tests | Zod, Vitest, ESLint |
| Runtime | Docker Compose: `db`, one-shot `migrate`, `app` (Node 22, Debian Chromium) |

---

## Quick start (Docker)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/), Node.js 22, and the accounts and keys listed in [One-time setup](#one-time-setup).

```bash
git clone https://github.com/NetherMined/LeadsWithMe.git
cd LeadsWithMe/leadsight
cp .env.example .env.local      # then fill in the values (see below)
npm run docker:up               # builds and starts db + migrations + app
```

Open <http://localhost:3001> and sign in with Google.

- Migrations run automatically on every start. If `DEV_USER_ID` is set, the dev user is created too.
- Postgres is published on host port **5433**, the app on **3001**. Change them with `POSTGRES_HOST_PORT` and `APP_HOST_PORT`.
- Uploads and logs are kept in Docker volumes (`uploads`, `logs`); the database in `pgdata`.
- The app reaches OpenCode on your machine through `host.docker.internal:4096`.

Stop everything with `docker compose down` (add `-v` to also delete the data volumes).

## Local development

Run Postgres in Docker and the app with hot reload:

```bash
cd leadsight
npm install
cp .env.example .env.local      # fill in the values
npm run db:up                   # Postgres only, host port 5433
npm run db:migrate
npm run db:seed                 # optional: creates the DEV_USER_ID user
npm run dev                     # http://localhost:3001
```

On Windows and macOS, Puppeteer uses your installed Google Chrome. Set `CHROME_EXECUTABLE_PATH` if it is not found.

To skip sign-in while developing, set `DISABLE_AUTH=true` and `DEV_USER_ID=<uuid>` in `.env.local`, then run `npm run db:seed`. Never use this outside your own machine.

---

## One-time setup

### 1. Google Cloud

In the [Google Cloud console](https://console.cloud.google.com/):

1. **Enable these APIs:** Places API (New), PageSpeed Insights API, Google Sheets API, Google Docs API, Google Drive API.
2. **Create an API key** (APIs & Services → Credentials) and restrict it to the Places API (New) and PageSpeed Insights API. Put it in `GOOGLE_PLACES_API_KEY`.
   - Or create a separate key for PageSpeed and put it in `PAGESPEED_API_KEY`.
3. **Configure the OAuth consent screen.** In Testing mode, add your Google account as a test user.
4. **Create an OAuth client ID** of type *Web application*:
   - Authorised JavaScript origin: `http://localhost:3001`
   - Authorised redirect URI: `http://localhost:3001/api/auth/callback/google`
   - Put the ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

When you sign in, Google asks for access to Sheets, Docs and Drive. **Tick all the boxes**, or exports fail with "insufficient scopes". The app only gets Drive access to files it creates (`drive.file`).

### 2. OpenCode (AI)

LeadSight's AI runs on Meta's Muse Spark through the [OpenCode](https://opencode.ai) CLI on your machine. OpenCode's free Muse Spark model only answers requests made by OpenCode itself, so the app talks to OpenCode's background service rather than calling an AI API directly.

1. Install OpenCode and make sure the model is available:

   ```bash
   npm install -g @opencode/cli          # or see https://opencode.ai/docs
   opencode models | grep muse-spark      # expect opencode/muse-spark-1.3-contributor-free
   ```

2. Give the background service a fixed port and a password, then restart it:

   ```bash
   # Generate a random password (or use any long random string)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

   opencode service set port 4096
   opencode service set password <the-password>
   opencode service restart
   opencode service status                # http://127.0.0.1:4096
   ```

3. Put the same password in `.env.local` as `OPENCODE_SERVER_PASSWORD`.
4. Optional: create an empty folder for the AI sessions to run in, such as `C:\Users\you\AppData\Local\leadsight\opencode-sandbox`, and set `OPENCODE_DIRECTORY` to it.

Keep the service bound to `127.0.0.1` (the default). Docker Desktop can still reach it, and it is not exposed to your network.

Things to know:

- **OpenCode must be running** for Muse Spark to be used. Otherwise the app uses Pollinations.
- **The free "contributor" tier lets Meta train on your prompts and completions**, which include business names, contact details and audit findings. It is also offered for a limited time. To switch to the paid model, change `OPENCODE_MODEL` (for example `opencode/muse-spark-1.3` after signing in to OpenCode Zen).
- The integration uses OpenCode's internal `/api` routes, verified with opencode 2.0.29. Re-test AI features after upgrading OpenCode.

### 3. Other services

| Service | Needed for | Where to get it |
|---|---|---|
| [Pollinations](https://pollinations.ai) | AI fallback when OpenCode is unavailable | `POLLINATIONS_API_KEY` |
| [Brave Search API](https://brave.com/search/api/) | Web enrichment, competitor discovery for proposals | `BRAVE_SEARCH_API_KEY` |
| [Open PageRank](https://www.domcop.com/openpagerank/) | Domain authority (optional; defaults are used without it) | `OPENPAGERANK_API_KEY` |

### 4. Auth secret

Generate a value for `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

---

## Configuration reference

All variables live in `leadsight/.env.local`. The template is [`leadsight/.env.example`](leadsight/.env.example). Docker Compose reads `.env.local` too, and overrides `DATABASE_URL`, `UPLOAD_DIR` and `OPENCODE_URL` for the containers.

| Variable | Required | Default / example | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgres://leadsight:leadsight@localhost:5433/leadsight` | Postgres connection (local dev) |
| `BETTER_AUTH_SECRET` | ✅ | — | Signs session cookies |
| `BETTER_AUTH_URL` | ✅ | `http://localhost:3001` | Public app URL for auth callbacks |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3001` | Public app URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | — | Google sign-in and exports |
| `GOOGLE_PLACES_API_KEY` | ✅ | — | Places search, details, photos, autocomplete; PageSpeed unless `PAGESPEED_API_KEY` is set |
| `PAGESPEED_API_KEY` | — | — | Dedicated PageSpeed Insights key |
| `OPENCODE_SERVER_PASSWORD` | ✅* | — | Password of the local OpenCode service |
| `OPENCODE_URL` | — | `http://127.0.0.1:4096` | OpenCode service URL (`host.docker.internal:4096` in Docker) |
| `OPENCODE_SERVER_USERNAME` | — | `opencode` | OpenCode basic-auth user |
| `OPENCODE_MODEL` | — | `opencode/muse-spark-1.3-contributor-free` | Model, as `provider/model` |
| `OPENCODE_DIRECTORY` | — | — | Empty host folder the AI sessions run in |
| `POLLINATIONS_API_KEY` | ✅* | — | Fallback AI provider |
| `POLLINATIONS_MODEL` | — | `openai/gpt-5.4-mini` | Fallback model |
| `BRAVE_SEARCH_API_KEY` | ✅ | — | Web search enrichment and competitor discovery |
| `OPENPAGERANK_API_KEY` | — | — | Domain authority |
| `UPLOAD_DIR` | — | `./data/uploads` (`/data/uploads` in Docker) | Where uploaded and generated files are stored |
| `CHROME_EXECUTABLE_PATH` | — | auto-detected; `/usr/bin/chromium` in Docker | Chrome/Chromium for Puppeteer |
| `LOG_DIR` | — | `<cwd>/logs` | Error log folder |
| `DISABLE_AUTH` / `DEV_USER_ID` | dev only | — | Skip sign-in and act as the seeded dev user |

\* At least one AI provider is required. Both are recommended.

---

## Scripts

Run from `leadsight/`:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 3001 |
| `npm run build` / `npm start` | Production build / production server on port 3001 |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run check:secrets` | Fails if anything git would commit contains an API key, a value from `.env.local`, or an env file. **Run it before every push.** |
| `npm run db:up` | Start only the Postgres container |
| `npm run db:generate` | Create a migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations in `drizzle/` |
| `npm run db:seed` | Create the `DEV_USER_ID` user |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run docker:up` | Build and start the full stack |

## Project structure

```
LeadsWithMe/
├─ leadsight/                  The Next.js app (run all commands here)
│  ├─ src/
│  │  ├─ app/(dashboard)/      Pages: dashboard, search, leads, plans, outreach, proof, exports, account
│  │  ├─ app/(auth)/login/     Sign-in page
│  │  ├─ app/api/              API routes (search, audit, score, plan, export, outreach, proof, files, …)
│  │  ├─ components/           UI by feature (audit, leads, outreach, search, proof, layout, …)
│  │  ├─ lib/ai/               generateCompletion + the OpenCode bridge
│  │  ├─ lib/auth/             Better Auth config and getAuthUser()
│  │  ├─ lib/db/               Drizzle client, schema and user-scoped queries
│  │  ├─ lib/net/              SSRF-safe fetch for scraped URLs
│  │  ├─ lib/scraper/          Website, social, ads, email and web-search scrapers
│  │  ├─ lib/scoring/          Digital-presence score engine
│  │  ├─ lib/google/           Google token handling, Sheets, Docs, Drive, Places photos
│  │  └─ proxy.ts              Redirects signed-out users; 401 for the API
│  ├─ drizzle/                 SQL migrations
│  ├─ scripts/                 migrate, seed, check-secrets
│  ├─ Dockerfile, docker-compose.yml
│  └─ .env.example
├─ overview/                   Project overview, backlog and the migration plan
├─ archive/supabase/           Old Supabase migrations, kept for reference
└─ CLAUDE.md                   Architecture notes for contributors and AI coding agents
```

---

## Security

- **Secrets stay out of git.** `.env*` (except `.env.example`) and `.claude/settings.local.json` are gitignored. Run `npm run check:secrets` before pushing; it scans everything git would commit for key formats and for the exact secret values in your `.env.local`.
- **Data isolation.** Every query is scoped to the signed-in user. Another user's records return 404, and uploaded files are served to their owner only.
- **No keys in the browser.** Google Places photos go through an authenticated proxy (`/api/places/photo`) that adds the key on the server.
- **SSRF protection.** Business websites and URLs found on them are fetched with a guard that blocks private, loopback, link-local and cloud-metadata addresses, checked at connection time and on every redirect. Headless-browser pages are filtered the same way.
- **AI cannot run tools.** OpenCode sessions are agents with tools, and prompts contain scraped website text. Every tool request is rejected automatically, so a prompt injection cannot touch your machine.
- **Public endpoints are limited.** Only sign-in and client error reporting (`/api/log`, 16 KB cap, 30 requests per minute per IP) work without a session.
- **Containers.** The app runs as a non-root user; secrets are injected at runtime, never baked into the image.

## Troubleshooting

| Problem | Fix |
|---|---|
| Sign-in fails with `redirect_uri_mismatch` | Add `http://localhost:3001/api/auth/callback/google` to the OAuth client's redirect URIs. |
| Exports fail with "insufficient scopes" | Sign out, sign in again and tick the Sheets, Docs and Drive boxes on Google's consent screen. |
| Audit shows "PageSpeed Insights API is blocked for this API key" | Enable the PageSpeed Insights API on the key's API restrictions, or set `PAGESPEED_API_KEY`. Changes can take a few minutes. |
| AI results come from Pollinations instead of Muse Spark | Check `opencode service status` shows `http://127.0.0.1:4096` and that `OPENCODE_SERVER_PASSWORD` matches the service password. After a failure the app skips OpenCode for 2 minutes. |
| AI errors mention `FreeTierError` | The free model only works through OpenCode; check the OpenCode version, or switch `OPENCODE_MODEL` to a paid model. |
| Port 3001 or 5433 already in use | Set `APP_HOST_PORT` / `POSTGRES_HOST_PORT` before `npm run docker:up`, and update the OAuth redirect URI if you change the app port. |
| PDF export fails locally with "Chrome not found" | Install Google Chrome or set `CHROME_EXECUTABLE_PATH`. |
| Search results have no audit button / audits return 400 | The database save failed for that result (its ID is a Google Place ID, not a UUID). Check the database is up and look at `logs/errors.log`. |

Server errors are appended to `leadsight/logs/errors.log` (a Docker volume when running in a container).
