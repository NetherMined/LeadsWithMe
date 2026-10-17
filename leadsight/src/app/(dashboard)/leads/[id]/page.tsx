import { getAuthUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getFullBusinessProfile } from "@/lib/db/queries";
import { ScoreGauge } from "@/components/audit/score-gauge";
import { WebsiteCard } from "@/components/audit/website-card";
import { SocialCard } from "@/components/audit/social-card";
import { AdsCard } from "@/components/audit/ads-card";
import { AuditButton } from "@/components/audit/audit-button";
import { GeneratePlanButton } from "@/components/plans/generate-plan-button";
import { ExportButton } from "@/components/export/export-button";
import { EmailEnricher } from "@/components/leads/email-enricher";
import { CompetitorsCard } from "@/components/audit/competitors-card";
import { LeadDetailTabs } from "@/components/leads/lead-detail-tabs";
import { ProposalPanel } from "@/components/leads/proposal-panel";
import type { CompetitorInfo } from "@/types/business";
import { SOCIAL_ICONS } from "@/types/constants";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getFullBusinessProfile(id, user.id);

  if (!profile) {
    return (
      <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-muted)" }}>
        Business not found.
      </div>
    );
  }

  const { business, websiteAudit, socialAudit, adsAudit, score, plan } = profile;
  const planId = plan?.id ?? null;

  const socials = Object.entries(business.social_links ?? {}).filter(([, v]) => !!v);

  return (
    <div className="space-y-6">
      {/* Business header card */}
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Left: identity */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", margin: 0 }}>
                {business.name}
              </h1>
              {business.search_term && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-glow)",
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontFamily: "var(--font-mono)",
                }}>
                  {business.search_term}
                </span>
              )}
            </div>

            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
              {business.address}
            </p>

            {business.rating !== null && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--amber)", fontSize: 13 }}>★ {business.rating}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  ({business.review_count} reviews)
                </span>
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <AuditButton businessId={id} hasWebsite={!!business.website} />
            <GeneratePlanButton businessId={id} />
            <ExportButton businessId={id} planId={planId ?? undefined} businessIds={[id]} />
          </div>
        </div>

        {/* Contact & digital info grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 10,
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}>
          {business.phone && (
            <ContactItem icon="phone" label="Landline" href={`tel:${business.phone}`} value={business.phone} />
          )}
          {business.mobile && (
            <ContactItem icon="mobile" label="Mobile" href={`tel:${business.mobile}`} value={business.mobile} />
          )}
          {business.whatsapp && (
            <ContactItem icon="whatsapp" label="WhatsApp" href={business.whatsapp} value="Open Chat" color="#25D366" external />
          )}
          {business.email && (
            <ContactItem icon="email" label="Email" href={`mailto:${business.email}`} value={business.email} />
          )}
          {business.website && (
            <ContactItem icon="web" label="Website" href={business.website} value={business.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} external />
          )}
        </div>

        {/* Social links */}
        {socials.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {socials.map(([platform, url]) => {
              const icon = SOCIAL_ICONS[platform];
              if (!icon) return null;
              return (
                <a key={platform} href={url!} target="_blank" rel="noopener noreferrer" title={icon.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, color: "#fff",
                    backgroundColor: icon.color,
                    borderRadius: 6, padding: "4px 10px",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 10 }}>{icon.char}</span>
                  {icon.label}
                </a>
              );
            })}
          </div>
        )}

        {/* Hours */}
        {business.hours && business.hours.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-mono)", userSelect: "none" }}>
              Opening Hours ▾
            </summary>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 4 }}>
              {business.hours.map((h, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{h}</div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Email extractor */}
      <EmailEnricher
        businessId={id}
        existingEmails={[
          ...(business.email ? [business.email] : []),
          ...((business.emails as string[] | null) ?? []).filter(e => e !== business.email),
        ]}
      />

      {/* Website proposal: build, view and export proposal + demo versions */}
      <ProposalPanel businessId={id} businessName={business.name} hasWebsite={!!business.website} />

      {/* Tabbed content: Audit & Outreach */}
      <LeadDetailTabs
        businessId={id}
        score={score}
        websiteAudit={websiteAudit}
        socialAudit={socialAudit}
        adsAudit={adsAudit}
        competitors={business.competitors as CompetitorInfo[] | null}
        businessInfo={{ name: business.name, rating: business.rating, review_count: business.review_count }}
      />
    </div>
  );
}


function ContactItem({
  icon, label, href, value, color, external,
}: {
  icon: string;
  label: string;
  href: string;
  value: string;
  color?: string;
  external?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {label}
      </span>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{
          fontSize: 11,
          color: color ?? "var(--text-secondary)",
          textDecoration: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
        title={value}
      >
        {value}
      </a>
    </div>
  );
}
