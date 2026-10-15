"use client";

import { useState } from "react";
import type { OutreachAssets } from "@/types/outreach";
import { FeeCalculator } from "./FeeCalculator";
import { IssueRanker } from "./IssueRanker";
import { LoomScriptViewer } from "./LoomScriptViewer";
import { EmailPreview } from "./EmailPreview";
import { Button } from "@/components/ui/button";

interface OutreachAssetCardProps {
  businessId: string;
  businessName: string;
}

type ContactChannel = "email" | "linkedin";

export function OutreachAssetCard({ businessId, businessName }: OutreachAssetCardProps) {
  const [assets, setAssets] = useState<OutreachAssets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<{ success: boolean; channel: ContactChannel } | null>(null);
  const [isMarkingContacted, setIsMarkingContacted] = useState(false);

  const handleGenerate = async (params: { flat_fee: number; target_currency: string; delivery_days: number }) => {
    setIsLoading(true);
    setError(null);
    setAssets(null);

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          target_currency: params.target_currency,
          flat_fee: params.flat_fee,
          delivery_days: params.delivery_days,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate outreach assets");
      }

      const data = await response.json();
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkContacted = async (channel: ContactChannel) => {
    if (!assets) return;

    setIsMarkingContacted(true);
    setError(null);
    setContactStatus(null);

    try {
      const response = await fetch("/api/outreach/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          status: "contacted",
          channel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark as contacted");
      }

      setContactStatus({ success: true, channel });
      setTimeout(() => setContactStatus(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsMarkingContacted(false);
    }
  };

  return (
    <div className="space-y-6">
      <FeeCalculator onGenerate={handleGenerate} isLoading={isLoading} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {contactStatus && contactStatus.success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ Marked as contacted via {contactStatus.channel}
          </p>
        </div>
      )}

      {assets && (
        <>
          <div className="space-y-6">
            <IssueRanker issues={assets.identified_issues} />
            <LoomScriptViewer script={assets.loom_script} />
            <EmailPreview
              emailSubject={assets.email_subject}
              emailBody={assets.email_body}
              linkedinNote={assets.linkedin_connect_note}
              linkedinFollowup={assets.linkedin_followup}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => handleMarkContacted("email")}
              disabled={isMarkingContacted}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {isMarkingContacted ? "Updating..." : "Mark Contacted (Email)"}
            </Button>
            <Button
              onClick={() => handleMarkContacted("linkedin")}
              disabled={isMarkingContacted}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {isMarkingContacted ? "Updating..." : "Mark Contacted (LinkedIn)"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
