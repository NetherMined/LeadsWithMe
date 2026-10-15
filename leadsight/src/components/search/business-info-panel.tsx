"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/types/business";
import type { DigitalPresenceScore } from "@/types/score";

interface BusinessInfoPanelProps {
  business: Business | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BusinessInfoPanel({
  business,
  isOpen,
  onClose,
}: BusinessInfoPanelProps) {
  const [hoursOpen, setHoursOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [score, setScore] = useState<DigitalPresenceScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [demoMd, setDemoMd] = useState<string | null>(null);
  const [demoHtml, setDemoHtml] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState<"md" | "html" | null>(null);

  useEffect(() => {
    if (!business) {
      setScore(null);
      setDemoMd(null);
      setDemoHtml(null);
      return;
    }

    const supabase = createClient();

    const fetchScore = async () => {
      setScoreLoading(true);
      setScore(null);
      const { data } = await supabase
        .from("scores")
        .select("*")
        .eq("business_id", business.id)
        .maybeSingle();
      setScore(data);
      setScoreLoading(false);
    };

    const fetchDemo = async () => {
      setDemoMd(null);
      setDemoHtml(null);
      const { data } = await supabase
        .from("proposal_demos")
        .select("html, proposal_md")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setDemoMd((data as { proposal_md: string | null }).proposal_md);
        setDemoHtml((data as { html: string | null }).html);
      }
    };

    fetchScore();
    fetchDemo();
  }, [business]);

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadMd() {
    if (!business) return;
    setDlBusy("md");
    try {
      let md = demoMd;
      if (!md) {
        const res = await fetch("/api/audit/website-proposal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: business.id }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json() as { markdown: string; filename: string };
        md = data.markdown;
        setDemoMd(md);
      }
      const safeName = business.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      downloadBlob(md, `${safeName}-proposal.md`, "text/markdown");
    } catch { /* silent */ } finally {
      setDlBusy(null);
    }
  }

  function handleDownloadHtml() {
    if (!business || !demoHtml) return;
    setDlBusy("html");
    const safeName = business.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadBlob(demoHtml, `${safeName}-demo.html`, "text/html");
    setDlBusy(null);
  }

  const handleAudit = async () => {
    if (!business) return;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(business.id)) {
      console.error("Audit skipped: business has not been saved to the database yet (id is not a UUID).");
      return;
    }

    try {
      const auditCalls: Promise<Response>[] = [
        // Skip website audit if business has no website
        ...(business.website ? [
          fetch("/api/audit/website", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ business_id: business.id }),
          }),
        ] : []),
        fetch("/api/audit/social", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: business.id }),
        }),
        fetch("/api/audit/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: business.id }),
        }),
      ];
      await Promise.all(auditCalls).then(async (responses) => {
        const failed = responses.filter((r) => !r.ok);
        if (failed.length > 0) {
          const errors = await Promise.all(
            failed.map(async (r) => {
              try {
                const body = await r.json();
                return body.error ?? r.statusText;
              } catch {
                return r.statusText;
              }
            })
          );
          console.error("Audit failed:", errors);
        }
      });
    } catch (error) {
      console.error("Audit error:", error);
    }
  };

  const handleExport = async () => {
    if (!business) return;

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: business.id }),
      });

      if (!response.ok) {
        console.error("Export failed:", response.statusText);
      }
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const getCurrentDayIndex = () => {
    return new Date().getDay();
  };

  const getDayName = (index: number) => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[index];
  };

  const formatMapUrl = () => {
    if (business?.google_maps_url) {
      return business.google_maps_url;
    }
    return `https://maps.google.com/?q=${encodeURIComponent(business?.address || "")}`;
  };

  const getWhatsAppUrl = (whatsapp: string) => {
    const digitsOnly = whatsapp.replace(/\D/g, "");
    return `https://wa.me/${digitsOnly}`;
  };

  if (!business) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: 420,
        maxWidth: 420,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        zIndex: 1120,
        transform: isOpen && business ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 250ms ease",
        pointerEvents: isOpen && business ? "auto" : "none",
        boxShadow: "4px 0 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div style={{ position: "relative", borderBottom: "1px solid var(--border)" }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: 4,
            borderRadius: 6,
            lineHeight: 1,
            fontSize: 20,
            zIndex: 10,
          }}
        >
          ✕
        </button>

        {/* Photo area */}
        <div
          style={{
            width: "100%",
            height: 160,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-input))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {business.photo_primary ? (
            <img
              src={business.photo_primary}
              alt={business.name}
              style={{
                objectFit: "cover",
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth={2}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          )}
        </div>

        {/* Business name */}
        <div style={{ padding: "16px 16px 12px 16px" }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              margin: 0,
            }}
          >
            {business.name}
          </h2>

          {/* Rating row */}
          {business.rating !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                fontSize: 14,
              }}
            >
              <span style={{ color: "var(--amber)" }}>★</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {business.rating.toFixed(1)}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                ({business.review_count} reviews)
              </span>
            </div>
          )}

          {/* Category badge */}
          {business.category && (
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "4px 12px",
                background: "var(--accent-dim)",
                color: "var(--accent)",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {business.category}
            </div>
          )}
        </div>
      </div>

      {/* Status row */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {business.is_open_now !== null && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 12px",
              borderRadius: 16,
              fontSize: 13,
              fontWeight: 600,
              background:
                business.is_open_now === true
                  ? "rgba(52, 211, 153, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
              color:
                business.is_open_now === true
                  ? "var(--accent)"
                  : "var(--destructive)",
            }}
          >
            {business.is_open_now === true ? "Open" : "Closed"}
          </div>
        )}

        {business.current_status && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {business.current_status}
          </span>
        )}

        {business.is_claimed === true && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            ✓ Claimed
          </div>
        )}
      </div>

      {/* Contact row */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Address */}
        {business.address && (
          <a
            href={formatMapUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 10,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, marginTop: 2 }}>📍</span>
            <span
              style={{
                fontSize: 13,
                color: "var(--accent)",
                wordBreak: "break-word",
              }}
            >
              {business.address}
            </span>
          </a>
        )}

        {/* Phone */}
        {business.phone && (
          <a
            href={`tel:${business.phone}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16 }}>☎</span>
            <span style={{ fontSize: 13, color: "var(--accent)" }}>
              {business.phone}
            </span>
          </a>
        )}

        {/* Website */}
        {business.website && (
          <a
            href={business.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16 }}>🌐</span>
            <span style={{ fontSize: 13, color: "var(--accent)" }}>
              Website
            </span>
          </a>
        )}
      </div>

      {/* Hours (collapsible) */}
      {business.hours && business.hours.length > 0 && (
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          {/* Toggle row */}
          <button
            onClick={() => setHoursOpen(!hoursOpen)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Hours
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              style={{
                transition: "transform 200ms ease",
                transform: hoursOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {/* Content */}
          {hoursOpen && (
            <div style={{ padding: "0 16px 12px 16px" }}>
              {business.hours.map((hour, index) => {
                const currentDay = getCurrentDayIndex();
                const dayName = getDayName(index);
                const isCurrentDay = index === currentDay;

                return (
                  <div
                    key={index}
                    style={{
                      fontSize: 13,
                      padding: "8px 0",
                      color: isCurrentDay
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                      fontWeight: isCurrentDay ? 600 : 400,
                    }}
                  >
                    {hour}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* More info (collapsible) */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        {/* Toggle row */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          More info
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            style={{
              transition: "transform 200ms ease",
              transform: moreOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {/* Content */}
        {moreOpen && (
          <div style={{ padding: "0 16px 12px 16px" }}>
            {/* Email */}
            {(business.email || (business.emails && business.emails.length > 0)) && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Email
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {business.email || business.emails?.[0]}
                </div>
              </div>
            )}

            {/* Mobile */}
            {business.mobile && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Mobile
                </div>
                <a
                  href={`tel:${business.mobile}`}
                  style={{
                    fontSize: 13,
                    color: "var(--accent)",
                    textDecoration: "none",
                  }}
                >
                  {business.mobile}
                </a>
              </div>
            )}

            {/* WhatsApp */}
            {business.whatsapp && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  WhatsApp
                </div>
                <a
                  href={getWhatsAppUrl(business.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13,
                    color: "var(--accent)",
                    textDecoration: "none",
                  }}
                >
                  {business.whatsapp}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit Score */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 12,
            margin: 0,
          }}
        >
          Digital Presence Score
        </h3>

        {scoreLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "var(--bg-elevated)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
            ))}
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
          </div>
        ) : score ? (
          <div>
            {/* Score header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                {Math.round(score.total_score)}
              </div>
              <div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {score.grade}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {score.label}
                </div>
              </div>
            </div>

            {/* Sub-scores */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Website */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>Website</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {Math.round(score.website_score)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--bg-elevated)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--accent)",
                      width: `${score.website_score}%`,
                      transition: "width 300ms ease",
                    }}
                  />
                </div>
              </div>

              {/* Social */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>Social</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {Math.round(score.social_score)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--bg-elevated)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--accent)",
                      width: `${score.social_score}%`,
                      transition: "width 300ms ease",
                    }}
                  />
                </div>
              </div>

              {/* Engagement */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Engagement
                  </span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {Math.round(score.engagement_score)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--bg-elevated)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--accent)",
                      width: `${score.engagement_score}%`,
                      transition: "width 300ms ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "12px",
              background: "var(--bg-elevated)",
              borderRadius: 6,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Not yet audited
          </div>
        )}
      </div>

      {/* Proposal downloads */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
          Downloads
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={handleDownloadMd}
            disabled={dlBusy !== null}
            style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              color: "var(--text-primary)", cursor: dlBusy === "md" ? "wait" : "pointer",
              opacity: dlBusy === "md" ? 0.6 : 1, fontFamily: "var(--font-mono)",
            }}
          >
            {dlBusy === "md" ? "…" : "↓ Proposal .md"}
          </button>
          {demoHtml && (
            <button
              onClick={handleDownloadHtml}
              disabled={dlBusy !== null}
              style={{
                padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: "1px solid var(--border)", background: "var(--bg-elevated)",
                color: "var(--text-primary)", cursor: dlBusy === "html" ? "wait" : "pointer",
                opacity: dlBusy === "html" ? 0.6 : 1, fontFamily: "var(--font-mono)",
              }}
            >
              ↓ Demo .html
            </button>
          )}
        </div>
      </div>

      {/* Action buttons (sticky bottom) */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          gap: 8,
        }}
      >
        {/* View Lead */}
        <button
          onClick={() => {
            window.location.href = `/leads/${business.id}`;
          }}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--accent)",
            color: "#0a0f18",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          View Lead
        </button>

        {/* Audit */}
        <button
          onClick={handleAudit}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Audit
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Export
        </button>
      </div>
    </div>
  );
}
