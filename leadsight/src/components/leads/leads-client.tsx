"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Business, SocialLinks } from "@/types/business";
import { SOCIAL_ICONS } from "@/types/constants";

interface LeadsClientProps {
  businesses: Business[];
  categories: string[];
  locations: string[];
  searchTerms: string[];
}

function hasSocial(links: SocialLinks | null): boolean {
  if (!links) return false;
  return Object.values(links).some(v => !!v);
}

function exportCsv(businesses: Business[]) {
  const headers = [
    "Name", "Category", "Search Term", "Address", "Landline", "Mobile",
    "Email", "WhatsApp", "Website", "Rating", "Reviews",
    "Facebook", "Instagram", "LinkedIn", "TikTok", "Twitter", "YouTube",
  ];
  const rows = businesses.map(b => [
    b.name,
    b.category,
    b.search_term ?? "",
    b.address,
    b.phone ?? "",
    b.mobile ?? "",
    b.email ?? "",
    b.whatsapp ?? "",
    b.website ?? "",
    b.rating ?? "",
    b.review_count,
    b.social_links?.facebook ?? "",
    b.social_links?.instagram ?? "",
    b.social_links?.linkedin ?? "",
    b.social_links?.tiktok ?? "",
    b.social_links?.twitter ?? "",
    b.social_links?.youtube ?? "",
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leadsight-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}



interface SelectFilterProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function SelectFilter({ label, options, value, onChange, placeholder = "Any" }: SelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q)).slice(0, 50);
  }, [options, search]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label className="label-overline block mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="w-full flex items-center justify-between bg-bg-deep border border-solid rounded px-2.5 py-1.75 text-sm cursor-pointer text-left transition-colors"
        style={{
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          color: value ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span className="truncate max-w-xs">
          {value || placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-bg-sidebar border border-accent-glow rounded-lg shadow-lg overflow-hidden" style={{
          top: "calc(100% + 4px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {/* Search input inside dropdown */}
          <div className="px-2 py-1.5 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-bg-deep border border-border rounded text-xs text-text-primary outline-none"
              style={{
                padding: "5px 8px",
              }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {/* Clear option */}
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full px-3 py-1.75 text-left text-xs text-text-muted border-none cursor-pointer italic"
              style={{
                background: value === "" ? "rgba(34,211,238,0.06)" : "none",
              }}
            >
              {placeholder}
            </button>
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full px-3 py-1.75 text-left text-xs border-none cursor-pointer transition-colors"
                style={{
                  color: opt === value ? "var(--accent)" : "var(--text-secondary)",
                  background: opt === value ? "rgba(34,211,238,0.06)" : "none",
                }}
                onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (opt !== value) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
              >
                {opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-text-muted text-center">
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="btn-ghost w-full flex items-center justify-between"
    >
      <span className="text-xs text-text-secondary font-sans">{label}</span>
      <div style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        background: checked ? "var(--accent)" : "var(--border)",
        position: "relative",
        transition: "background 150ms",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute",
          top: 3,
          left: checked ? 16 : 3,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 150ms",
        }} />
      </div>
    </button>
  );
}


function RatingSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const options = [0, 3, 3.5, 4, 4.5, 5];
  return (
    <div>
      <label className="label-overline block mb-1.5">
        Min Rating
      </label>
      <div className="flex gap-1 flex-wrap">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="px-2 py-1 rounded text-xs font-mono cursor-pointer transition-all duration-100"
            style={{
              border: `1px solid ${value === opt ? "var(--accent)" : "var(--border)"}`,
              background: value === opt ? "var(--accent-dim)" : "var(--bg-deep)",
              color: value === opt ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {opt === 0 ? "Any" : `★${opt}+`}
          </button>
        ))}
      </div>
    </div>
  );
}


