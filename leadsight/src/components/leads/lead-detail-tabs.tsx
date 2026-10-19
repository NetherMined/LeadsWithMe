"use client";

import { useState } from "react";
import { ScoreGauge } from "@/components/audit/score-gauge";
import { WebsiteCard } from "@/components/audit/website-card";
import { SocialCard } from "@/components/audit/social-card";
import { AdsCard } from "@/components/audit/ads-card";
import { CompetitorsCard } from "@/components/audit/competitors-card";
import { OutreachAssetPanel } from "@/components/outreach/OutreachAssetPanel";
import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";
import type { DigitalPresenceScore } from "@/types/score";
import type { CompetitorInfo } from "@/types/business";

interface CompetitorAverages {
  total?: number;
  website?: number;
  social?: number;
  engagement?: number;
  advertising?: number;
  reviews?: number;
}

interface LeadDetailTabsProps {
  businessId: string;
  score: DigitalPresenceScore | null;
  websiteAudit: WebsiteAudit | null;
  socialAudit: SocialAudit | null;
  adsAudit: AdsAudit | null;
  competitors: CompetitorInfo[] | null;
  businessInfo: {
    name: string;
    rating: number | null;
    review_count: number;
    category?: string;
  };
  competitorAverages?: CompetitorAverages | null;
}

export function LeadDetailTabs({
  businessId,
  score,
  websiteAudit,
  socialAudit,
  adsAudit,
  competitors,
  businessInfo,
  competitorAverages,
}: LeadDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("audit");

  return (
    <div>
      <div className="flex border-b border-border mb-5">
        <button
          onClick={() => setActiveTab("audit")}
          className="px-4 py-3 text-[13px] font-semibold bg-transparent border-none cursor-pointer transition-all duration-200"
          style={{
            color: activeTab === "audit" ? "var(--accent)" : "var(--text-muted)",
            borderBottom: activeTab === "audit" ? "2px solid var(--accent)" : "none",
          }}
        >
          Audit
        </button>
        <button
          onClick={() => setActiveTab("outreach")}
          className="px-4 py-3 text-[13px] font-semibold bg-transparent border-none cursor-pointer transition-all duration-200"
          style={{
            color: activeTab === "outreach" ? "var(--accent)" : "var(--text-muted)",
            borderBottom: activeTab === "outreach" ? "2px solid var(--accent)" : "none",
          }}
        >
          Outreach
        </button>
      </div>

      {activeTab === "audit" && (
        <div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ScoreGauge score={score} size="lg" competitorAverages={competitorAverages} />
            <WebsiteCard audit={websiteAudit} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <SocialCard audit={socialAudit} />
            <AdsCard audit={adsAudit} />
          </div>

          {competitors && competitors.length > 0 && (
            <div className="mt-6">
              <CompetitorsCard
                competitors={competitors}
                business={{
                  name: businessInfo.name,
                  rating: businessInfo.rating,
                  review_count: businessInfo.review_count || 0,
                  category: businessInfo.category,
                }}
                businessId={businessId}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "outreach" && (
        <div>
          <OutreachAssetPanel businessId={businessId} />
        </div>
      )}
    </div>
  );
}
