import Link from "next/link";
import { getAuthUser } from "@/lib/auth/server";
import { SampleReport } from "@/components/landing/sample-report";

const STEPS = [
  { title: "Search", body: "Pick a business type and an area. LeadSight pulls every match from Google Places and puts them on a map." },
  { title: "Audit", body: "Each lead's website, social channels and advertising are checked: page speed, SEO, posting activity, live ads." },
  { title: "Score & plan", body: "Every lead gets a 0–100 digital presence score and an AI marketing plan aimed at its weakest areas." },
  { title: "Pitch", body: "Send a website proposal with a live demo, outreach emails and a PDF report, then track replies in the pipeline." },
];

const FEATURES = [
  { title: "Map-based lead search", body: "Find local businesses by category and location, with ratings, reviews and contact details." },
  { title: "Digital presence score", body: "One number per lead, built from website, social, engagement, advertising and reviews." },
  { title: "Website proposals with demos", body: "A written proposal and a working demo site in the business's own colours, ready to show." },
  { title: "AI marketing plans", body: "Specific recommendations based on each lead's audit results, not generic advice." },
  { title: "Outreach pipeline", body: "Personalised emails, Loom scripts, fee estimates and a kanban board with follow-up reminders." },
  { title: "Google Workspace export", body: "Send leads to Sheets and reports to Docs or Drive, or download a PDF." },
];

export default async function Home() {
  const user = await getAuthUser();
  const contactEmail = process.env.CONTACT_EMAIL;
  const bookingUrl = process.env.BOOKING_URL;
  const ctaHref = user ? "/search" : "/login";
  const ctaLabel = user ? "Open dashboard" : "Get started free";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)", color: "var(--text-primary)" }}>
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-white" style={{ background: "var(--accent)" }}>L</span>
            LeadSight
          </Link>
          <nav className="flex items-center gap-3">
            <a href="#how" className="hidden text-sm sm:inline" style={{ color: "var(--text-secondary)" }}>How it works</a>
            <a href="#features" className="hidden text-sm sm:inline" style={{ color: "var(--text-secondary)" }}>Features</a>
            <Link href={ctaHref} className="btn-primary">{user ? "Open dashboard" : "Sign in"}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <div className="status-badge mb-5">Lead generation for marketing agencies</div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
              Find local businesses that need you, and show them why.
            </h1>
            <p className="mt-5 max-w-xl text-lg" style={{ color: "var(--text-secondary)" }}>
              LeadSight finds businesses in any area, audits their website, social media and ads, scores them out of 100,
              and builds the proposal you&apos;ll pitch them with.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={ctaHref} className="btn-primary" style={{ padding: "12px 20px", fontSize: 15 }}>{ctaLabel}</Link>
              <a href="#how" className="btn-secondary" style={{ padding: "12px 20px", fontSize: 15 }}>See how it works</a>
            </div>
            <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>Sign in with Google. Exports go to your own Drive.</p>
          </div>
          <SampleReport />
        </section>

        <section id="how" className="py-16" style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">From search to signed client in four steps</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-bold" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                    {i + 1}
                  </div>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Everything you need to pitch</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-surface p-6">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl px-6 py-12 text-center sm:px-12" style={{ background: "var(--bg-sidebar)" }}>
            <h2 className="text-3xl font-bold tracking-tight text-white">Ready to find your next clients?</h2>
            <p className="mx-auto mt-3 max-w-xl text-blue-100">
              {contactEmail || bookingUrl
                ? "Start searching now, or talk to us about how LeadSight fits your agency."
                : "Start searching now. Your first audit takes a couple of minutes."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={ctaHref} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold" style={{ color: "var(--bg-sidebar)" }}>
                {ctaLabel}
              </Link>
              {bookingUrl && (
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
                  Book a call
                </a>
              )}
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
                  Email us
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6" style={{ color: "var(--text-muted)" }}>
          <span>© {new Date().getFullYear()} LeadSight</span>
          <div className="flex gap-4">
            {contactEmail && <a href={`mailto:${contactEmail}`}>{contactEmail}</a>}
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
