"use client";
/**
 * components/ProposalActions.tsx
 *
 * Two actions for a no-website lead:
 *   - "Download Proposal (.md)" -> POST /api/audit/website-proposal
 *   - "Generate Demo Site"      -> POST /api/proposal/demo
 *
 * After demo generation, only the .md proposal is offered for download.
 * The HTML build progress is shown via animated step indicators.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getStorageMode } from "@/lib/storage-preference";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const BUILD_STEPS = [
  "Analyzing business data…",
  "Generating content with AI…",
  "Building HTML structure…",
  "Applying design & styles…",
  "Finalizing demo site…",
];

function BuildProgress({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!active) return;

    // Advance through steps at irregular intervals to feel organic
    const delays = [2200, 4500, 3800, 5000, 4000];
    const total = delays.reduce((a, b) => a + b, 0);
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((d, i) => {
      elapsed += d;
      timers.push(setTimeout(() => {
        setStep(Math.min(i + 1, BUILD_STEPS.length - 1));
      }, elapsed));
    });

    // Reset and start smooth progress bar on first animation frame (async, not synchronous setState)
    let rafId: number;
    let startTime: number | null = null;
    function tick(now: number) {
      if (startTime === null) {
        startTime = now;
        setStep(0);
        setPct(0);
      }
      const p = Math.min(((now - startTime) / total) * 92, 92);
      setPct(p);
      if (p < 92) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(rafId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="space-y-2 py-1">
      {/* Progress bar */}
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--bg-elevated, #1e293b)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent, #6366f1), #a78bfa)",
            transition: "width 0.4s ease-out",
          }}
        />
      </div>
      {/* Current step label */}
      <p className="text-xs" style={{ color: "var(--text-muted, #94a3b8)" }}>
        {BUILD_STEPS[step]}
      </p>
      {/* Step dots */}
      <div className="flex gap-1.5 items-center">
        {BUILD_STEPS.map((_, i) => (
          <span
            key={i}
            className="inline-block rounded-full transition-all duration-300"
            style={{
              width: i === step ? 16 : 6,
              height: 6,
              background: i <= step ? "var(--accent, #6366f1)" : "var(--bg-elevated, #1e293b)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ProposalActions({ businessId }: { businessId: string }) {
  const [busy, setBusy] = useState<null | "md" | "demo">(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState(false);
  const [demoReady, setDemoReady] = useState(false);
  const [demoHtml, setDemoHtml] = useState<string | null>(null);
  const [demoScreenshots, setDemoScreenshots] = useState<{
    desktop: string | null;
    mobile: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveProposal() {
    setBusy("md");
    setError(null);
    setDriveUrl(null);
    setLocalSaved(false);
    try {
      // 1. Generate markdown
      const genRes = await fetch("/api/audit/website-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (!genRes.ok) throw new Error("Proposal generation failed");
      const { markdown, filename } = await genRes.json() as { markdown: string; filename: string };

      if (getStorageMode() === "local") {
        // Download .md to device
        downloadBlob(markdown, filename, "text/markdown");
        setLocalSaved(true);
      } else {
        // Upload to Google Drive → LeadSight/{Business}/
        const driveRes = await fetch("/api/export/proposal-drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: businessId, markdown, filename }),
        });
        if (!driveRes.ok) {
          const err = await driveRes.json() as { error?: string };
          throw new Error(err.error ?? "Drive upload failed");
        }
        const { url } = await driveRes.json() as { url: string };
        setDriveUrl(url);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg.includes("not connected") || msg.includes("No Google")
          ? "Google Drive not connected — reconnect in Account Settings."
          : msg
      );
    } finally {
      setBusy(null);
    }
  }

  async function generateDemo() {
    setBusy("demo");
    setError(null);
    try {
      const res = await fetch("/api/proposal/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, screenshots: true }),
      });
      if (!res.ok) throw new Error("Demo generation failed");
      const data = await res.json() as { html: string; screenshots: { desktop: string | null; mobile: string | null } };
      setDemoHtml(data.html);
      setDemoScreenshots(data.screenshots);
      setDemoReady(true);
      // Auto-download HTML when in local mode
      if (getStorageMode() === "local") {
        downloadBlob(data.html, `demo-site-${businessId}.html`, "text/html");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isLocal = getStorageMode() === "local";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSaveProposal} disabled={busy !== null}>
          {busy === "md"
            ? (isLocal ? "Downloading…" : "Saving to Drive…")
            : (isLocal ? "Download Proposal (.md)" : "Save Proposal to Drive")}
        </Button>
        <Button onClick={generateDemo} disabled={busy !== null} variant="secondary">
          {busy === "demo" ? "Building…" : "Generate Demo Site"}
        </Button>
      </div>

      {/* HTML build progress */}
      <BuildProgress active={busy === "demo"} />

      {error && (
        <p className="text-sm" style={{ color: "var(--destructive, #ef4444)" }}>
          {error}
          {error.includes("Account Settings") && (
            <>
              {" "}
              <a href="/account" style={{ color: "var(--destructive, #ef4444)", textDecoration: "underline" }}>
                Go to Account Settings
              </a>
            </>
          )}
        </p>
      )}

      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--accent)" }}
        >
          <span>↗</span> Open proposal in Drive
        </a>
      )}

      {localSaved && (
        <p className="text-sm" style={{ color: "var(--accent)" }}>
          ✓ Proposal downloaded
        </p>
      )}

      {demoReady && (
        <div
          className="rounded-lg p-3 space-y-3"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Demo ready
            </span>
            <div className="flex gap-2">
              {isLocal && demoHtml && (
                <button
                  onClick={() => downloadBlob(demoHtml, `demo-site-${businessId}.html`, "text/html")}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent", cursor: "pointer" }}
                >
                  ↓ .html
                </button>
              )}
              <button
                onClick={handleSaveProposal}
                disabled={busy !== null}
                className="text-xs px-2 py-1 rounded"
                style={{
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  background: "transparent",
                  cursor: busy !== null ? "not-allowed" : "pointer",
                  opacity: busy !== null ? 0.5 : 1,
                }}
              >
                {isLocal ? "↓ .md" : "Save proposal to Drive"}
              </button>
            </div>
          </div>
          {(demoScreenshots?.desktop || demoScreenshots?.mobile) && (
            <div className="grid grid-cols-2 gap-3">
              {demoScreenshots.desktop && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={demoScreenshots.desktop}
                  alt="Desktop demo preview"
                  className="w-full rounded border"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
              {demoScreenshots.mobile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={demoScreenshots.mobile}
                  alt="Mobile demo preview"
                  className="w-full rounded border"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
