"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Business, SearchSet } from "@/types/business";
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
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [limit, setLimit] = useState(20);
  const [results, setResults] = useState<Business[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleOnly, setStaleOnly] = useState(false);

  const [savedSearches, setSavedSearches] = useState<SearchSet[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    const first = results.find(b => b.latitude && b.longitude);
    if (first) setMapCenter([first.latitude!, first.longitude!]);
  }, [results]);

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
      setResults(data.businesses ?? []);
      if (setId) {
        await fetch("/api/search-sets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: setId, last_run_at: new Date().toISOString(), result_count: (data.businesses ?? []).length }),
        });
        setSavedSearches(prev => prev.map(s => s.id === setId ? { ...s, last_run_at: new Date().toISOString(), result_count: (data.businesses ?? []).length } : s));
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
        background: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#FFF", fontFamily: "var(--font-display)", margin: 0 }}>
            Business Search
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
            Find local businesses and audit their digital presence
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <BusinessTypeInput value={query} onChange={setQuery} onSubmit={() => handleSearch()} />
            <LocationInput value={location} country={country} onChange={handleLocationChange} onSubmit={() => handleSearch()} />
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-sans)",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Searching…" : "Search"}
            </button>
            {canSave && (
              <button
                type="button"
                onClick={openSaveModal}
                style={{
                  flexShrink: 0,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "var(--accent)",
                  padding: "0 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Save
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Results:</span>
            {[1, 5, 10, 20, 50].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${limit === n ? "var(--accent-glow)" : "rgba(255,255,255,0.1)"}`,
                  background: limit === n ? "var(--accent-dim)" : "transparent",
                  color: limit === n ? "var(--accent)" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
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
                border: `1px solid ${staleOnly ? "var(--accent-orange-glow)" : "rgba(255,255,255,0.1)"}`,
                background: staleOnly ? "var(--accent-orange-dim)" : "transparent",
                color: staleOnly ? "var(--accent-orange)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
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

        {savedSearches.length > 0 && (
          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
              Saved Searches
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {savedSearches.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: 8 }}>
                      {s.query} · {s.location}{s.last_run_at && <> · {formatTimeAgo(s.last_run_at)}</>}
                    </span>
                  </div>
                  <button type="button" onClick={() => { loadSavedSearch(s); handleSearch(undefined, s.query, s.location, s.country, s.limit_count, s.id); }} style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent-glow)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Run</button>
                  <button type="button" onClick={() => handleDeleteSavedSearch(s.id)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom result cards strip */}
      {results.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 1100,
          display: "flex",
          gap: 12,
          overflowX: "auto",
          padding: "8px 4px 12px",
          scrollbarWidth: "thin",
        }}>
          {results.map(b => {
            const selected = selectedBusiness?.place_id === b.place_id;
            return (
              <button
                key={b.place_id || b.id}
                type="button"
                onClick={() => handleBusinessSelect(b)}
                style={{
                  flex: "0 0 280px",
                  textAlign: "left",
                  background: selected ? "rgba(52, 211, 153, 0.15)" : "rgba(15, 23, 42, 0.85)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: selected ? "1px solid rgba(52, 211, 153, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
                    {b.name}
                  </div>
                  {b.rating !== null && (
                    <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, flexShrink: 0 }}>
                      ★ {b.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                {b.category && (
                  <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                    {b.category}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, lineHeight: 1.4, maxHeight: 32, overflow: "hidden" }}>
                  {b.address}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 10, fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: b.website ? "#22c55e" : "#ef4444" }}>{b.website ? "✓ site" : "✗ site"}</span>
                  <span style={{ color: b.phone ? "#22c55e" : "#64748b" }}>{b.phone ? "✓ phone" : "— phone"}</span>
                  {b.review_count > 0 && <span style={{ color: "#94a3b8" }}>{b.review_count} reviews</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Save modal */}
      {saveModalOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSaveModalOpen(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--text-primary)" }}>Save Search</h3>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Search name"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", marginBottom: 12 }}
            />
            {saveError && <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 8px" }}>{saveError}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setSaveModalOpen(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={handleSaveSearch} disabled={saving} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#0a0f18", fontWeight: 600, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(239,68,68,0.9)", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 12, zIndex: 1200 }}>
          {error}
        </div>
      )}
    </div>
  );
}
