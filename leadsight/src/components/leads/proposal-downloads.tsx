"use client";

import { useState, useEffect, useRef } from "react";
import { getStorageMode, type StorageMode } from "@/lib/storage-preference";

interface Props {
  businessId: string;
  businessName: string;
  proposalMd: string | null;
  demoHtml: string | null;
  demoSiteUrl: string | null;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
};

export function ProposalDownloads({ businessId, businessName, proposalMd: initialProposalMd, demoHtml: initialDemoHtml, demoSiteUrl: initialDemoSiteUrl }: Props) {
  const [mode, setMode] = useState<StorageMode>("drive");
  const [busy, setBusy] = useState<"md" | "upload" | "url" | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cachedMd, setCachedMd] = useState<string | null>(initialProposalMd);
  const [cachedHtml, setCachedHtml] = useState<string | null>(initialDemoHtml);
  const [siteUrl, setSiteUrl] = useState<string>(initialDemoSiteUrl ?? "");
  const [savedUrl, setSavedUrl] = useState<string | null>(initialDemoSiteUrl);
  const [urlEditing, setUrlEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(getStorageMode());
  }, []);

  const safeName = businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  async function handleMd() {
    setBusy("md");
    setError(null);
    try {
      let md = cachedMd;
      if (!md) {
        const res = await fetch("/api/audit/website-proposal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: businessId }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? "Proposal generation failed");
        }
        const data = await res.json() as { markdown: string; filename: string };
        md = data.markdown;
        setCachedMd(md);
      }

      if (mode === "local") {
        downloadBlob(md, `${safeName}-proposal.md`, "text/markdown");
      } else {
        const driveRes = await fetch("/api/export/proposal-drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_id: businessId,
            markdown: md,
            filename: `${safeName}-proposal.md`,
          }),
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
          ? "Google Drive not connected — check Account Settings."
          : msg
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      const html = await file.text();
      const res = await fetch("/api/proposal/demo-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, html }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      setCachedHtml(html);
    } catch (err) {
      setError((err as Error).message ?? "Upload failed");
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveUrl() {
    const trimmed = siteUrl.trim();
    if (!trimmed) return;
    setBusy("url");
    setError(null);
    try {
      const res = await fetch("/api/proposal/demo-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, demoSiteUrl: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to save URL");
      }
      setSavedUrl(trimmed);
      setUrlEditing(false);
    } catch (err) {
      setError((err as Error).message ?? "Failed to save URL");
    } finally {
      setBusy(null);
    }
  }

  function handleViewSite() {
    if (cachedHtml) {
      const blob = new Blob([cachedHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } else if (savedUrl) {
      window.open(savedUrl, "_blank");
    }
  }

  const canView = !!cachedHtml || !!savedUrl;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
        Proposal Files
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {/* .md proposal — always available */}
        <button
          style={{
            ...BTN,
            opacity: busy === "md" ? 0.6 : 1,
            cursor: busy === "md" ? "wait" : "pointer",
          }}
          disabled={busy !== null}
          onClick={handleMd}
        >
          {busy === "md"
            ? (mode === "local" ? "Downloading…" : "Saving to Drive…")
            : (mode === "local" ? "Proposal .md" : "Save .md to Drive")}
        </button>

        {/* Upload HTML file */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <button
          style={{
            ...BTN,
            opacity: busy === "upload" ? 0.6 : 1,
            cursor: busy === "upload" ? "wait" : "pointer",
          }}
          disabled={busy !== null}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy === "upload" ? "Uploading…" : "Upload .html"}
        </button>

        {/* View Site button */}
        {canView && (
          <button
            style={{
              ...BTN,
              background: "var(--accent-dim)",
              borderColor: "var(--accent-glow)",
              color: "var(--accent)",
            }}
            onClick={handleViewSite}
          >
            View Site
          </button>
        )}
      </div>

      {/* Demo site URL input */}
      <div style={{ marginTop: 12 }}>
        {!urlEditing && savedUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Site URL:
            </span>
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "var(--accent)", textDecoration: "underline", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}
            >
              {savedUrl}
            </a>
            <button
              style={{ ...BTN, padding: "3px 8px", fontSize: 10 }}
              onClick={() => setUrlEditing(true)}
            >
              Edit
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="url"
              placeholder="https://demo-site-url.com"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                outline: "none",
                minWidth: 0,
              }}
            />
            <button
              style={{
                ...BTN,
                padding: "5px 12px",
                fontSize: 11,
                opacity: busy === "url" || !siteUrl.trim() ? 0.5 : 1,
              }}
              disabled={busy !== null || !siteUrl.trim()}
              onClick={handleSaveUrl}
            >
              {busy === "url" ? "Saving…" : "Save URL"}
            </button>
            {savedUrl && (
              <button
                style={{ ...BTN, padding: "5px 8px", fontSize: 10, color: "var(--text-muted)" }}
                onClick={() => { setUrlEditing(false); setSiteUrl(savedUrl); }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}
        >
          Open in Drive
        </a>
      )}

      {error && (
        <p style={{ marginTop: 8, fontSize: 11, color: "#ef4444", fontFamily: "var(--font-mono)" }}>
          {error}
          {error.includes("Account Settings") && (
            <> — <a href="/account" style={{ color: "#ef4444", textDecoration: "underline" }}>Settings</a></>
          )}
        </p>
      )}
    </div>
  );
}
