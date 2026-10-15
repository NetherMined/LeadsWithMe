"use client";

import { useState } from "react";

interface EmailResult {
  email: string;
  source: string;
  confidence: "high" | "medium" | "low";
}

interface EmailEnricherProps {
  businessId: string;
  existingEmails: string[];
}

const CONFIDENCE_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  high:   { label: "verified",  bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  medium: { label: "likely",    bg: "rgba(245,158,11,0.12)",  color: "var(--amber)" },
  low:    { label: "possible",  bg: "rgba(255,255,255,0.05)", color: "var(--text-muted)" },
};

const SOURCE_LABELS: Record<string, string> = {
  "website:homepage": "Homepage",
  "website:/contact": "Contact page",
  "website:/contact-us": "Contact page",
  "website:/about": "About page",
  "website:/about-us": "About page",
  "website:/team": "Team page",
  "website:/staff": "Staff page",
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
};

function formatSource(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  if (source.startsWith("website:")) {
    return source.replace("website:", "").replace(/^\//, "");
  }
  return source;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy email"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        borderRadius: 4,
        color: copied ? "#22c55e" : "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        transition: "color 150ms",
        flexShrink: 0,
      }}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

function CopyAllButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const text = emails.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copyAll}
      style={{
        fontSize: 10,
        color: copied ? "#22c55e" : "var(--text-muted)",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "color 150ms",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      {copied ? "Copied!" : "Copy all"}
    </button>
  );
}

export function EmailEnricher({ businessId, existingEmails }: EmailEnricherProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  const allEmails = [...new Set([
    ...existingEmails,
    ...results.map(r => r.email),
  ])];

  async function run() {
    setStatus("running");
    setResults([]);
    setMessage("");

    const steps = [
      "Crawling homepage…",
      "Scanning contact & about pages…",
      "Probing social profiles…",
      "Deduplicating results…",
    ];
    let stepIdx = 0;
    setProgress(steps[0]);

    const ticker = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setProgress(steps[stepIdx]);
    }, 3500);

    try {
      const res = await fetch("/api/enrich/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });

      clearInterval(ticker);
      const data = await res.json() as {
        emails?: EmailResult[];
        total?: number;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setMessage(data.error ?? "Enrichment failed");
        setStatus("error");
        return;
      }

      setResults(data.emails ?? []);
      setMessage(data.message ?? "");
      setStatus("done");
    } catch {
      clearInterval(ticker);
      setMessage("Network error");
      setStatus("error");
    } finally {
      setProgress("");
    }
  }

  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--bg-surface)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: status !== "idle" ? "1px solid var(--border)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-sans)" }}>
              Email Extractor
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              Deep-crawls website + social platforms
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status === "running" && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", animation: "pulse 1.5s ease-in-out infinite" }}>
              {progress}
            </span>
          )}
          <button
            type="button"
            onClick={run}
            disabled={status === "running"}
            style={{
              borderRadius: 8,
              background: status === "running" ? "var(--accent-dim)" : "var(--accent-dim)",
              border: "1px solid var(--accent-glow)",
              color: "var(--accent)",
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: status === "running" ? "not-allowed" : "pointer",
              opacity: status === "running" ? 0.6 : 1,
              fontFamily: "var(--font-sans)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "opacity 150ms",
            }}
          >
            {status === "running" ? (
              <>
                <Spinner />
                Scanning…
              </>
            ) : status === "done" ? (
              "Re-scan"
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Extract Emails
              </>
            )}
          </button>
        </div>
      </div>

      {/* Existing emails (shown before scan if present) */}
      {status === "idle" && existingEmails.filter(e => !/\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff|css|js|json|xml|html?|woff2?|ttf|eot|pdf|zip|php)$/i.test(e)).length > 0 && (
        <div style={{ padding: "12px 18px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
            Known Emails
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {existingEmails.filter(e => !/\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff|css|js|json|xml|html?|woff2?|ttf|eot|pdf|zip|php)$/i.test(e)).map(email => (
              <div key={email} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <a href={`mailto:${email}`} style={{ fontSize: 13, color: "var(--accent)", fontFamily: "var(--font-mono)", textDecoration: "none", flex: 1 }}>
                  {email}
                </a>
                <CopyButton text={email} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && message && (
        <div style={{ padding: "12px 18px" }}>
          <p style={{ fontSize: 12, color: "#ef4444", fontFamily: "var(--font-mono)" }}>{message}</p>
        </div>
      )}

      {/* Results */}
      {status === "done" && (
        <div style={{ padding: "14px 18px" }}>
          {results.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
              No emails found on website or social profiles.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: 0 }}>
                  {results.length} email{results.length !== 1 ? "s" : ""} found
                </p>
                <CopyAllButton emails={allEmails} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.map((r, i) => {
                  const style = CONFIDENCE_STYLE[r.confidence];
                  return (
                    <div
                      key={`${r.email}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg-deep)",
                        padding: "8px 12px",
                      }}
                    >
                      {/* Email */}
                      <a
                        href={`mailto:${r.email}`}
                        style={{
                          fontSize: 13,
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                          textDecoration: "none",
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.email}
                      </a>

                      {/* Source badge */}
                      <span style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}>
                        {formatSource(r.source)}
                      </span>

                      {/* Confidence badge */}
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: style.color,
                        background: style.bg,
                        borderRadius: 4,
                        padding: "2px 6px",
                        flexShrink: 0,
                        fontFamily: "var(--font-mono)",
                      }}>
                        {style.label}
                      </span>

                      {/* Copy */}
                      <CopyButton text={r.email} />
                    </div>
                  );
                })}
              </div>

              {/* Quick actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <a
                  href={`mailto:${allEmails[0]}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--accent-glow)",
                    borderRadius: 6,
                    padding: "5px 12px",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Send Email
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const csv = allEmails.join(",");
                    navigator.clipboard.writeText(csv).catch(() => {});
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "5px 12px",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Copy as CSV
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