export function LeadsClient({ businesses, categories, locations, searchTerms }: LeadsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [hasSocialMedia, setHasSocialMedia] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasWhatsApp, setHasWhatsApp] = useState(false);

  const filtered = useMemo(() => {
    return businesses.filter(b => {
      if (searchTerm && b.search_term !== searchTerm) return false;
      if (category && b.category !== category) return false;
      if (locationFilter && !b.address.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      if (minRating > 0 && (b.rating === null || b.rating < minRating)) return false;
      if (hasWebsite && !b.website) return false;
      if (hasSocialMedia && !hasSocial(b.social_links)) return false;
      if (hasEmail && !b.email) return false;
      if (hasWhatsApp && !b.whatsapp) return false;
      return true;
    });
  }, [businesses, searchTerm, category, locationFilter, minRating, hasWebsite, hasSocialMedia, hasEmail, hasWhatsApp]);

  const activeFilterCount = [searchTerm, category, locationFilter, minRating > 0, hasWebsite, hasSocialMedia, hasEmail, hasWhatsApp].filter(Boolean).length;

  function resetFilters() {
    setSearchTerm(""); setCategory(""); setLocationFilter("");
    setMinRating(0); setHasWebsite(false); setHasSocialMedia(false);
    setHasEmail(false); setHasWhatsApp(false);
  }

  return (
    <div className="flex gap-4 items-start">
      {/* ── Filter sidebar ── */}
      <aside className="card-surface w-52 flex-shrink-0 p-3.5 sticky top-0">
        <div className="flex items-center justify-between mb-3.5">
          <span className="label-overline">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-accent bg-none border-none cursor-pointer font-mono"
            >
              Reset ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <SelectFilter
            label="Business Type"
            options={searchTerms}
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="All types"
          />
          <SelectFilter
            label="Category"
            options={categories}
            value={category}
            onChange={setCategory}
            placeholder="All categories"
          />
          <SelectFilter
            label="Location"
            options={locations}
            value={locationFilter}
            onChange={setLocationFilter}
            placeholder="All locations"
          />

          <RatingSelect value={minRating} onChange={setMinRating} />

          <div className="flex flex-col gap-2.5">
            <ToggleRow label="Has website" checked={hasWebsite} onChange={setHasWebsite} />
            <ToggleRow label="Has social media" checked={hasSocialMedia} onChange={setHasSocialMedia} />
            <ToggleRow label="Has email" checked={hasEmail} onChange={setHasEmail} />
            <ToggleRow label="Has WhatsApp" checked={hasWhatsApp} onChange={setHasWhatsApp} />
          </div>

          <div className="border-t border-border pt-3">
            <a
              href="/search"
              className="block w-full text-center py-1.75 rounded text-xs font-semibold text-accent bg-accent-dim border border-accent-glow no-underline"
            >
              + New Search
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main table ── */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs text-text-muted font-mono">
            {filtered.length} of {businesses.length} leads
          </span>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="flex items-center gap-1.25 text-xs font-semibold text-text-primary bg-bg-surface border border-border rounded cursor-pointer font-mono py-1.25 px-3"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <p className="text-sm text-text-muted font-mono">
              {businesses.length === 0 ? "No leads yet." : "No leads match the current filters."}
            </p>
            {businesses.length === 0 && (
              <a href="/search" className="text-xs text-accent mt-2 inline-block">
                Search for businesses →
              </a>
            )}
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <div style={{ overflowX: "auto" }}>
              <table className="w-full border-collapse" style={{ minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Business", "Contact", "Digital", "Social", ""].map((h, i) => (
                      <th key={i} style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                        background: "rgba(255,255,255,0.02)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => {
                    const socials = Object.entries(b.social_links ?? {}).filter(([, v]) => !!v);
                    return (
                      <tr
                        key={b.id}
                        style={{
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          transition: "background 120ms",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,238,0.025)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Business */}
                        <td style={{ padding: "12px 14px", maxWidth: 200, verticalAlign: "top" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.name}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.search_term ?? b.category}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.address}
                          </div>
                          {b.rating !== null && (
                            <div style={{ fontSize: 10, color: "var(--amber)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                              ★ {b.rating} <span style={{ color: "var(--text-muted)" }}>({b.review_count})</span>
                            </div>
                          )}
                        </td>

                        {/* Contact */}
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <ContactCell b={b} />
                        </td>

                        {/* Digital */}
                        <td style={{ padding: "12px 14px", verticalAlign: "top", maxWidth: 160 }}>
                          {b.website ? (
                            <a
                              href={b.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 11, color: "var(--accent)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}
                            >
                              {b.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </a>
                          ) : (
                            <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>No website</span>
                          )}
                        </td>

                        {/* Social */}
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                            {socials.length > 0 ? socials.map(([platform, url]) => {
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
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: "#fff",
                                    backgroundColor: icon.color,
                                    borderRadius: 4,
                                    padding: "2px 5px",
                                    textDecoration: "none",
                                  }}
                                >
                                  {icon.char}
                                </a>
                              );
                            }) : (
                              <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "12px 14px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          <a
                            href={`/leads/${b.id}`}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--accent)",
                              background: "var(--accent-dim)",
                              border: "1px solid var(--accent-glow)",
                              borderRadius: 6,
                              padding: "4px 10px",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Audit →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ContactCell({ b }: { b: Business }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11 }}>
      {b.phone && (
        <a href={`tel:${b.phone}`} style={{ color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <PhoneIcon /> {b.phone}
        </a>
      )}
      {b.mobile && b.mobile !== b.phone && (
        <a href={`tel:${b.mobile}`} style={{ color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <MobileIcon /> {b.mobile}
        </a>
      )}
      {b.whatsapp && (
        <a href={b.whatsapp} target="_blank" rel="noopener noreferrer" style={{ color: "#25D366", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <WhatsAppIcon /> WhatsApp
        </a>
      )}
      {b.email && (
        <a href={`mailto:${b.email}`} style={{ color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <MailIcon /> {b.email}
        </a>
      )}
      {!b.phone && !b.mobile && !b.email && !b.whatsapp && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>No contact info</span>
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.46 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}
