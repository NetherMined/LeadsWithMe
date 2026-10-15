# Demo Site + Proposal Download — Integration

Adds a one-click **single-file HTML demo site** for no-website leads, screenshots it,
and stores it against the lead — alongside the existing `.md` proposal download.

## Why this runs in your existing serverless setup

The demo is one self-contained HTML string (inline CSS/JS, no external assets).
We screenshot it with Puppeteer `page.setContent(html)` — **no localhost server,
no opencode, no background worker.** It uses the same `puppeteer-core` +
`@sparticuz/chromium` you already run in the proof module, so it fits in a normal
API route (we set `maxDuration = 60`).

## Files

| File | Role |
|---|---|
| `lib/demo/generateDemo.ts` | Prompt + AI call that returns clean HTML (swappable model fn) |
| `lib/demo/screenshotDemo.ts` | Renders HTML in Chromium, captures desktop + mobile PNGs |
| `app/api/proposal/demo/route.ts` | Generate → screenshot → upload → store, linked to lead |
| `components/ProposalActions.tsx` | "Download Proposal (.md)" + "Generate Demo Site" buttons |
| `supabase/proposal_demos.sql` | New table + RLS + storage bucket |

## Setup

1. Run `supabase/proposal_demos.sql` (creates table, policies, and the
   `proposal-demos` storage bucket).
2. Copy `lib/` and `app/` files into the project. Ensure `@anthropic-ai/sdk` is
   installed (or swap `callModel` for your `lib/ai/client.ts` helper — see below).
3. Drop `<ProposalActions businessId={business.id} />` into the red-bordered
   search card and/or the lead detail page.
4. Local dev: set `CHROME_EXECUTABLE_PATH` to a local Chrome/Chromium binary so
   Puppeteer launches outside the serverless image.

## Integration points to confirm

- **AI client.** `generateDemoHtml(business, md, complete)` takes an optional
  completion fn. Pass your existing `lib/ai/client.ts` function to reuse the
  circuit breaker + Pollinations fallback; otherwise the bundled `callModel`
  (Anthropic primary, Pollinations fallback) runs standalone.
- **Auth.** The route imports `getAuthUser` from `@/lib/supabase/server` per your
  documented pattern.
- **`businesses` columns.** The SELECT assumes `socials` holds social links. Map
  it to however you actually store them.
- **`.md` download.** Reuses your existing `POST /api/audit/website-proposal`,
  which returns `{ markdown, filename }` per Section 6 of the overview.
- **Screenshot URLs.** Bucket is public for easy embedding. Switch to signed URLs
  via `createSignedUrl` if you'd rather keep them private.

## Natural next step (already wired data-wise)

The demo + screenshots are saved on the lead, so the sell-side hookups are short:

- **Outreach:** in `lib/outreach/generator.ts`, pull the latest `proposal_demos`
  row and reference the live demo + desktop screenshot in the cold email.
- **Report/PDF:** your `lib/pdf/generator.ts` already embeds screenshots — add the
  demo shots next to the proposal sections to produce a "here's your new site" PDF.
- **Vision (optional):** if you want the AI to *critique* the screenshots rather
  than just embed them, route that one call to a vision-capable model; the
  Pollinations fallback may not support image input.
