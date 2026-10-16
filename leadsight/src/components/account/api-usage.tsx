"use client";

import { useEffect, useState } from "react";
import { UsageBar } from "@/components/dashboard/usage-bar";
import { DailyChart } from "@/components/dashboard/daily-chart";

interface Summary {
  totalCalls: number;
  totalCost: number;
  googleCreditRemaining: number;
  daysLeft: number;
  periodStart: string;
  periodEnd: string;
}

interface ServiceRow {
  service: string;
  calls: number;
  cost: number;
  freeTierPct: number | null;
  status: string;
  color: string;
}

interface DayEntry {
  date: string;
  calls: number;
  cost: number;
}

interface RecentCall {
  id: string;
  service: string;
  operation: string;
  estimated_cost: number;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

const SERVICE_LABELS: Record<string, string> = {
  "google-places": "Google Places",
  "pagespeed":     "PageSpeed",
  "opencode":      "Muse Spark (OpenCode)",
  "pollinations":  "Pollinations AI",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const CARD_STYLE: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "20px 24px",
};

function OverviewCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={CARD_STYLE}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
        {sub}
      </p>
    </div>
  );
}

export function ApiUsage() {
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [byService, setByService] = useState<ServiceRow[]>([]);
  const [daily, setDaily]         = useState<DayEntry[]>([]);
  const [recent, setRecent]       = useState<RecentCall[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSummary(data.summary);
        setByService(data.byService ?? []);
        setDaily(data.dailyBreakdown ?? []);
        setRecent(data.recentCalls ?? []);
      })
      .catch(() => setError("Failed to load usage data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Loading...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <span style={{ color: "#EF4444", fontFamily: "var(--font-mono)", fontSize: 13 }}>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <OverviewCard label="Total API Calls" value={String(summary?.totalCalls ?? 0)} sub="this month" />
        <OverviewCard label="Estimated Cost" value={`$${(summary?.totalCost ?? 0).toFixed(4)}`} sub="this month" />
        <OverviewCard label="Google Credit Left" value={`$${(summary?.googleCreditRemaining ?? 0).toFixed(2)}`} sub="of $200.00" />
        <OverviewCard label="Days in Cycle" value={String(summary?.daysLeft ?? "—")} sub="remaining" />
      </div>

      {/* Per-service cards */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Service Usage
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {byService.map(row => (
            <div key={row.service} style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
                    {SERVICE_LABELS[row.service] ?? row.service}
                  </span>
                </div>
                {row.status === "pay-per-use" ? (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Pay-per-use</span>
                ) : (
                  <span style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: row.status === "red" ? "#EF4444" : row.status === "amber" ? "#F59E0B" : "#34D399",
                  }}>
                    {row.freeTierPct?.toFixed(1)}%
                  </span>
                )}
              </div>

              {row.freeTierPct !== null && (
                <div style={{ marginBottom: 10 }}>
                  <UsageBar pct={row.freeTierPct} color={row.color} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {row.calls} calls
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  ${row.cost.toFixed(4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Daily usage chart */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Daily Activity (last 30 days)
        </h2>
        <div style={{ ...CARD_STYLE, padding: "20px 20px 12px" }}>
          <DailyChart data={daily} />
        </div>
      </section>

      {/* Recent calls table */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Recent Calls
        </h2>
        <div style={{ ...CARD_STYLE, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Time", "Service", "Operation", "Cost"].map(h => (
                  <th key={h} style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    No calls recorded yet
                  </td>
                </tr>
              ) : recent.map(row => {
                const svcColor = ({
                  "google-places": "#4285F4",
                  "pagespeed": "#34A853",
                  "opencode": "#0EA5E9",
                  "pollinations": "#EC4899",
                } as Record<string, string>)[row.service] ?? "#888";

                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "9px 16px", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {relativeTime(row.created_at)}
                    </td>
                    <td style={{ padding: "9px 16px" }}>
                      <div className="flex items-center gap-2">
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: svcColor, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                          {SERVICE_LABELS[row.service] ?? row.service}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 16px", fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {row.operation}
                    </td>
                    <td style={{ padding: "9px 16px", fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      ${Number(row.estimated_cost).toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
