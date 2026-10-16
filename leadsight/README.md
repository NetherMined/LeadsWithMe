# LeadSight

B2B lead generation and digital-marketing audit app. It finds local businesses with Google Places, audits their website, social and ad presence, scores them 0–100, writes AI marketing plans and outreach, and exports to Google Sheets, Docs, Drive and PDF.

Stack: Next.js 16, PostgreSQL 16 + Drizzle ORM, Better Auth (Google sign-in), Anthropic Claude, Puppeteer, Docker Compose.

## Run with Docker

```bash
cp .env.example .env.local   # fill in the keys
npm run docker:up            # db + migrations + app
```

The app is served on <http://localhost:3001> and Postgres on host port 5433. Migrations run automatically, and the dev user is seeded when `DEV_USER_ID` is set.

## Run locally

```bash
npm install
npm run db:up                # Postgres container only
npm run db:migrate
npm run db:seed              # optional: dev user for DISABLE_AUTH=true
npm run dev                  # http://localhost:3001
```

On Windows and macOS, Puppeteer uses your installed Chrome; set `CHROME_EXECUTABLE_PATH` if it isn't found.

## Configuration

All variables are documented in [`.env.example`](./.env.example). The essentials:

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, with the redirect URI `http://localhost:3001/api/auth/callback/google`
- `GOOGLE_PLACES_API_KEY` (enable the PageSpeed Insights API on it, or set `PAGESPEED_API_KEY`)
- `ANTHROPIC_API_KEY`, `BRAVE_SEARCH_API_KEY`

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server (port 3001) |
| `npm run lint` / `npm test` | ESLint / Vitest |
| `npm run db:generate` | Generate a migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:studio` | Apply migrations / seed the dev user / open Drizzle Studio |
| `npm run db:up` / `docker:up` | Start Postgres only / build and start the full stack |

Architecture notes for contributors are in the repository root `CLAUDE.md` and `overview/project_overview.md`.
