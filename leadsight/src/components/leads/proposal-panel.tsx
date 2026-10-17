"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Monitor, Tablet, Smartphone, ExternalLink, Download, Upload, Cloud, RefreshCw, Sparkles } from "lucide-react";

interface VersionSummary {
  id: string;
  status: string;
  error: string | null;
  has_proposal: boolean;
  has_demo: boolean;
  demo_site_url: string | null;
  screenshot_desktop_url: string | null;
  screenshot_mobile_url: string | null;
  created_at: string;
  finished_at: string | null;
}

interface VersionDetail extends VersionSummary {
  proposal_md: string | null;
  html: string | null;
}

interface Props {
  businessId: string;
  businessName: string;
  hasWebsite: boolean;
}

const STEPS = [
  { key: "queued", label: "Queued" },
  { key: "proposal", label: "Writing proposal" },
  { key: "demo", label: "Building demo site" },
  { key: "screenshots", label: "Capturing screenshots" },
] as const;
const ACTIVE = new Set<string>(STEPS.map(s => s.key));
const POLL_MS = 4000;

const DEVICES = {
  desktop: { width: 1280, height: 800, icon: Monitor, label: "Desktop" },
  tablet: { width: 768, height: 1024, icon: Tablet, label: "Tablet" },
  mobile: { width: 390, height: 844, icon: Smartphone, label: "Mobile" },
} as const;
type Device = keyof typeof DEVICES;

type Tab = "proposal" | "demo" | "screenshots";

const BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
};

const ACCENT_BTN: React.CSSProperties = {
  ...BTN,
  background: "var(--accent-dim)",
  borderColor: "var(--accent-glow)",
  color: "var(--accent)",
};

