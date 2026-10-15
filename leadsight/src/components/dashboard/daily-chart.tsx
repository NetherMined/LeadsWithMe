"use client";

interface DayEntry {
  date: string;
  calls: number;
  cost: number;
}

interface DailyChartProps {
  data: DayEntry[];
}

const CHART_HEIGHT = 80;
const BAR_WIDTH    = 10;
const BAR_GAP      = 3;

export function DailyChart({ data }: DailyChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: CHART_HEIGHT + 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        No data yet
      </div>
    );
  }

  const maxCalls = Math.max(...data.map(d => d.calls), 1);
  const svgWidth = data.length * (BAR_WIDTH + BAR_GAP);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <svg
        width={svgWidth}
        height={CHART_HEIGHT + 20}
        style={{ display: "block", minWidth: "100%" }}
      >
        {data.map((d, i) => {
          const barH = Math.max((d.calls / maxCalls) * CHART_HEIGHT, 2);
          const x = i * (BAR_WIDTH + BAR_GAP);
          const y = CHART_HEIGHT - barH;
          const showLabel = i % 5 === 0;
          const label = d.date.slice(5); // MM-DD

          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barH}
                fill="var(--accent)"
                opacity={0.85}
                rx={2}
                style={{ transition: "height 0.4s ease, y 0.4s ease" }}
              >
                <title>{d.date}: {d.calls} calls, ${d.cost.toFixed(4)}</title>
              </rect>
              {showLabel && (
                <text
                  x={x + BAR_WIDTH / 2}
                  y={CHART_HEIGHT + 14}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
