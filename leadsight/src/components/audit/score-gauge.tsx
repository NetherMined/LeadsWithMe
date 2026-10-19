"use client";

import type { DigitalPresenceScore } from "@/types/score";
import { useEffect, useState } from "react";

interface CompetitorAverages {
  total?: number;
  website?: number;
  social?: number;
  engagement?: number;
  advertising?: number;
  reviews?: number;
}

interface ScoreGaugeProps {
  score?: DigitalPresenceScore | null;
  size?: "sm" | "md" | "lg";
  competitorAverages?: CompetitorAverages | null;
}

function SubScoreBar({
  label,
  value,
  competitorValue,
}: {
  label: string;
  value: number;
  competitorValue?: number;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "var(--amber)" : "#ef4444";
  const gap = competitorValue !== undefined ? value - competitorValue : null;

  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-primary font-mono font-medium">
          {value}
          {gap !== null && (
            <span style={{ marginLeft: 6, color: gap >= 0 ? "#22c55e" : "#ef4444", fontSize: 10 }}>
              {gap >= 0 ? "+" : ""}{Math.round(gap)}
            </span>
          )}
        </span>
      </div>
      <div className="h-[5px] rounded-[3px] bg-border relative">
        <div className="h-[5px] rounded-[3px] transition-[width] duration-700 ease-out" style={{ background: color, width: `${pct}%` }} />
        {competitorValue !== undefined && (
          <div
            style={{
              position: "absolute",
              left: `${Math.min(100, competitorValue)}%`,
              top: -2,
              width: 2,
              height: 9,
              background: "#94a3b8",
              borderRadius: 1,
            }}
            title={`Competitor avg: ${Math.round(competitorValue)}`}
          />
        )}
      </div>
    </div>
  );
}

export function ScoreGauge({ score, size = "md", competitorAverages }: ScoreGaugeProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!score) {
    return (
      <div style={{ borderRadius: 12, border: "1px dashed var(--border)", padding: "32px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        No score yet — run a full audit first.
      </div>
    );
  }

  const ringColor =
    score.grade === "A" || score.grade === "B" ? "#22c55e" :
    score.grade === "C" ? "#eab308" :
    score.grade === "D" ? "#f97316" : "#ef4444";

  const gradeColor = ringColor;

  const radius = size === "lg" ? 80 : size === "sm" ? 40 : 60;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = size === "lg" ? 12 : 8;
  const svgSize = (radius + strokeWidth) * 2;
  const dashOffset = animated
    ? circumference - (score.total_score / 100) * circumference
    : circumference;

  const totalGap = competitorAverages?.total !== undefined
    ? score.total_score - competitorAverages.total
    : null;

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", width: svgSize, height: svgSize }}>
          <svg width={svgSize} height={svgSize} style={{ transform: "rotate(-90deg)", display: "block" }}>
            <circle cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
            <circle
              cx={svgSize / 2} cy={svgSize / 2} r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: size === "lg" ? 40 : 28, fontWeight: 700, color: gradeColor, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              {score.total_score}
            </span>
            <span style={{ fontSize: size === "lg" ? 22 : 16, fontWeight: 700, color: gradeColor, lineHeight: 1, fontFamily: "var(--font-display)" }}>
              {score.grade}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, textAlign: "center" }}>
          {score.label}
          {totalGap !== null && (
            <span style={{ display: "block", fontSize: 11, marginTop: 2, color: totalGap >= 0 ? "#22c55e" : "#ef4444" }}>
              {totalGap >= 0 ? "+" : ""}{Math.round(totalGap)} vs local avg
            </span>
          )}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: 0 }}>
          Score Breakdown {competitorAverages ? "(vs local avg)" : ""}
        </p>
        <SubScoreBar label="Website (30%)" value={score.website_score} competitorValue={competitorAverages?.website} />
        <SubScoreBar label="Social Presence (25%)" value={score.social_score} competitorValue={competitorAverages?.social} />
        <SubScoreBar label="Engagement (20%)" value={score.engagement_score} competitorValue={competitorAverages?.engagement} />
        <SubScoreBar label="Advertising (15%)" value={score.advertising_score} competitorValue={competitorAverages?.advertising} />
        <SubScoreBar label="Reviews (10%)" value={score.reviews_score} competitorValue={competitorAverages?.reviews} />
      </div>

      {competitorAverages && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>
          Grey markers show local competitor averages. Green/red deltas show your gap.
        </p>
      )}
    </div>
  );
}
