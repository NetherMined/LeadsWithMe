"use client";

import { useState, useRef, useEffect, useMemo } from "react";

// Common business types — used for predictive suggestions
const BUSINESS_TYPES = [
  "Accountants", "Advertising Agencies", "Airlines", "Architects", "Art Galleries",
  "Auto Repair", "Bakeries", "Banks", "Barbershops", "Bars",
  "Bed & Breakfast", "Beauty Salons", "Bookstores", "Butcher Shops", "Car Dealerships",
  "Car Wash", "Caterers", "Churches", "Cinemas", "Cleaning Services",
  "Clothing Stores", "Coffee Shops", "Colleges", "Contractors", "Convenience Stores",
  "Couriers", "Dance Studios", "Daycares", "Dentists", "Doctors",
  "Electricians", "Electronics Stores", "Event Planners", "Financial Advisors", "Fitness Centers",
  "Florists", "Furniture Stores", "Gas Stations", "Gift Shops", "Golf Courses",
  "Grocery Stores", "Gyms", "Hair Salons", "Hardware Stores", "Hotels",
  "Insurance Agencies", "IT Support", "Jewellery Stores", "Landscaping", "Law Firms",
  "Libraries", "Martial Arts", "Massage Therapy", "Medical Clinics", "Mosques",
  "Motels", "Moving Companies", "Museums", "Music Schools", "Nail Salons",
  "Nightclubs", "Nurseries", "Optometrists", "Pest Control", "Pet Stores",
  "Pharmacies", "Photographers", "Pilates Studios", "Plumbers", "Printing Shops",
  "Property Agents", "Real Estate Agents", "Restaurants", "Shoe Stores", "Software Companies",
  "Spas", "Supermarkets", "Swimming Pools", "Temples", "Theaters",
  "Toy Stores", "Travel Agencies", "Tutoring", "Universities", "Veterinarians",
  "Videographers", "Web Design", "Yoga Studios",
];

interface BusinessTypeInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
}

export function BusinessTypeInput({ value, onChange, onSubmit }: BusinessTypeInputProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return BUSINESS_TYPES.slice(0, 8);
    const q = value.toLowerCase();
    const exact = BUSINESS_TYPES.filter(t => t.toLowerCase().startsWith(q));
    const fuzzy = BUSINESS_TYPES.filter(t => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q));
    return [...exact, ...fuzzy].slice(0, 10);
  }, [value]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    if (e.key === "Enter" && !open) { onSubmit?.(); }
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
    inputRef.current?.blur();
  }

  const showDropdown = open && suggestions.length > 0;

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
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder="Business type (e.g. Restaurants)"
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
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(true); inputRef.current?.focus(); }}
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
          {/* Header */}
          <div style={{ padding: "7px 12px 5px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Business Types
            </span>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {suggestions.map(s => {
              const q = value.toLowerCase();
              const idx = s.toLowerCase().indexOf(q);
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(s); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 100ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,238,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  </svg>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}>
                    {idx >= 0 && q ? (
                      <>
                        {s.slice(0, idx)}
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{s.slice(idx, idx + q.length)}</span>
                        {s.slice(idx + q.length)}
                      </>
                    ) : s}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
