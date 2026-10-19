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

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initialCenter: [number, number] = center ?? [20, 0];
      const initialZoom = center ? 13 : 2;

      const map = L.map(containerRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark-friendly CartoDB tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

      mapRef.current = map;
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

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as ReturnType<typeof L.map>;
      markersRef.current.forEach((m) => (m as ReturnType<typeof L.marker>).remove());
      markersRef.current = [];
      addMarkers(L, map, businesses);

      if (businesses.length > 0) {
        const valid = businesses.filter((b) => b.latitude && b.longitude);
        if (valid.length > 0) {
          const bounds = L.latLngBounds(valid.map((b) => [b.latitude!, b.longitude!]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
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
    const normalIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#34d399;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(52,211,153,0.35),0 2px 10px rgba(0,0,0,0.6);cursor:pointer;"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const activeIcon = L.divIcon({
      html: `<div style="width:22px;height:22px;background:#22d3ee;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 6px rgba(34,211,238,0.4),0 2px 14px rgba(0,0,0,0.7);cursor:pointer;"></div>`,
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    items.forEach((business) => {
      if (!business.latitude || !business.longitude) return;

      const isSelected = business.place_id === selectedBusiness?.place_id;
      const icon = isSelected ? activeIcon : normalIcon;

      const marker = L.marker([business.latitude, business.longitude], { icon }).addTo(map);

      const popupContent = `<div style="font-family:system-ui,sans-serif;font-size:13px;min-width:140px;">
        <strong>${business.name}</strong><br/>
        ${business.rating ? `<span style="color:#f59e0b">★ ${business.rating}</span> · ${business.review_count} reviews` : ""}
        ${business.category ? `<br/><span style="color:#94a3b8;font-size:11px">${business.category}</span>` : ""}
      </div>`;

      marker.bindPopup(popupContent, { closeButton: false, offset: [0, -8] });
      marker.on("click", () => onBusinessSelect?.(business));

      markersRef.current.push(marker);
    });
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#0a0e17",
        width: "100%",
        height: "100%",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 400 }} />

      {businesses.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,14,23,0.75)",
            pointerEvents: "none",
            backdropFilter: "blur(2px)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <circle cx="12" cy="10" r="3"/>
            <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z"/>
          </svg>
          <span style={{ fontSize: 14, color: "#64748b", fontFamily: "var(--font-sans)", fontWeight: 500 }}>
            Search for businesses to see them on the map
          </span>
        </div>
      )}

      {businesses.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(52,211,153,0.3)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "#34d399",
            fontFamily: "var(--font-mono)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          {businesses.length} location{businesses.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
