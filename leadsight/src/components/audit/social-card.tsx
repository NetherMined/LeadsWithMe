import type { SocialAudit, SocialChannelAudit } from "@/types/audit";

interface SocialCardProps {
  audit?: SocialAudit | null;
  onRerun?: () => void;
}

const PLATFORM_META: Record<string, { char: string; color: string; label: string }> = {
  facebook:  { char: "f",  color: "#1877F2", label: "Facebook" },
  instagram: { char: "ig", color: "#E1306C", label: "Instagram" },
  linkedin:  { char: "in", color: "#0A66C2", label: "LinkedIn" },
  tiktok:    { char: "tt", color: "#010101", label: "TikTok" },
  twitter:   { char: "𝕏",  color: "#1DA1F2", label: "X / Twitter" },
  youtube:   { char: "▶",  color: "#FF0000", label: "YouTube" },
};

function fmt(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(2)}%`;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1 text-text-muted">
        <span>{label}</span>
        <span className="font-mono text-text-primary">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%`, transition: "width 500ms ease" }} />
      </div>
    </div>
  );
}

function ChannelRow({ channel, isFirst }: { channel: SocialChannelAudit; isFirst: boolean }) {
  const meta = PLATFORM_META[channel.platform];
  return (
    <tr style={{ borderTop: isFirst ? "none" : "1px solid var(--border)" }}>
      <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold text-white text-center flex-shrink-0"
            style={{
              backgroundColor: meta?.color ?? "#555",
              borderRadius: 4,
              padding: "2px 5px",
              minWidth: 20,
            }}
          >
            {meta?.char ?? channel.platform[0].toUpperCase()}
          </span>
          <span className="text-xs text-text-primary font-sans">
            {meta?.label ?? channel.platform}
          </span>
        </div>
      </td>
      <td className="text-right" style={{ padding: "9px 12px" }}>
        <span className="text-xs font-mono" style={{ color: channel.follower_count ? "var(--text-primary)" : "var(--text-muted)" }}>
          {fmt(channel.follower_count)}
        </span>
      </td>
      <td className="text-right" style={{ padding: "9px 12px" }}>
        <span className="text-xs font-mono" style={{ color: channel.post_count_last_30d ? "var(--text-primary)" : "var(--text-muted)" }}>
          {fmt(channel.post_count_last_30d)}
        </span>
      </td>
      <td className="text-right" style={{ padding: "9px 12px" }}>
        <span className="text-xs font-mono" style={{
          color: channel.avg_engagement_rate
            ? channel.avg_engagement_rate >= 3 ? "#22c55e" : channel.avg_engagement_rate >= 1 ? "#f59e0b" : "#ef4444"
            : "var(--text-muted)",
        }}>
          {fmtPct(channel.avg_engagement_rate)}
        </span>
      </td>
      <td className="text-center" style={{ padding: "9px 12px" }}>
        <span className="text-xs" style={{ color: channel.is_verified ? "#22c55e" : "var(--text-muted)" }}>
          {channel.is_verified ? "✓" : "—"}
        </span>
      </td>
      <td style={{ padding: "9px 12px" }}>
        {channel.url && (
          <a
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent"
          >
            Visit ↗
          </a>
        )}
      </td>
    </tr>
  );
}

export function SocialCard({ audit, onRerun }: SocialCardProps) {
  if (!audit) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border)" }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No social audit yet.</p>
        {onRerun && (
          <button onClick={onRerun} className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}>
            Run Social Audit
          </button>
        )}
      </div>
    );
  }

  const channels = (audit.channels as SocialChannelAudit[]) ?? [];
  const present = channels.filter(c => c.exists);
  const missing = audit.missing_platforms ?? [];

  return (
    <div className="rounded-xl border p-6 space-y-5" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
          Social Media Audit
        </h3>
        {onRerun && (
          <button onClick={onRerun} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
            Re-run
          </button>
        )}
      </div>

      {/* Score bars */}
      <div className="space-y-3">
        <ScoreBar score={audit.platform_coverage_score} label="Platform Coverage" />
        <ScoreBar score={audit.engagement_score} label="Engagement Health" />
      </div>

      {/* Stats table */}
      {present.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
            Channel Stats
          </p>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Platform", "Followers", "Posts/30d", "Eng. Rate", "Verified", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "7px 12px",
                      textAlign: i >= 1 && i <= 4 ? "right" : "left",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      background: "rgba(255,255,255,0.02)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {present.map((c, i) => (
                  <ChannelRow key={c.platform} channel={c} isFirst={i === 0} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Missing platforms */}
      {missing.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ef4444", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
            ⚠ Missing Platforms
          </p>
          <div className="flex flex-wrap gap-2">
            {missing.map(p => {
              const meta = PLATFORM_META[p];
              return (
                <div key={p} className="flex items-center gap-1.5 rounded-full border px-3 py-1"
                  style={{ borderColor: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", backgroundColor: meta?.color ?? "#555", borderRadius: 3, padding: "1px 4px" }}>
                    {meta?.char ?? p[0]}
                  </span>
                  <span style={{ fontSize: 11, color: "#ef4444", textTransform: "capitalize" }}>{meta?.label ?? p}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {present.length === 0 && missing.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>No social data available.</p>
      )}
    </div>
  );
}
