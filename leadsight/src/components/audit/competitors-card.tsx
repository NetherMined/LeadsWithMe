import type { CompetitorInfo } from "@/types/business";

interface CompetitorsCardProps {
  competitors: CompetitorInfo[];
  business: { name: string; rating: number | null; review_count: number; category?: string };
}

export function CompetitorsCard({ competitors, business }: CompetitorsCardProps) {
  const avgRating = competitors.length
    ? competitors.reduce((sum, c) => sum + (c.rating ?? 0), 0) / competitors.filter(c => c.rating).length
    : null;

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
          Local {business.category || "businesses"} found via Places search. Review for true relevance — some may be adjacent categories.
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
              {["Name", "Rating", "Reviews", "Website", "Phone"].map(col => (
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

            {competitors.map(c => (
              <tr key={c.place_id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
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
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>
        Tip: For design inspiration, run a full audit on top competitors and review the deep site comparison (CTAs, content, tech) on the lead detail page.
      </p>
    </div>
  );
}
