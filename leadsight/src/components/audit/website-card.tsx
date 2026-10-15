import type { WebsiteAudit, TechStackDetailed } from "@/types/audit";

interface WebsiteCardProps {
  audit?: WebsiteAudit | null;
  onRerun?: () => void;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const bg = score >= 80 ? "rgba(34,197,94,0.12)" : score >= 50 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";
  const border = score >= 80 ? "rgba(34,197,94,0.3)" : score >= 50 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)";
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "var(--amber)" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1" style={{ borderRadius: 10, border: `1px solid ${border}`, background: bg, padding: "10px 8px" }}>
      <span className="font-mono leading-none" style={{ fontSize: 24, fontWeight: 700, color }}>{score}</span>
      <span className="text-center" style={{ fontSize: 10, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

function CheckItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex-shrink-0" style={{ color: checked ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
        {checked ? "✓" : "✗"}
      </span>
      <span style={{ color: checked ? "var(--text-secondary)" : "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

export function WebsiteCard({ audit, onRerun }: WebsiteCardProps) {
  if (!audit) {
    return (
      <div className="text-center" style={{ borderRadius: 12, border: "1px dashed var(--border)", padding: "32px 24px" }}>
        <p className="text-text-muted text-sm">No website audit yet.</p>
        {onRerun && (
          <button onClick={onRerun} className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--accent)" }}>
            Run Website Audit
          </button>
        )}
      </div>
    );
  }

  const speedLabel = audit.page_speed_ms < 1000 ? "Fast" : audit.page_speed_ms < 3000 ? "Average" : "Slow";
  const speedColor = audit.page_speed_ms < 1000 ? "#22c55e" : audit.page_speed_ms < 3000 ? "var(--amber)" : "#ef4444";

  return (
    <div className="card-surface flex flex-col gap-4" style={{ padding: "24px" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Website Audit
        </h3>
        {onRerun && (
          <button onClick={onRerun} className="text-xs text-accent bg-none border-none cursor-pointer">
            Re-run
          </button>
        )}
      </div>

      {/* Score grid */}
      <div className="grid grid-cols-3 gap-2">
        <ScoreBadge score={audit.performance_score} label="Performance" />
        <ScoreBadge score={audit.seo_score} label="SEO" />
        <ScoreBadge score={audit.accessibility_score} label="Accessibility" />
      </div>

      {/* Checklist */}
      <div className="flex flex-col gap-1.5">
        <p className="label-overline">
          Technical Checks
        </p>
        <CheckItem checked={audit.has_ssl} label="SSL Certificate (HTTPS)" />
        <CheckItem checked={audit.mobile_friendly} label="Mobile Friendly" />
        <CheckItem checked={audit.has_analytics} label="Analytics Installed" />
        <CheckItem checked={audit.has_sitemap} label="Sitemap Present" />
        <CheckItem checked={audit.has_blog} label="Blog / Content Section" />
        <CheckItem checked={!!audit.has_deals} label="Deals / Specials / Offers" />
      </div>

      {/* Deals keywords */}
      {audit.has_deals && audit.deals_keywords?.length > 0 && (
        <div>
          <p className="label-overline mb-2">
            Detected Offers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {audit.deals_keywords.map(kw => (
              <span key={kw} style={{ borderRadius: 20, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", padding: "2px 10px", fontSize: 11, color: "#22c55e", textTransform: "capitalize" }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tech stack — categorized or flat fallback */}
      {(audit.tech_stack_detailed && Object.values(audit.tech_stack_detailed).some(arr => arr.length > 0)
        ? (
          <div className="flex flex-col gap-2.5">
            <p className="label-overline m-0">
              Tech Stack
            </p>
            {(Object.entries(audit.tech_stack_detailed) as [keyof TechStackDetailed, string[]][])
              .filter(([, items]) => items.length > 0)
              .map(([category, items]) => (
                <div key={category}>
                  <p className="label-overline text-xs mb-1.5">
                    {category.replace(/_/g, " ")}
                  </p>
                  <div className="flex flex-wrap gap-1.25">
                    {items.map(tech => (
                      <span key={tech} style={{ borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", padding: "2px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )
        : audit.tech_stack.length > 0 && (
          <div>
            <p className="label-overline mb-2">
              Tech Stack
            </p>
            <div className="flex flex-wrap gap-1.5">
              {audit.tech_stack.map(tech => (
                <span key={tech} style={{ borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", padding: "2px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )
      )}

      {/* External deal site listings */}
      {audit.external_deals?.length > 0 && (
        <div>
          <p className="label-overline mb-2">
            Deal Site Listings
          </p>
          <div className="flex flex-col gap-1.25">
            {audit.external_deals.map(deal => (
              <div key={deal.site} className="flex items-center gap-2 text-sm">
                <span className="flex-shrink-0 font-bold" style={{ color: deal.found ? "#22c55e" : "var(--text-muted)" }}>
                  {deal.found ? "✓" : "✗"}
                </span>
                {deal.found ? (
                  <a href={deal.url} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ color: "#22c55e" }}>
                    {deal.site}
                  </a>
                ) : (
                  <span className="text-text-muted">{deal.site}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page speed */}
      <div className="flex items-center justify-between text-sm pt-2 border-t border-border-base">
        <span className="text-text-muted">Page Load Speed</span>
        <span className="font-semibold font-mono" style={{ color: speedColor }}>
          {audit.page_speed_ms}ms · {speedLabel}
        </span>
      </div>

      {/* Blog freshness */}
      {audit.has_blog && audit.blog_last_post_date && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Last Blog Post</span>
          <span className="text-text-secondary font-mono">
            {new Date(audit.blog_last_post_date).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}
