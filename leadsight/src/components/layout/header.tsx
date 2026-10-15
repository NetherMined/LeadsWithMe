"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/account":  { title: "Account",  description: "Settings & usage" },
  "/search":   { title: "Search",   description: "Find businesses" },
  "/leads":    { title: "Leads",    description: "Saved businesses" },
  "/plans":    { title: "Plans",    description: "AI marketing plans" },
  "/exports":  { title: "Exports",  description: "Google Sheets & Docs" },
  "/outreach": { title: "Outreach", description: "Pipeline & follow-ups" },
  "/proof":    { title: "Proof",    description: "Case studies" },
};

function getPageMeta(pathname: string) {
  for (const [key, meta] of Object.entries(PAGE_META)) {
    if (pathname === key || pathname.startsWith(key + "/")) return meta;
  }
  return { title: "LeadSight", description: "B2B Lead Intelligence" };
}

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const meta = getPageMeta(pathname);
  const accountActive = pathname.startsWith("/account");

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <header
      className="flex items-center justify-between px-6 shrink-0 h-[60px] border-b"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      {/* Left: breadcrumb + page title */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="hidden md:block text-[12px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
          LeadSight
        </span>
        <svg className="hidden md:block shrink-0" style={{ opacity: 0.3 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <h1
          className="text-[15px] font-semibold leading-none truncate"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
        >
          {meta.title}
        </h1>
        <span
          className="hidden lg:block text-[11px] font-mono shrink-0 px-2 py-0.5 rounded"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
          }}
        >
          {meta.description}
        </span>
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Live indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-md"
          style={{ background: "var(--bg-deep)", border: "1px solid var(--border)" }}
        >
          <span className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent-green)" }} />
          <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>Live</span>
        </div>

        {/* Notification bell */}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          title="Notifications"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-deep)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User avatar */}
        <Link href="/account" title="My Account" className="ml-1">
          <div
            className="flex items-center justify-center rounded-full text-[11px] font-bold transition-opacity hover:opacity-75 w-7 h-7"
            style={{
              background: accountActive ? "var(--amber)" : "var(--amber-dim)",
              border: "1.5px solid var(--amber)",
              color: accountActive ? "#FFFFFF" : "var(--amber)",
              fontFamily: "var(--font-display)",
            }}
          >
            {initials}
          </div>
        </Link>
      </div>
    </header>
  );
}
