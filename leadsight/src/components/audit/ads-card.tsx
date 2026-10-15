import type { AdsAudit } from "@/types/audit";

interface AdsCardProps {
  audit?: AdsAudit | null;
  onRerun?: () => void;
}

function StatusPill({ active, label, sublabel }: { active: boolean | null; label: string; sublabel?: string }) {
  const bg = active === true
    ? "rgba(34,197,94,0.1)"
    : active === false
    ? "rgba(255,255,255,0.03)"
    : "rgba(245,158,11,0.1)";
  const border = active === true ? "rgba(34,197,94,0.3)" : active === false ? "var(--border)" : "rgba(245,158,11,0.3)";
  const color = active === true ? "#22c55e" : active === false ? "var(--text-muted)" : "var(--amber)";
  const icon = active === true ? "✓" : active === false ? "✗" : "?";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 8, border: `1px solid ${border}`, background: bg, padding: "10px 14px" }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{label}</p>
        {sublabel && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sublabel}</p>}
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{icon}</span>
    </div>
  );
}

function DomainAuthorityGauge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "14px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Domain Authority Unknown</p>
      </div>
    );
  }

  const color = score >= 40 ? "#22c55e" : score >= 20 ? "var(--amber)" : "#ef4444";
  const barColor = score >= 40 ? "#22c55e" : score >= 20 ? "var(--amber)" : "#ef4444";

  return (
    <div style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Domain Authority</p>
        <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{score}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--border)" }}>
        <div style={{ height: 6, borderRadius: 3, background: barColor, width: `${score}%`, transition: "width 500ms ease" }} />
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
        {score >= 40 ? "Strong online authority" : score >= 20 ? "Growing presence" : "Low authority — link building recommended"}
      </p>
    </div>
  );
}

export function AdsCard({ audit, onRerun }: AdsCardProps) {
  if (!audit) {
    return (
      <div style={{ borderRadius: 12, border: "1px dashed var(--border)", padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No advertising audit yet.</p>
        {onRerun && (
          <button onClick={onRerun} style={{ marginTop: 12, borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Run Ads Audit
          </button>
        )}
      </div>
    );
  }

  const noAds = !audit.has_meta_ads && !audit.has_google_ads;

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
          Advertising Audit
        </h3>
        {onRerun && (
          <button onClick={onRerun} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
            Re-run
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <StatusPill
          active={audit.has_meta_ads}
          label="Meta / Facebook Ads"
          sublabel={audit.has_meta_ads ? `${audit.meta_ad_count} active ad${audit.meta_ad_count !== 1 ? "s" : ""}` : "No active ads found"}
        />
        <StatusPill
          active={audit.has_google_ads}
          label="Google Ads"
          sublabel={audit.has_google_ads ? "Conversion tracking detected" : "Not detected"}
        />
      </div>

      <DomainAuthorityGauge score={audit.domain_authority} />

      {noAds && (
        <div style={{ borderRadius: 8, background: "var(--amber-dim)", border: "1px solid rgba(245,158,11,0.3)", padding: "12px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--amber)", margin: 0 }}>💡 No paid advertising detected</p>
          <p style={{ fontSize: 11, color: "rgba(245,158,11,0.8)", marginTop: 4 }}>
            Relying entirely on organic reach. Paid ads could significantly increase lead flow.
          </p>
        </div>
      )}
    </div>
  );
}
