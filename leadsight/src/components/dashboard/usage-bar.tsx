"use client";

interface UsageBarProps {
  pct: number;   // 0–100
  color: string;
}

export function UsageBar({ pct, color }: UsageBarProps) {
  const fill = pct > 85 ? "#EF4444" : pct > 60 ? "#F59E0B" : color;
  return (
    <div
      style={{
        height: 6,
        borderRadius: 4,
        background: "var(--border)",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: fill,
          borderRadius: 4,
          transition: "width 0.6s ease",
        }}
      />
    </div>
  );
}
