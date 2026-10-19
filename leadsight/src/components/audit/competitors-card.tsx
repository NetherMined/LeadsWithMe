"use client";

import { useState } from "react";
import type { CompetitorInfo } from "@/types/business";

interface CompetitorsCardProps {
  competitors: CompetitorInfo[];
  business: { name: string; rating: number | null; review_count: number; category?: string };
  businessId?: string;
}

export function CompetitorsCard({ competitors: initial, business, businessId }: CompetitorsCardProps) {
  const [competitors, setCompetitors] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const avgRating = competitors.length
    ? competitors.reduce((sum, c) => sum + (c.rating ?? 0), 0) / Math.max(1, competitors.filter(c => c.rating).length)
    : null;

  async function togglePin(placeId: string) {
    if (!businessId) return;
    setBusy(placeId);
    const next = competitors.map(c =>
      c.place_id === placeId ? { ...c, pinned: !((c as any).pinned) } : c
    );
    setCompetitors(next);
    try {
      await fetch("/api/audit/competitors/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId, competitors: next }),
      });
    } catch {
      setCompetitors(initial);
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...competitors].sort((a, b) => Number(!!(b as any).pinned) - Number(!!(a as any).pinned));

  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--bg-surface)",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
          Competitor Comparison
        </h3>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
          Local {business.category || "businesses"}. Pin the most relevant ones. Results ranked by name/category overlap.
        </p>
      </div>

      {avgRating !== null && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          Avg competitor rating: <span style={{ color: "var(--amber)", fontWeight: 600 }}>★ {avgRating.toFixed(1)}</span>
          {business.rating && <> · You: <span style={{ color: "var(--amber)", fontWeight: 600 }}>★ {business.rating}</span></>}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr>
              {["", "Name", "Rating", "Reviews", "Website", "Phone"].map(col => (
                <th key={col} style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "rgba(52,211,153,0.08)" }}>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}></td>
              <td style={{ padding: "8px 10px", color: "var(--text-primary)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
                {business.name}
                <span style={{ marginLeft: 6, fontSize: 9, color: "#34d399", fontWeight: 700, textTransform: "uppercase" }}>you</span>
              </td>
              <td style={{ padding: "8px 10px", color: "var(--amber)", borderBottom: "1px solid var(--border)" }}>
                {business.rating !== null ? `★ ${business.rating}` : "—"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {business.review_count.toLocaleString()}
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
              </td>
              <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>—</span>
              </td>
            </tr>

            {sorted.map(c => {
              const pinned = !!(c as any).pinned;
              return (
                <tr key={c.place_id} style={{ borderBottom: "1px solid var(--border)", opacity: busy === c.place_id ? 0.6 : 1 }}>
                  <td style={{ padding: "8px 10px" }}>
                    <button
                      type="button"
                      onClick={() => togglePin(c.place_id)}
                      disabled={!businessId || busy === c.place_id}
                      title={pinned ? "Unpin" : "Pin as relevant"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        color: pinned ? "#f59e0b" : "var(--text-muted)",
                      }}
                    >
                      {pinned ? "★" : "☆"}
                    </button>
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                    {pinned && <span style={{ marginLeft: 6, fontSize: 9, color: "#f59e0b" }}>pinned</span>}
                  </td>
                  <td style={{ padding: "8px 10px", color: c.rating !== null ? "var(--amber)" : "var(--text-muted)" }}>
                    {c.rating !== null ? `★ ${c.rating}` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>
                    {c.review_count.toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ color: "#22c55e", textDecoration: "none", fontWeight: 700 }}>✓</a>
                    ) : (
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>✗</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.phone ? (
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>
        Pin the true competitors. Deep site comparison (CTAs, content, tech, colors/fonts) is available after auditing them.
      </p>
    </div>
  );
}
