"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      {
        href: "/search",
        label: "Search",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
        ),
      },
      {
        href: "/leads",
        label: "Leads",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: "/outreach",
        label: "Outreach",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.42 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        href: "/plans",
        label: "Plans",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        ),
      },
      {
        href: "/proof",
        label: "Proof",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ),
      },
      {
        href: "/exports",
        label: "Exports",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        ),
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const accountActive = pathname.startsWith("/account");

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <aside
      className="flex h-screen shrink-0 flex-col border-r"
      style={{
        width: "var(--sidebar-width, 240px)",
        background: "var(--bg-sidebar)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 h-[60px] border-b shrink-0"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="relative flex items-center justify-center shrink-0 w-7 h-7">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L28.7 9.5V24.5L16 32L3.3 24.5V9.5L16 2Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.60)" strokeWidth="1.5"/>
            <text x="16" y="21" textAnchor="middle" fill="white" fontSize="10" fontFamily="var(--font-display)" fontWeight="700">LS</text>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="block text-[14px] font-semibold tracking-tight leading-none truncate"
            style={{ color: "var(--sidebar-active-text)", fontFamily: "var(--font-display)" }}
          >
            LeadSight
          </span>
          <span className="block text-[10px] tracking-[0.1em] uppercase mt-0.5 font-mono" style={{ color: "var(--sidebar-text-muted)" }}>
            Intelligence
          </span>
        </div>
        {/* Live dot */}
        <span className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.55)" }} title="Connected" />
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p
              className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase font-mono"
              style={{ color: "var(--sidebar-section-text)" }}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${active ? "nav-active-glow" : ""}`}
                    style={{
                      color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                      background: active ? undefined : undefined,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <span
                      className="shrink-0 transition-all duration-150"
                      style={{ opacity: active ? 1 : 0.65 }}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {active && (
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.6)" }} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — user */}
      <div className="border-t shrink-0" style={{ borderColor: "var(--sidebar-border)" }}>
        {/* User row */}
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <Link href="/account" title="My Account" className="shrink-0">
            <div
              className="flex items-center justify-center rounded-full text-[11px] font-bold transition-opacity hover:opacity-75 w-7 h-7"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1.5px solid rgba(255,255,255,0.35)",
                color: "#FFFFFF",
                fontFamily: "var(--font-display)",
              }}
            >
              {initials}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] truncate font-mono" style={{ color: "var(--sidebar-text-muted)" }}>
              {user?.email ?? "—"}
            </p>
          </div>
          <button
            onClick={() => router.push("/account")}
            title="Account settings"
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: "var(--sidebar-text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button
            onClick={signOut}
            title="Sign out"
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{ color: "var(--sidebar-text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
