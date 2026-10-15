"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Business, SearchSet } from "@/types/business";
import { SOCIAL_ICONS } from "@/types/constants";
import { getStorageMode } from "@/lib/storage-preference";
import "leaflet/dist/leaflet.css";
import { BusinessTypeInput } from "@/components/search/business-type-input";
import { LocationInput } from "@/components/search/location-input";
import { BusinessInfoPanel } from "@/components/search/business-info-panel";

const BusinessMap = dynamic(
  () => import("@/components/search/business-map").then(m => m.BusinessMap),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: "100%", minHeight: 400,
        background: "var(--bg-sidebar)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Loading map…</span>
      </div>
    ),
  }
);


function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SearchPage() {
  const [query, setQuery]       = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry]   = useState("");
  const [limit, setLimit]       = useState(20);
  const [results, setResults]   = useState<Business[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [staleOnly, setStaleOnly] = useState(false);

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SearchSet[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [proposalGenerating, setProposalGenerating] = useState<Record<string, boolean>>({});
  const [proposalDone, setProposalDone] = useState<Record<string, { driveUrl: string }>>({});
  const [proposalError, setProposalError] = useState<Record<string, string>>({});

  useEffect(() => {
    const first = results.find(b => b.latitude && b.longitude);
    if (first) setMapCenter([first.latitude!, first.longitude!]);
  }, [results]);

  // Load saved searches on mount
  useEffect(() => {
    fetch("/api/search-sets")
      .then(r => r.json())
      .then((d: { search_sets?: SearchSet[] }) => setSavedSearches(d.search_sets ?? []))
      .catch(() => {});
  }, []);

  function handleLocationChange(loc: string, cty: string) {
    setLocation(loc);
    if (cty) setCountry(cty);
  }

  async function handleSearch(e?: React.FormEvent, overrideQuery?: string, overrideLocation?: string, overrideCountry?: string, overrideLimit?: number, setId?: string) {
    e?.preventDefault();
    const q = overrideQuery ?? query;
    const loc = overrideLocation ?? location;
    if (!q.trim() || !loc.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, location: loc, limit: overrideLimit ?? limit, country: (overrideCountry ?? country).trim(), stale_only: staleOnly }),
      });
      const data = await res.json() as { businesses?: Business[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      const found = data.businesses ?? [];
      setResults(found);

      // Update saved set stats if this was a re-run
      if (setId) {
        await fetch("/api/search-sets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: setId, last_run_at: new Date().toISOString(), result_count: found.length }),
        });
        setSavedSearches(prev => prev.map(s => s.id === setId ? { ...s, last_run_at: new Date().toISOString(), result_count: found.length } : s));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function openSaveModal() {
    setSaveName(query && location ? `${query} in ${location}` : "");
    setSaveError(null);
    setSaveModalOpen(true);
  }

  async function handleSaveSearch() {
    if (!saveName.trim() || !query.trim() || !location.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/search-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), query, location, country: country.trim(), limit_count: limit }),
      });
      const data = await res.json() as { search_set?: SearchSet; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      if (data.search_set) setSavedSearches(prev => [data.search_set!, ...prev]);
      setSaveModalOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSavedSearch(id: string) {
    await fetch(`/api/search-sets?id=${id}`, { method: "DELETE" });
    setSavedSearches(prev => prev.filter(s => s.id !== id));
  }

  function loadSavedSearch(s: SearchSet) {
    setQuery(s.query);
    setLocation(s.location);
    setCountry(s.country);
    setLimit(s.limit_count);
  }

  function handleBusinessSelect(business: Business) {
    setSelectedBusiness(business);
    setIsPanelOpen(true);
  }

  async function handleGenerateProposal(business: Business) {
    setProposalGenerating(prev => ({ ...prev, [business.id]: true }));
    setProposalError(prev => ({ ...prev, [business.id]: "" }));
    try {
      // 1. Generate markdown
      const genRes = await fetch("/api/audit/website-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: business.id }),
      });
      const genData = await genRes.json() as { markdown?: string; filename?: string; error?: string };
      if (!genRes.ok || !genData.markdown) throw new Error(genData.error ?? "Generation failed");
      const filename = genData.filename ?? `${business.name.replace(/[^a-z0-9]/gi, "-")}-website-proposal.md`;

      if (getStorageMode() === "local") {
        // Download .md directly to device
        const blob = new Blob([genData.markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setProposalDone(prev => ({ ...prev, [business.id]: { driveUrl: "" } }));
      } else {
        // 2. Upload to Drive → LeadSight/{Business}/
        const driveRes = await fetch("/api/export/proposal-drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_id: business.id, markdown: genData.markdown, filename }),
        });
        const driveData = await driveRes.json() as { url?: string; error?: string };
        if (!driveRes.ok || !driveData.url) throw new Error(driveData.error ?? "Drive upload failed");
        setProposalDone(prev => ({ ...prev, [business.id]: { driveUrl: driveData.url! } }));
      }
    } catch (err) {
      console.error("[Proposal]", err);
      const msg = err instanceof Error ? err.message : "Failed";
      setProposalError(prev => ({
        ...prev,
        [business.id]: msg.includes("not connected") || msg.includes("No Google")
          ? "Google Drive not connected — reconnect in Account Settings."
          : msg,
      }));
    } finally {
      setProposalGenerating(prev => ({ ...prev, [business.id]: false }));
    }
  }

  const canSearch = query.trim().length > 0 && location.trim().length > 0;
  const canSave = canSearch && !savedSearches.some(s => s.query === query && s.location === location);

  return (
    <div style={{ position: "fixed", top: 60, left: 220, right: 0, bottom: 0, overflow: "hidden", zIndex: 50 }}>
      <BusinessMap
        businesses={results}
        center={mapCenter}
        onBusinessSelect={handleBusinessSelect}
        selectedBusiness={selectedBusiness}
      />

      <BusinessInfoPanel
        business={selectedBusiness}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />

      {/* Search panel overlay */}
      <div style={{
        position: "absolute",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 40px)",
        maxWidth: "fit-content",
        zIndex: 1100,
        backdropFilter: "blur(8px)",
        borderRadius: 14,
        border: "1px solid var(--border)",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#FFF", fontFamily: "var(--font-display)", margin: 0 }}>
          Business Search
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
          Find local businesses and audit their digital presence
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Main row */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <BusinessTypeInput
            value={query}
            onChange={setQuery}
            onSubmit={() => handleSearch()}
          />
          <LocationInput
            value={location}
            country={country}
            onChange={handleLocationChange}
            onSubmit={() => handleSearch()}
          />
          <button
            type="submit"
            disabled={loading || !canSearch}
            style={{
              flexShrink: 0,
              borderRadius: 10,
              background: canSearch ? "var(--accent)" : "var(--bg-elevated)",
              border: "none",
              color: canSearch ? "#0a0f18" : "var(--text-muted)",
              padding: "0 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: canSearch && !loading ? "pointer" : "not-allowed",
              opacity: loading ? 0.7 : 1,
              transition: "all 150ms",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-sans)",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Searching…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Search
              </>
            )}
          </button>

          {/* Save search button */}
          {canSave && (
            <button
              type="button"
              onClick={openSaveModal}
              title="Save this search as a named set"
              style={{
                flexShrink: 0,
                borderRadius: 10,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--accent)",
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-sans)",
                whiteSpace: "nowrap",
                transition: "border-color 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-glow)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Save
            </button>
          )}
        </div>

        {/* Options row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
            Results:
          </span>
          {[1, 5, 10, 20, 50].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: `1px solid ${limit === n ? "var(--accent-glow)" : "var(--border)"}`,
                background: limit === n ? "var(--accent-dim)" : "transparent",
                color: limit === n ? "var(--accent)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                transition: "all 120ms",
              }}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setStaleOnly(!staleOnly)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: `1px solid ${staleOnly ? "var(--accent-orange-glow)" : "var(--border)"}`,
              background: staleOnly ? "var(--accent-orange-dim)" : "transparent",
              color: staleOnly ? "var(--accent-orange)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              transition: "all 120ms",
            }}
          >
            Stale only (365+)
          </button>

          {results.length > 0 && !loading && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {results.length} business{results.length !== 1 ? "es" : ""} found
            </span>
          )}
        </div>
      </form>

      {/* Saved Searches section */}
      {savedSearches.length > 0 && (
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
            Saved Searches
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {savedSearches.map(s => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--bg-deep)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Search icon */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: 8 }}>
                    {s.query} · {s.location}
                    {s.last_run_at && <> · ran {formatTimeAgo(s.last_run_at)} · {s.result_count} results</>}
                  </span>
                </div>

                {/* Load / Re-run */}
                <button
                  type="button"
                  onClick={() => {
                    loadSavedSearch(s);
                    handleSearch(undefined, s.query, s.location, s.country, s.limit_count, s.id);
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--accent-glow)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Re-run
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDeleteSavedSearch(s.id)}
                  title="Delete saved search"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "2px 4px",
                    lineHeight: 1,
                    borderRadius: 4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: "12px 16px", fontSize: 13, color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          color: "var(--text-muted)",
          gap: 12,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.4 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p style={{ fontSize: 13, fontFamily: "var(--font-mono)", textAlign: "center", margin: 0 }}>
            Enter a business type and location to begin
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {["Restaurants", "Hair Salons", "Dentists", "Gyms", "Auto Repair"].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setQuery(t)}
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-glow)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      </div>

      {!loading && results.length > 0 && (
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            gap: 8,
            padding: "12px 16px",
            backgroundColor: "rgba(9,11,16,0.9)",
            backdropFilter: "blur(4px)",
            borderTop: "1px solid rgba(34,211,238,0.2)",
          }}>
            {results.map(business => {
              const socialLinks = business.social_links ?? {};
              const activeSocials = Object.entries(socialLinks).filter(([, url]) => !!url);
              return (
                <div
                  key={business.id}
                  onClick={() => handleBusinessSelect(business)}
                  style={{
                    minWidth: 260,
                    maxWidth: 355,
                    flexShrink: 0,
                    background: "var(--bg-surface)",
                    border: !business.website ? "2px solid #ef4444" : "1px solid var(--border)",
                    borderRadius: 10,
                    padding: !business.website ? "14px 16px" : "12px 14px",
                    transition: "border-color 150ms",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = !business.website ? "rgba(239,68,68,0.6)" : "rgba(34,211,238,0.25)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = !business.website ? "#ef4444" : "var(--border)")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {business.name}
                    </h3>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {business.category && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          borderRadius: 20, padding: "2px 8px",
                          background: "var(--accent-dim)", color: "var(--accent)",
                          border: "1px solid var(--accent-glow)",
                          fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                          maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {business.category}
                        </span>
                      )}
                      {business.is_stale === true && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          borderRadius: 20, padding: "2px 8px",
                          background: "var(--accent-orange-dim)", color: "var(--accent-orange)",
                          border: "1px solid var(--accent-orange-glow)",
                          fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                        }}>
                          Stale
                        </span>
                      )}
                      {business.is_stale === null && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          borderRadius: 20, padding: "2px 8px",
                          background: "transparent", color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                          fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
                        }}>
                          Not Audited
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {business.address}
                  </p>

                  {business.rating ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <span style={{ color: "var(--amber)", fontSize: 11 }}>★</span>
                      <span style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{business.rating}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({business.review_count})</span>
                    </div>
                  ) : null}

                  {business.phone && (
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {business.phone}
                    </p>
                  )}

                  {business.website ? (
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "var(--accent)", display: "block", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {business.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      borderRadius: 20, padding: "2px 8px",
                      background: "rgba(239,68,68,0.1)", color: "#ef4444",
                      border: "1px solid rgba(239,68,68,0.3)",
                      fontFamily: "var(--font-mono)",
                      display: "inline-block", marginTop: 4,
                    }}>
                      NO WEBSITE
                    </span>
                  )}

                  {/* Social icons */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {activeSocials.length > 0 ? activeSocials.map(([platform, url]) => {
                      const icon = SOCIAL_ICONS[platform];
                      if (!icon) return null;
                      return (
                        <a
                          key={platform}
                          href={url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={icon.label}
                          style={{
                            fontSize: 9, fontWeight: 700, color: "#fff",
                            backgroundColor: icon.color,
                            borderRadius: 4, padding: "2px 5px",
                            textDecoration: "none",
                          }}
                        >
                          {icon.char}
                        </a>
                      );
                    }) : (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>No social links</span>
                    )}
                  </div>

                  {!business.website && (
                    <div style={{ marginTop: 8 }}>
                      {proposalDone[business.id] ? (
                        proposalDone[business.id]!.driveUrl ? (
                          <a
                            href={proposalDone[business.id]!.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "block", width: "100%", textAlign: "center",
                              borderRadius: 7, padding: "6px 0", fontSize: 11, fontWeight: 600,
                              color: "#22c55e", background: "rgba(34,197,94,0.1)",
                              border: "1px solid rgba(34,197,94,0.3)", textDecoration: "none",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            Open in Drive ↗
                          </a>
                        ) : (
                          <span style={{
                            display: "block", width: "100%", textAlign: "center",
                            borderRadius: 7, padding: "6px 0", fontSize: 11, fontWeight: 600,
                            color: "#22c55e", background: "rgba(34,197,94,0.1)",
                            border: "1px solid rgba(34,197,94,0.3)",
                            fontFamily: "var(--font-mono)",
                          }}>
                            ✓ Downloaded
                          </span>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={!!proposalGenerating[business.id]}
                            onClick={() => handleGenerateProposal(business)}
                            style={{
                              display: "block", width: "100%", textAlign: "center",
                              borderRadius: 7, padding: "6px 0", fontSize: 11, fontWeight: 600,
                              color: proposalGenerating[business.id] ? "var(--text-muted)" : "#f97316",
                              background: proposalGenerating[business.id] ? "var(--bg-elevated)" : "rgba(249,115,22,0.1)",
                              border: `1px solid ${proposalGenerating[business.id] ? "var(--border)" : "rgba(249,115,22,0.3)"}`,
                              cursor: proposalGenerating[business.id] ? "not-allowed" : "pointer",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {proposalGenerating[business.id] ? "Building proposal…" : "Generate Proposal ↓"}
                          </button>
                          {proposalGenerating[business.id] && (
                            <div style={{ marginTop: 5 }}>
                              <div style={{ height: 2, borderRadius: 1, background: "var(--bg-elevated)", overflow: "hidden" }}>
                                <div
                                  className="animate-pulse"
                                  style={{ height: "100%", background: "linear-gradient(90deg, #f97316, #fb923c)", width: "100%" }}
                                />
                              </div>
                              <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3, textAlign: "center", fontFamily: "var(--font-mono)" }}>
                                AI is writing your proposal…
                              </p>
                            </div>
                          )}
                          {proposalError[business.id] && (
                            <p style={{ fontSize: 9, marginTop: 4, color: "#ef4444", fontFamily: "var(--font-mono)" }}>
                              {proposalError[business.id]}
                              {proposalError[business.id].includes("Account Settings") && (
                                <> <a href="/account" style={{ color: "#ef4444", textDecoration: "underline" }}>Settings →</a></>
                              )}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <a
                      href={`/leads/${business.id}`}
                      style={{
                        display: "block",
                        textAlign: "center",
                        borderRadius: 7,
                        padding: "6px 0",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--accent)",
                        background: "var(--accent-dim)",
                        border: "1px solid var(--accent-glow)",
                        textDecoration: "none",
                      }}
                    >
                      View Audit →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Save Search Modal */}
      {saveModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={e => { if (e.target === e.currentTarget) setSaveModalOpen(false); }}
        >
          <div style={{
            background: "var(--bg-sidebar)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "24px",
            width: "100%",
            maxWidth: 400,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", margin: "0 0 4px" }}>
              Save Search
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: "0 0 16px" }}>
              {query} in {location}
            </p>

            <label style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 6 }}>
              Search name
            </label>
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveSearch(); if (e.key === "Escape") setSaveModalOpen(false); }}
              placeholder="e.g. Hair Salons Cape Town"
              style={{
                width: "100%",
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                color: "var(--text-primary)",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "var(--font-sans)",
              }}
            />

            {saveError && (
              <p style={{ fontSize: 11, color: "#ef4444", fontFamily: "var(--font-mono)", marginTop: 8 }}>
                {saveError}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  background: "none",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSearch}
                disabled={saving || !saveName.trim()}
                style={{
                  flex: 2,
                  padding: "9px 0",
                  borderRadius: 8,
                  background: saveName.trim() ? "var(--accent)" : "var(--bg-elevated)",
                  border: "none",
                  color: saveName.trim() ? "#0a0f18" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saveName.trim() && !saving ? "pointer" : "not-allowed",
                  opacity: saving ? 0.7 : 1,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {saving ? "Saving…" : "Save Search"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