function downloadBlob(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// The demo is AI-written HTML built from scraped content, so it only ever runs in a
// sandboxed iframe with an opaque origin — never directly on the app's origin.
function openSandboxedTab(html: string, title: string) {
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(title)}</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe sandbox="allow-scripts allow-popups" srcdoc="${escapeAttr(html)}"></iframe></body></html>`;
  const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function formatElapsed(fromIso: string, now: number) {
  const secs = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

function versionLabel(v: VersionSummary, index: number, total: number) {
  const date = new Date(v.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
  const state = v.status === "ready" ? "" : v.status === "failed" ? " · failed" : " · building";
  return `v${total - index} · ${date}${state}`;
}

export function ProposalPanel({ businessId, businessName, hasWebsite }: Props) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, VersionDetail>>({});
  const [preferredTab, setTab] = useState<Tab>("proposal");
  const [device, setDevice] = useState<Device>("desktop");
  const [busy, setBusy] = useState<"build" | "drive" | "upload" | "url" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeName = businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const activeBuild = versions?.find(v => ACTIVE.has(v.status)) ?? null;
  const activeBuildId = activeBuild?.id ?? null;
  const selected = versions?.find(v => v.id === selectedId) ?? null;
  const detail = selectedId ? details[selectedId] : undefined;

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/proposal/builds?business_id=${businessId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load proposals");
    const { versions: list } = (await res.json()) as { versions: VersionSummary[] };
    setVersions(list);
    return list;
  }, [businessId]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/proposal/builds/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version: VersionDetail };
    setDetails(d => ({ ...d, [id]: version }));
  }, []);

  // Initial load: select the newest finished version, or the running build.
  useEffect(() => {
    loadVersions()
      .then(list => {
        const pick = list.find(v => v.status === "ready") ?? list[0];
        if (pick) setSelectedId(pick.id);
      })
      .catch(e => setError((e as Error).message));
  }, [loadVersions]);

  // Poll while a build runs; when it finishes, switch to it.
  useEffect(() => {
    if (!activeBuildId) return;
    const buildId = activeBuildId;
    const timer = setInterval(async () => {
      try {
        const list = await loadVersions();
        const build = list.find(v => v.id === buildId);
        if (build && !ACTIVE.has(build.status)) {
          setSelectedId(buildId);
          if (build.status === "ready") setTab("proposal");
        }
      } catch {
        // Keep polling; a transient failure should not stop progress updates.
      }
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [activeBuildId, loadVersions]);

  // Fetch bodies for the selected version once it has finished.
  useEffect(() => {
    if (!selected || ACTIVE.has(selected.status)) return;
    const cached = details[selected.id];
    if (!cached || cached.status !== selected.status || cached.has_demo !== selected.has_demo || cached.demo_site_url !== selected.demo_site_url) {
      void loadDetail(selected.id);
    }
  }, [selected, details, loadDetail]);

  const selectedUrl = selected?.demo_site_url ?? "";
  useEffect(() => {
    setSiteUrl(selectedUrl);
    setDriveUrl(null);
  }, [selectedId, selectedUrl]);

  async function handleBuild() {
    setBusy("build");
    setError(null);
    try {
      const res = await fetch("/api/proposal/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });
      const data = (await res.json().catch(() => ({}))) as { buildId?: string; error?: string };
      if (!res.ok && res.status !== 409) throw new Error(data.error ?? "Could not start the build");
      await loadVersions();
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleDrive() {
    if (!detail?.proposal_md) return;
    setBusy("drive");
    setError(null);
    try {
      const res = await fetch("/api/export/proposal-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId, markdown: detail.proposal_md, filename: `${safeName}-proposal.md` }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Drive upload failed");
      setDriveUrl(data.url);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg.includes("not connected") || msg.includes("No Google") ? "Google Drive not connected — check Account Settings." : msg);
    } finally {
      setBusy(null);
    }
  }

  async function saveDemo(body: { html?: string; demoSiteUrl?: string }, kind: "upload" | "url") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/proposal/demo-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, versionId: selected && !ACTIVE.has(selected.status) ? selected.id : undefined, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as { versionId?: string; error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      await loadVersions();
      if (data.versionId) {
        setSelectedId(data.versionId);
        await loadDetail(data.versionId);
      }
      if (kind === "upload") setTab("demo");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    await saveDemo({ html: await file.text() }, "upload");
  }

  const isFinished = !!selected && !ACTIVE.has(selected.status);
  const hasScreens = !!(selected?.screenshot_desktop_url || selected?.screenshot_mobile_url);
  const tabEnabled: Record<Tab, boolean> = {
    proposal: !!selected?.has_proposal,
    demo: !!(selected?.has_demo || selected?.demo_site_url),
    screenshots: hasScreens,
  };
  // Fall back to the first tab with content when the chosen one is empty in this version.
  const tab = tabEnabled[preferredTab] ? preferredTab : ((Object.keys(tabEnabled) as Tab[]).find(t => tabEnabled[t]) ?? preferredTab);
  const hasDemoHtml = !!detail?.html;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: 0 }}>
            Website Proposal
          </p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {hasWebsite ? "Redesign proposal based on the website audit, with a demo of the new site." : "New-website proposal with a demo site."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {versions && versions.length > 0 && (
            <select
              value={selectedId ?? ""}
              onChange={e => setSelectedId(e.target.value)}
              aria-label="Proposal version"
              style={{ ...BTN, fontWeight: 500, paddingRight: 8 }}
            >
              {versions.map((v, i) => (
                <option key={v.id} value={v.id}>{versionLabel(v, i, versions.length)}</option>
              ))}
            </select>
          )}
          <button
            style={{ ...ACCENT_BTN, opacity: activeBuild || busy === "build" ? 0.6 : 1, cursor: activeBuild ? "not-allowed" : "pointer" }}
            disabled={!!activeBuild || busy !== null || versions === null}
            onClick={handleBuild}
          >
            {versions && versions.length > 0 ? <RefreshCw size={13} /> : <Sparkles size={13} />}
            {activeBuild ? "Building…" : versions && versions.length > 0 ? "Rebuild proposal & demo" : "Build proposal & demo"}
          </button>
        </div>
      </div>

      {activeBuild && <BuildProgress build={activeBuild} now={now} />}

      {versions?.length === 0 && !activeBuild && (
        <p style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
          No proposal yet. Building one writes the proposal, then designs a demo site from it — this takes about 3–6 minutes.
          {hasWebsite && " Run the website audit first for a sharper redesign proposal."}
        </p>
      )}

      {selected?.status === "failed" && (
        <p style={{ marginTop: 14, fontSize: 12, color: "#ef4444", fontFamily: "var(--font-mono)" }}>
          This build failed: {selected.error ?? "unknown error"}
        </p>
      )}

      {isFinished && (selected.has_proposal || selected.has_demo || selected.demo_site_url) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
            <div role="tablist" style={{ display: "flex", gap: 2 }}>
              <TabButton active={tab === "proposal"} onClick={() => setTab("proposal")} disabled={!tabEnabled.proposal}>Proposal</TabButton>
              <TabButton active={tab === "demo"} onClick={() => setTab("demo")} disabled={!tabEnabled.demo}>Demo site</TabButton>
              <TabButton active={tab === "screenshots"} onClick={() => setTab("screenshots")} disabled={!tabEnabled.screenshots}>Screenshots</TabButton>
            </div>
            {tab === "demo" && hasDemoHtml && (
              <div style={{ display: "flex", gap: 4, paddingBottom: 6 }}>
                {(Object.keys(DEVICES) as Device[]).map(d => {
                  const Icon = DEVICES[d].icon;
                  return (
                    <button
                      key={d}
                      title={DEVICES[d].label}
                      aria-label={DEVICES[d].label}
                      aria-pressed={device === d}
                      onClick={() => setDevice(d)}
                      style={{ ...BTN, padding: "5px 8px", ...(device === d ? { background: "var(--accent-dim)", borderColor: "var(--accent-glow)", color: "var(--accent)" } : {}) }}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            {!detail ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>
            ) : tab === "proposal" ? (
              detail.proposal_md ? <ProposalMarkdown markdown={detail.proposal_md} /> : <Empty>No proposal document in this version.</Empty>
            ) : tab === "demo" ? (
              detail.html ? (
                <DemoPreview html={detail.html} device={device} title={`${businessName} demo`} />
              ) : detail.demo_site_url ? (
                <Empty>
                  This version links to a hosted demo:{" "}
                  <a href={detail.demo_site_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{detail.demo_site_url}</a>
                </Empty>
              ) : (
                <Empty>No demo site in this version.</Empty>
              )
            ) : (
              <Screenshots desktop={selected.screenshot_desktop_url} mobile={selected.screenshot_mobile_url} />
            )}
          </div>
        </div>
      )}

      {isFinished && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          {detail?.proposal_md && (
            <>
              <button style={BTN} onClick={() => downloadBlob(detail.proposal_md!, `${safeName}-proposal.md`, "text/markdown")}>
                <Download size={13} /> Proposal .md
              </button>
              <button style={{ ...BTN, opacity: busy === "drive" ? 0.6 : 1 }} disabled={busy !== null} onClick={handleDrive}>
                <Cloud size={13} /> {busy === "drive" ? "Saving to Drive…" : "Save to Drive"}
              </button>
            </>
          )}
          {detail?.html && (
            <>
              <button style={BTN} onClick={() => downloadBlob(detail.html!, `${safeName}-demo.html`, "text/html")}>
                <Download size={13} /> Demo .html
              </button>
              <button style={BTN} onClick={() => openSandboxedTab(detail.html!, `${businessName} demo`)}>
                <ExternalLink size={13} /> Open demo
              </button>
            </>
          )}
          <input ref={fileInputRef} type="file" accept=".html,.htm" style={{ display: "none" }} onChange={handleFileUpload} />
          <button style={{ ...BTN, opacity: busy === "upload" ? 0.6 : 1 }} disabled={busy !== null} onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> {busy === "upload" ? "Uploading…" : "Replace demo .html"}
          </button>
        </div>
      )}

      {versions && !activeBuild && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>Hosted demo URL</span>
          <input
            type="url"
            placeholder="https://demo-site-url.com"
            value={siteUrl}
            onChange={e => setSiteUrl(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: "6px 10px", fontSize: 11, fontFamily: "var(--font-mono)", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-base)", color: "var(--text-primary)", outline: "none" }}
          />
          <button
            style={{ ...BTN, padding: "5px 12px", fontSize: 11, opacity: busy !== null || !siteUrl.trim() || siteUrl.trim() === (selected?.demo_site_url ?? "") ? 0.5 : 1 }}
            disabled={busy !== null || !siteUrl.trim() || siteUrl.trim() === (selected?.demo_site_url ?? "")}
            onClick={() => saveDemo({ demoSiteUrl: siteUrl.trim() }, "url")}
          >
            {busy === "url" ? "Saving…" : "Save URL"}
          </button>
        </div>
      )}

      {driveUrl && (
        <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}>
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

function BuildProgress({ build, now }: { build: VersionSummary; now: number }) {
  const current = STEPS.findIndex(s => s.key === build.status);
  return (
    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "var(--bg-base)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Building proposal & demo</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{formatElapsed(build.created_at, now)}</span>
      </div>
      <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: done || active ? "var(--text-primary)" : "var(--text-muted)" }}>
              <span
                aria-hidden
                className={active ? "animate-pulse" : undefined}
                style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                  background: done ? "var(--accent)" : active ? "var(--amber)" : "var(--border)",
                }}
              />
              {step.label}
            </li>
          );
        })}
      </ol>
      <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        Usually 3–6 minutes. You can leave this page — the build keeps running.
      </p>
    </div>
  );
}

function TabButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 600,
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        color: disabled ? "var(--text-muted)" : active ? "var(--accent)" : "var(--text-secondary)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{children}</p>;
}

function DemoPreview({ html, device, title }: { html: string; device: Device; title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const { width, height } = DEVICES[device];

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = available ? Math.min(1, available / width) : 1;

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <div style={{ width: width * scale, height: height * scale, margin: "0 auto", overflow: "hidden", borderRadius: 10, border: "1px solid var(--border)", background: "#fff" }}>
        <iframe
          title={title}
          srcDoc={html}
          sandbox="allow-scripts allow-popups"
          referrerPolicy="no-referrer"
          style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", display: "block" }}
        />
      </div>
      <p style={{ marginTop: 6, textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {width}×{height}{scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}
      </p>
    </div>
  );
}

function Screenshots({ desktop, mobile }: { desktop: string | null; mobile: string | null }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      {desktop && (
        <a href={desktop} target="_blank" rel="noopener noreferrer" style={{ flex: "3 1 360px", maxHeight: 640, overflow: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-only file served by /api/files */}
          <img src={desktop} alt="Desktop screenshot of the demo site" style={{ width: "100%", display: "block" }} />
        </a>
      )}
      {mobile && (
        <a href={mobile} target="_blank" rel="noopener noreferrer" style={{ flex: "1 1 180px", maxWidth: 260, maxHeight: 640, overflow: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-only file served by /api/files */}
          <img src={mobile} alt="Mobile screenshot of the demo site" style={{ width: "100%", display: "block" }} />
        </a>
      )}
    </div>
  );
}

const MD: Components = {
  h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)", margin: "0 0 12px" }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)", margin: "24px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "18px 0 6px" }}>{children}</h3>,
  h4: ({ children }) => <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: "14px 0 4px" }}>{children}</h4>,
  p: ({ children }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: "0 0 10px", paddingLeft: 20, listStyle: "disc" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "0 0 10px", paddingLeft: 20, listStyle: "decimal" }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>{children}</a>,
  strong: ({ children }) => <strong style={{ color: "var(--text-primary)" }}>{children}</strong>,
  blockquote: ({ children }) => <blockquote style={{ margin: "0 0 10px", padding: "4px 12px", borderLeft: "3px solid var(--accent)", color: "var(--text-secondary)" }}>{children}</blockquote>,
  hr: () => <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "18px 0" }} />,
  code: ({ children }) => <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--bg-base)", padding: "1px 5px", borderRadius: 4 }}>{children}</code>,
  pre: ({ children }) => <pre style={{ margin: "0 0 10px", padding: 12, background: "var(--bg-base)", borderRadius: 8, overflowX: "auto" }}>{children}</pre>,
  table: ({ children }) => <div style={{ overflowX: "auto", margin: "0 0 12px" }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>{children}</table></div>,
  th: ({ children }) => <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--text-primary)", fontWeight: 700 }}>{children}</th>,
  td: ({ children }) => <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>{children}</td>,
};

function ProposalMarkdown({ markdown }: { markdown: string }) {
  return (
    <div style={{ maxHeight: 640, overflowY: "auto", paddingRight: 8, fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{markdown}</ReactMarkdown>
    </div>
  );
}
