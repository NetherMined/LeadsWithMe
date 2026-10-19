// Static preview with made-up data. Scores follow the real weights in types/constants.ts.
const SUB_SCORES = [
  { label: "Website", value: 42 },
  { label: "Social presence", value: 30 },
  { label: "Engagement", value: 35 },
  { label: "Advertising", value: 10 },
  { label: "Reviews", value: 82 },
];

const ISSUES = [
  "Mobile page speed 31/100: slow on phones",
  "No Instagram or Facebook posts in 5 months",
  "No ads running on Google or Meta",
];

function barColor(value: number) {
  return value >= 70 ? "#22c55e" : value >= 40 ? "var(--amber)" : "#ef4444";
}

export function SampleReport() {
  return (
    <div className="card-surface p-5 space-y-5" style={{ boxShadow: "0 24px 48px rgba(16, 24, 40, 0.12)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label-overline">Sample report</div>
          <div className="mt-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Harbour Bakery &amp; Café
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Bakery · Example Town · 4.6★ (212 reviews)</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold leading-none" style={{ color: "#ef4444" }}>37</div>
          <div className="mt-1 status-badge">Grade D</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {SUB_SCORES.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-[11px] mb-1">
              <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
              <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>{s.value}</span>
            </div>
            <div className="h-[5px] rounded-[3px]" style={{ background: "var(--border)" }}>
              <div className="h-[5px] rounded-[3px]" style={{ background: barColor(s.value), width: `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="label-overline mb-2">Top issues</div>
        <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {ISSUES.map((issue) => (
            <li key={issue} className="flex gap-2">
              <span style={{ color: "#ef4444" }}>●</span>
              {issue}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="label-overline mb-2">Proposed website demo</div>
        <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "var(--bg-deep)", borderBottom: "1px solid var(--border)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--amber)" }} />
            <span className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
            <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>harbourbakery-demo.html</span>
          </div>
          <div className="p-4" style={{ background: "linear-gradient(135deg, #7c2d12, #c2410c)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-orange-100">Fresh every morning</div>
            <div className="mt-1 text-lg font-bold leading-tight text-white">Sourdough, pastries &amp; coffee by the harbour</div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-orange-900">Order online</span>
              <span className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-white" style={{ border: "1px solid rgba(255,255,255,0.5)" }}>
                Opening hours
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
