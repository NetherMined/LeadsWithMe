"use client";

import { useState, useEffect } from "react";
import type { OutreachAssets, IdentifiedIssue } from "@/types/outreach";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OutreachAssetPanelProps {
  businessId: string;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error("Failed to copy:", err);
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function calculateReadTime(text: string): number {
  const words = countWords(text);
  return Math.ceil(words / 200);
}

function SeverityBadge({ severity }: { severity: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (severity === "critical") {
    variant = "destructive";
  } else if (severity === "high") {
    variant = "default";
  }

  return (
    <Badge variant={variant} className="capitalize">
      {severity}
    </Badge>
  );
}

export function OutreachAssetPanel({ businessId }: OutreachAssetPanelProps) {
  const [assets, setAssets] = useState<OutreachAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [flatFee, setFlatFee] = useState(350);
  const [deliveryDays, setDeliveryDays] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Fetch existing outreach assets
  useEffect(() => {
    async function fetchAssets() {
      try {
        setLoading(true);
        const res = await fetch(`/api/outreach/status?business_id=${businessId}`);
        const data = await res.json();

        if (res.ok && data.assets) {
          // Parse loom_script if it's a string
          const parsedAssets = {
            ...data.assets,
            loom_script: typeof data.assets.loom_script === "string" ? JSON.parse(data.assets.loom_script) : data.assets.loom_script,
          };
          setAssets(parsedAssets);
          if (parsedAssets.flat_fee_currency) {
            setCurrency(parsedAssets.flat_fee_currency);
          }
          if (parsedAssets.flat_fee_amount) {
            setFlatFee(parsedAssets.flat_fee_amount);
          }
          if (parsedAssets.delivery_days) {
            setDeliveryDays(parsedAssets.delivery_days);
          }
        } else if (data.error === "no_audit_data") {
          setError("audit_required");
        } else {
          setError(null);
        }
      } catch (err) {
        console.error("Failed to fetch assets:", err);
        setError(null);
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [businessId]);

  const handleCopy = (text: string, field: string) => {
    copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          target_currency: currency,
          flat_fee: flatFee,
          delivery_days: deliveryDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "no_audit_data") {
          setError("audit_required");
        } else {
          setError(data.error || "Generation failed");
        }
        return;
      }

      // Parse loom_script if it's a string
      const parsedAssets = {
        ...data,
        loom_script: typeof data.loom_script === "string" ? JSON.parse(data.loom_script) : data.loom_script,
      };
      setAssets(parsedAssets);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const updatePipelineStatus = async (status: string) => {
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/outreach/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId, status, channel: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setPipelineStatus(status);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMarkContacted = () => updatePipelineStatus("contacted");
  const handleMarkReplied = () => updatePipelineStatus("replied");
  const handleMarkWon = () => updatePipelineStatus("won");

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
        Loading outreach assets...
      </div>
    );
  }

  if (error === "audit_required") {
    return (
      <div style={{
        padding: 24,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        textAlign: "center",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          Run Audit First
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
          Website and social audits are required to generate outreach assets
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Run Audit
        </Button>
      </div>
    );
  }

  if (error && error !== "audit_required") {
    return (
      <div style={{
        padding: 24,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        textAlign: "center",
        color: "var(--text-secondary)",
      }}>
        Error: {error}
      </div>
    );
  }

  if (!assets) {
    return (
      <div style={{
        padding: 24,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            Generate Outreach Assets
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            Configure fee parameters to generate AI-powered outreach content
          </p>

          {/* Fee calculator */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Currency
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                disabled={isGenerating}
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              >
                {["GBP", "USD", "AUD", "EUR", "ZAR"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Fee
              </label>
              <input
                type="number"
                value={flatFee}
                onChange={e => setFlatFee(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={isGenerating}
                min="0"
                step="50"
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Days
              </label>
              <input
                type="number"
                value={deliveryDays}
                onChange={e => setDeliveryDays(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isGenerating}
                min="1"
                max="30"
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              background: "var(--accent)",
              border: "none",
              borderRadius: 6,
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? "Generating..." : "Regenerate"}
          </button>
        </div>
      </div>
    );
  }

  // Render assets if they exist
  const topIssues = assets.identified_issues
    ? [...assets.identified_issues]
        .sort((a: IdentifiedIssue, b: IdentifiedIssue) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
        })
        .slice(0, 3)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Ranked issues */}
      {topIssues.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            Top Issues
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topIssues.map((issue: IdentifiedIssue, idx: number) => (
              <div key={idx} style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{issue.type}</h4>
                  <SeverityBadge severity={issue.severity} />
                </div>
                <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>{issue.description}</p>
                <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  Fix: {issue.fix_estimate}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loom script */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          Loom Script (85 seconds)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Hook", duration: "10s", content: assets.loom_script.hook },
            { label: "Problem 1", duration: "25s", content: assets.loom_script.problem_1 },
            { label: "Problem 2", duration: "25s", content: assets.loom_script.problem_2 },
            { label: "Close", duration: "25s", content: assets.loom_script.close },
          ].map((section, idx) => (
            <div key={idx} style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                    {section.label}
                  </h4>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    {section.duration} • {countWords(section.content)} words
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(section.content, `loom-${idx}`)}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: copiedField === `loom-${idx}` ? "var(--accent)" : "transparent",
                    color: copiedField === `loom-${idx}` ? "#fff" : "var(--accent)",
                    border: `1px solid var(--accent)`,
                    cursor: "pointer",
                  }}
                >
                  {copiedField === `loom-${idx}` ? "✓" : "Copy"}
                </button>
              </div>
              <p style={{
                fontSize: 10,
                lineHeight: 1.5,
                color: "var(--text-secondary)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}>
                {section.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Email preview */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          Email
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Subject
              </label>
              <button
                onClick={() => handleCopy(assets.email_subject, "email-subject")}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: copiedField === "email-subject" ? "var(--accent)" : "transparent",
                  color: copiedField === "email-subject" ? "#fff" : "var(--accent)",
                  border: `1px solid var(--accent)`,
                  cursor: "pointer",
                }}
              >
                {copiedField === "email-subject" ? "✓" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-primary)", margin: 0 }}>
              {assets.email_subject}
            </p>
          </div>

          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Body ({calculateReadTime(assets.email_body)} min read)
              </label>
              <button
                onClick={() => handleCopy(assets.email_body, "email-body")}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: copiedField === "email-body" ? "var(--accent)" : "transparent",
                  color: copiedField === "email-body" ? "#fff" : "var(--accent)",
                  border: `1px solid var(--accent)`,
                  cursor: "pointer",
                }}
              >
                {copiedField === "email-body" ? "✓" : "Copy"}
              </button>
            </div>
            <p style={{
              fontSize: 10,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              margin: 0,
              whiteSpace: "pre-wrap",
              maxHeight: 200,
              overflow: "auto",
            }}>
              {assets.email_body}
            </p>
          </div>
        </div>
      </div>

      {/* LinkedIn */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          LinkedIn
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Connect Note ({assets.linkedin_connect_note.length}/300)
              </label>
              <button
                onClick={() => handleCopy(assets.linkedin_connect_note, "linkedin-note")}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: copiedField === "linkedin-note" ? "var(--accent)" : "transparent",
                  color: copiedField === "linkedin-note" ? "#fff" : "var(--accent)",
                  border: `1px solid var(--accent)`,
                  cursor: "pointer",
                }}
              >
                {copiedField === "linkedin-note" ? "✓" : "Copy"}
              </button>
            </div>
            <p style={{
              fontSize: 10,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              margin: 0,
              whiteSpace: "pre-wrap",
              maxHeight: 150,
              overflow: "auto",
            }}>
              {assets.linkedin_connect_note}
            </p>
            {assets.linkedin_connect_note.length > 300 && (
              <p style={{ fontSize: 9, color: "var(--destructive)", marginTop: 6 }}>
                Note exceeds 300 character LinkedIn limit
              </p>
            )}
          </div>

          <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Follow-up
              </label>
              <button
                onClick={() => handleCopy(assets.linkedin_followup, "linkedin-followup")}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: copiedField === "linkedin-followup" ? "var(--accent)" : "transparent",
                  color: copiedField === "linkedin-followup" ? "#fff" : "var(--accent)",
                  border: `1px solid var(--accent)`,
                  cursor: "pointer",
                }}
              >
                {copiedField === "linkedin-followup" ? "✓" : "Copy"}
              </button>
            </div>
            <p style={{
              fontSize: 10,
              lineHeight: 1.5,
              color: "var(--text-secondary)",
              margin: 0,
              whiteSpace: "pre-wrap",
              maxHeight: 150,
              overflow: "auto",
            }}>
              {assets.linkedin_followup}
            </p>
          </div>
        </div>
      </div>

      {/* Fee & timeline */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          Fee & Timeline
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Currency
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              disabled={isGenerating}
              style={{
                fontSize: 12,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            >
              {["GBP", "USD", "AUD", "EUR", "ZAR"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Fee
            </label>
            <input
              type="number"
              value={flatFee}
              onChange={e => setFlatFee(Math.max(0, parseInt(e.target.value) || 0))}
              disabled={isGenerating}
              min="0"
              step="50"
              style={{
                fontSize: 12,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Days
            </label>
            <input
              type="number"
              value={deliveryDays}
              onChange={e => setDeliveryDays(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isGenerating}
              min="1"
              max="30"
              style={{
                fontSize: 12,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            background: "var(--accent)",
            border: "none",
            borderRadius: 6,
            cursor: isGenerating ? "not-allowed" : "pointer",
            opacity: isGenerating ? 0.6 : 1,
          }}
        >
          {isGenerating ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {/* Quick status buttons */}
      {statusError && (
        <p style={{ fontSize: 11, color: "var(--destructive)", margin: 0 }}>{statusError}</p>
      )}
      {pipelineStatus && (
        <p style={{ fontSize: 11, color: "var(--accent-green)", margin: 0 }}>
          ✓ Marked as {pipelineStatus}
        </p>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 8,
      }}>
        {(["contacted", "replied", "won"] as const).map((status) => (
          <button
            key={status}
            onClick={() => updatePipelineStatus(status)}
            disabled={isUpdatingStatus}
            style={{
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: pipelineStatus === status ? "#fff" : "var(--accent)",
              background: pipelineStatus === status ? "var(--accent)" : "var(--accent-dim)",
              border: "1px solid var(--accent-glow)",
              borderRadius: 6,
              cursor: isUpdatingStatus ? "not-allowed" : "pointer",
              opacity: isUpdatingStatus ? 0.6 : 1,
              transition: "all 150ms",
            }}
          >
            {isUpdatingStatus ? "Saving…" : `Mark ${status.charAt(0).toUpperCase() + status.slice(1)}`}
          </button>
        ))}
      </div>
    </div>
  );
}
