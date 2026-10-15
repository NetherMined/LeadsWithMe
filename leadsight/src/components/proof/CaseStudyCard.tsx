"use client";

import { useEffect, useState } from "react";
import { BeforeAfterComparison } from "./BeforeAfterComparison";
import { SnapshotCapture } from "./SnapshotCapture";
import { ExportButton } from "@/components/export/export-button";
import type { CaseStudyData } from "@/types/proof";

interface CaseStudyCardProps {
  businessId: string;
  businessName: string;
  category: string;
  city: string | null;
  wonAmount: number | null;
}

export function CaseStudyCard({
  businessId,
  businessName,
  category,
  city,
  wonAmount,
}: CaseStudyCardProps) {
  const [caseStudy, setCaseStudy] = useState<CaseStudyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchCaseStudy() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/proof/case-study/${businessId}`);
      const data = await res.json() as CaseStudyData | { error?: string };

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to load case study");
      }

      setCaseStudy(data as CaseStudyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case study");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCaseStudy();
  }, [businessId]);

  function handleSnapshotCaptured() {
    fetchCaseStudy();
  }

  return (
    <div
      style={{
        borderRadius: "0.5rem",
        border: `1px solid rgba(255,255,255,0.07)`,
        background: "var(--bg-surface)",
        padding: "1.5rem",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--text-primary)" }}>
              {businessName}
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{city}</p>
          </div>
          {wonAmount !== null && wonAmount > 0 && (
            <div
              style={{
                marginLeft: "1rem",
                borderRadius: "0.5rem",
                background: "var(--accent-green)",
                padding: "0.25rem 0.75rem",
                textAlign: "right",
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Won Amount
              </p>
              <p
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "700",
                  color: "var(--text-primary)",
                }}
              >
                ${wonAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div
            style={{
              background: "var(--accent)",
              color: "var(--text-primary)",
              padding: "0.25rem 0.75rem",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
            }}
          >
            {category}
          </div>
          {caseStudy?.pipeline_status && (
            <div
              style={{
                background: "transparent",
                color: "var(--text-primary)",
                border: `1px solid rgba(255,255,255,0.07)`,
                padding: "0.25rem 0.75rem",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
              }}
            >
              {caseStudy.pipeline_status}
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && !caseStudy && (
        <div style={{ textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div
            style={{
              display: "inline-block",
              height: "1.5rem",
              width: "1.5rem",
              animation: "spin 1s linear infinite",
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: "var(--accent-blue)",
            }}
          />
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Loading case study...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            borderRadius: "0.5rem",
            background: "var(--bg-elevated)",
            border: `1px solid rgba(255,255,255,0.07)`,
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{error}</p>
        </div>
      )}

      {/* Content */}
      {caseStudy && (
        <>
          {/* Before/After comparison */}
          <div style={{ marginBottom: "2rem" }}>
            <BeforeAfterComparison
              before={caseStudy.before}
              after={caseStudy.after}
              deltas={caseStudy.deltas}
            />
          </div>

          {/* Outcome notes */}
          {caseStudy.outcome_notes && (
            <div
              style={{
                marginBottom: "1.5rem",
                borderRadius: "0.5rem",
                background: "var(--bg-elevated)",
                border: `1px solid rgba(255,255,255,0.07)`,
                padding: "1rem",
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                Outcome Notes
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                {caseStudy.outcome_notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: `1px solid rgba(255,255,255,0.07)`, paddingTop: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <SnapshotCapture
                businessId={businessId}
                phase="before"
                onCaptured={handleSnapshotCaptured}
              />
              <SnapshotCapture
                businessId={businessId}
                phase="after"
                onCaptured={handleSnapshotCaptured}
              />
            </div>
            <div style={{ display: "flex" }}>
              <ExportButton
                businessId={businessId}
                onSuccess={() => {
                  /* Optional: refresh or show success */
                }}
              />
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
