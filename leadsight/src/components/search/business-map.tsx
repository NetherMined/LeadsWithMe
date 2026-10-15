"use client";

import { useEffect, useRef } from "react";
import type { Business } from "@/types/business";

interface BusinessMapProps {
  businesses: Business[];
  center: [number, number] | null;
  onBusinessSelect?: (business: Business) => void;
  selectedBusiness?: Business | null;
}

export function BusinessMap({ businesses, center, onBusinessSelect, selectedBusiness }: BusinessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamically import leaflet (SSR-safe)
    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initialCenter: [number, number] = center ?? [20, 0];
      const initialZoom = center ? 13 : 2;

      const map = L.map(containerRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Light tiles + CSS invert on .leaflet-tile-pane → dark grey matching site palette
      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19 }
      ).addTo(map);

      // Custom zoom control positioned bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Attribution (required by OSM)
      L.control.attribution({ position: "bottomleft", prefix: false })
        .addTo(map)
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');

      mapRef.current = map;

      // Add initial markers
      addMarkers(L, map, businesses);
    });

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when businesses or selectedBusiness change
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as ReturnType<typeof L.map>;
      // Clear old markers
      markersRef.current.forEach((m) => (m as ReturnType<typeof L.marker>).remove());
      markersRef.current = [];
      addMarkers(L, map, businesses);

      // Fit bounds to all markers if we have any
      if (businesses.length > 0) {
        const validBusinesses = businesses.filter(
          (b) => b.latitude && b.longitude
        );
        if (validBusinesses.length > 0) {
          const bounds = L.latLngBounds(
            validBusinesses.map((b) => [b.latitude!, b.longitude!])
          );
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
      } else if (center) {
        map.setView(center, 13, { animate: true });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, selectedBusiness]);

  function addMarkers(
    L: typeof import("leaflet"),
    map: ReturnType<typeof L.map>,
    items: Business[]
  ) {
    // Custom accent SVG pin (normal state)
    const normalIcon = L.divIcon({
      html: `
        <div style="
          width:14px;height:14px;
          background:#34d399;
          border:2px solid #fff;
          border-radius:50%;
          box-shadow:0 0 0 3px rgba(52,211,153,0.3),0 2px 8px rgba(0,0,0,0.6);
          cursor:pointer;
        "></div>`,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    // Active pin icon (larger, more prominent)
    const activeIcon = L.divIcon({
      html: `
        <div style="
          width:18px;height:18px;
          background:#34d399;
          border:2px solid #fff;
          border-radius:50%;
          box-shadow:0 0 0 5px rgba(52,211,153,0.35),0 2px 12px rgba(0,0,0,0.7);
          cursor:pointer;
        "></div>`,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    items.forEach((business) => {
      if (!business.latitude || !business.longitude) return;

      // Determine which icon to use based on selection state
      const icon = business.place_id === selectedBusiness?.place_id ? activeIcon : normalIcon;

      const marker = L.marker([business.latitude, business.longitude], {
        icon: icon,
      })
        .addTo(map);

      // Trigger callback on click
      marker.on("click", () => onBusinessSelect?.(business));

      markersRef.current.push(marker);
    });
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "#0D1017",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Map container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 400 }} />

      {/* Empty state overlay */}
      {businesses.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(9,11,16,0.7)",
            pointerEvents: "none",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3A445A" strokeWidth="1.5" style={{ marginBottom: 8 }}>
            <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z"/>
          </svg>
          <span style={{ fontSize: 12, color: "#3A445A", fontFamily: "var(--font-mono)" }}>
            Search to plot businesses
          </span>
        </div>
      )}

      {/* Business count badge */}
      {businesses.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(9,11,16,0.85)",
            border: "1px solid rgba(34,211,238,0.25)",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 11,
            color: "#22D3EE",
            fontFamily: "var(--font-mono)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {businesses.length} location{businesses.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
