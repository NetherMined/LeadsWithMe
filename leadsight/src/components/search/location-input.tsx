"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface LocationSuggestion {
  label: string;
  full: string;
  country: string;
  place_id: string;
}

interface LocationInputProps {
  value: string;
  country: string;
  onChange: (location: string, country: string) => void;
  onSubmit?: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Flag emoji from country name (best-effort, no external lib)
const COUNTRY_FLAGS: Record<string, string> = {
  "South Africa": "🇿🇦", "United States": "🇺🇸", "United Kingdom": "🇬🇧",
  "Australia": "🇦🇺", "Canada": "🇨🇦", "Germany": "🇩🇪", "France": "🇫🇷",
  "Spain": "🇪🇸", "Italy": "🇮🇹", "Netherlands": "🇳🇱", "Portugal": "🇵🇹",
  "Brazil": "🇧🇷", "Mexico": "🇲🇽", "India": "🇮🇳", "China": "🇨🇳",
  "Japan": "🇯🇵", "New Zealand": "🇳🇿", "Ireland": "🇮🇪", "Singapore": "🇸🇬",
  "Nigeria": "🇳🇬", "Kenya": "🇰🇪", "Ghana": "🇬🇭", "Egypt": "🇪🇬",
  "UAE": "🇦🇪", "Saudi Arabia": "🇸🇦", "Israel": "🇮🇱", "Turkey": "🇹🇷",
  "Poland": "🇵🇱", "Sweden": "🇸🇪", "Norway": "🇳🇴", "Denmark": "🇩🇰",
  "Switzerland": "🇨🇭", "Belgium": "🇧🇪", "Austria": "🇦🇹", "Argentina": "🇦🇷",
  "Chile": "🇨🇱", "Colombia": "🇨🇴", "Indonesia": "🇮🇩", "Malaysia": "🇲🇾",
  "Thailand": "🇹🇭", "Philippines": "🇵🇭", "Pakistan": "🇵🇰", "Bangladesh": "🇧🇩",
  "Vietnam": "🇻🇳", "Russia": "🇷🇺", "Ukraine": "🇺🇦", "Romania": "🇷🇴",
  "USA": "🇺🇸",
};

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? "🌍";
}

// Format description: strip country from end to avoid repetition in the label
function formatDisplayLabel(suggestion: LocationSuggestion): string {
  // Show "Cape Town, Western Cape" (without the country)
  const parts = suggestion.full.split(",").map(s => s.trim());
  if (parts.length >= 2 && parts[parts.length - 1] === suggestion.country) {
    return parts.slice(0, -1).join(", ");
  }
  return suggestion.full;
}

export function LocationInput({ value, country, onChange, onSubmit }: LocationInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the full description that was last selected, so we don't overwrite the short display label
  const selectedFullRef = useRef<string | null>(null);

  const debouncedInput = useDebounce(inputValue, 280);

  // Sync external value → internal (when parent resets or loads saved search)
  // Skip sync when the change came from our own selection (to keep the short label visible)
  useEffect(() => {
    if (value !== selectedFullRef.current) {
      setInputValue(value);
      selectedFullRef.current = null;
    }
  }, [value]);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/autocomplete/location?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { suggestions?: LocationSuggestion[] };
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focused) fetchSuggestions(debouncedInput);
  }, [debouncedInput, focused, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function select(s: LocationSuggestion) {
    // Display only the short label (e.g. "Queens") but pass the full description
    // (e.g. "Queens, New York, NY, USA") to the parent so the Places API gets a precise location
    selectedFullRef.current = s.full;
    setInputValue(s.label);
    onChange(s.full, s.country);
    setOpen(false);
    setSuggestions([]);
    inputRef.current?.blur();
  }

  function handleInputChange(v: string) {
    setInputValue(v);
    setOpen(true);
    // If user manually edits, clear auto-country so they can re-select
    selectedFullRef.current = null;
    onChange(v, country);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); }
    if (e.key === "Enter" && !open) { onSubmit?.(); }
  }

  const showDropdown = open && (suggestions.length > 0 || loading);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 10,
        border: `1.5px solid ${focused ? "var(--accent)" : "var(--border)"}`,
        background: "var(--bg-surface)",
        padding: "0 12px",
        transition: "border-color 150ms",
      }}>
        {/* Icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { setFocused(true); setOpen(true); if (inputValue.length >= 2) fetchSuggestions(inputValue); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder="City, area or postal / zip code"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            padding: "12px 0",
            fontSize: 14,
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        />

        {/* Country pill — auto-populated */}
        {country && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 6,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-glow)",
            padding: "3px 8px",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 12 }}>{getFlag(country)}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              {country}
            </span>
            <button
              type="button"
              onClick={() => onChange(inputValue, "")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, lineHeight: 1, marginLeft: 2 }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
            style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        )}

        {inputValue && !loading && (
          <button
            type="button"
            onClick={() => { setInputValue(""); onChange("", ""); setSuggestions([]); selectedFullRef.current = null; inputRef.current?.focus(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, lineHeight: 1, flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--bg-sidebar)",
          border: "1px solid var(--accent-glow)",
          borderRadius: 10,
          zIndex: 50,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "7px 12px 5px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Location Suggestions
            </span>
          </div>

          {loading && suggestions.length === 0 ? (
            <div style={{ padding: "14px 12px", textAlign: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Searching…</span>
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {suggestions.map(s => (
                <button
                  key={s.place_id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(s); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 100ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,238,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  {/* Flag */}
                  <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{getFlag(s.country)}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Primary label — city/area */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </div>
                    {/* Full description */}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                      {formatDisplayLabel(s)}
                    </div>
                  </div>

                  {/* Country badge */}
                  {s.country && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "var(--accent)",
                      background: "var(--accent-dim)",
                      border: "1px solid var(--accent-glow)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      flexShrink: 0,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}>
                      {s.country}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
