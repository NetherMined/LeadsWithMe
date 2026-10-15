"use client";

import type { CaseStudyData } from "@/types/proof";

interface BeforeAfterComparisonProps {
  before: CaseStudyData["before"];
  after: CaseStudyData["after"];
  deltas: CaseStudyData["deltas"];
}

function ScoreMetricCard({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div
        style={{
          borderRadius: "0.5rem",
          border: `1px solid rgba(255,255,255,0.07)`,
          background: "var(--bg-elevated)",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            fontWeight: "600",
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}
        >
          {label}
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>—</p>
      </div>
    );
  }

  const bgColor =
    value >= 80
      ? "var(--accent-green)"
      : value >= 50
        ? "var(--accent-orange)"
        : "var(--accent)";

  return (
    <div
      style={{
        borderRadius: "0.5rem",
        border: `1px solid rgba(255,255,255,0.07)`,
        background: bgColor,
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          fontWeight: "600",
          color: "var(--text-primary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "1.875rem", fontWeight: "700", color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  const bgColor = isPositive ? "var(--accent-green)" : "var(--accent)";
  const sign = isPositive ? "+" : "";

  return (
    <div
      style={{
        borderRadius: "0.5rem",
        border: `1px solid rgba(255,255,255,0.07)`,
        background: bgColor,
        padding: "0.25rem 0.75rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-primary)" }}>
        {sign}
        {value.toFixed(0)}
      </p>
    </div>
  );
}

function SnapshotPlaceholder() {
  return (
    <div
      style={{
        borderRadius: "0.5rem",
        border: `2px dashed rgba(255,255,255,0.07)`,
        background: "var(--bg-elevated)",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        No snapshot captured yet
      </p>
    </div>
  );
}

export function BeforeAfterComparison({
  before,
  after,
  deltas,
}: BeforeAfterComparisonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Metrics grid: Before | Deltas | After */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Before column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "var(--text-primary)" }}>
            Before
          </h3>
          {before ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <ScoreMetricCard
                label="PageSpeed Mobile"
                value={before.pagespeed_mobile}
              />
              <ScoreMetricCard
                label="PageSpeed Desktop"
                value={before.pagespeed_desktop}
              />
              <ScoreMetricCard label="SEO Score" value={before.seo_score} />
              <ScoreMetricCard
                label="Accessibility Score"
                value={before.accessibility_score}
              />
              {before.notes && (
                <div
                  style={{
                    borderRadius: "0.5rem",
                    background: "var(--bg-elevated)",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {before.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <SnapshotPlaceholder />
          )}
        </div>

        {/* Deltas column */}
        {deltas && before && after && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3
              style={{ fontSize: "1.125rem", fontWeight: "600", color: "var(--text-primary)" }}
            >
              Change
            </h3>
            <DeltaBadge value={deltas.pagespeed_mobile_delta} />
            <DeltaBadge value={deltas.pagespeed_desktop_delta} />
            <DeltaBadge value={deltas.seo_score_delta} />
            <DeltaBadge value={deltas.accessibility_score_delta} />
          </div>
        )}

        {/* After column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "var(--text-primary)" }}>
            After
          </h3>
          {after ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <ScoreMetricCard label="PageSpeed Mobile" value={after.pagespeed_mobile} />
              <ScoreMetricCard label="PageSpeed Desktop" value={after.pagespeed_desktop} />
              <ScoreMetricCard label="SEO Score" value={after.seo_score} />
              <ScoreMetricCard
                label="Accessibility Score"
                value={after.accessibility_score}
              />
              {after.notes && (
                <div
                  style={{
                    borderRadius: "0.5rem",
                    background: "var(--bg-elevated)",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {after.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <SnapshotPlaceholder />
          )}
        </div>
      </div>

      {/* Empty state message */}
      {!before && !after && (
        <div
          style={{
            borderRadius: "0.5rem",
            border: `1px dashed rgba(255,255,255,0.07)`,
            background: "var(--bg-elevated)",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            No snapshots yet. Capture before/after metrics to see the comparison.
          </p>
        </div>
      )}
    </div>
  );
}
