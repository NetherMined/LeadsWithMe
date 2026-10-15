import { PipelineKanban } from "@/components/outreach/PipelineKanban";
import { FollowupReminder } from "@/components/outreach/FollowupReminder";
import type { OutreachPipelineEntry } from "@/types/outreach";

export default async function OutreachPage() {
  let pipelineData: OutreachPipelineEntry[] = [];
  let wonCount = 0;
  let activeCount = 0;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/outreach/pipeline`, {
      cache: "no-store",
    });

    if (response.ok) {
      pipelineData = await response.json();
      wonCount = pipelineData.filter((entry) => entry.status === "won").length;
      activeCount = pipelineData.filter(
        (entry) => entry.status === "contacted" || entry.status === "replied" || entry.status === "negotiating"
      ).length;
    }
  } catch (error) {
    console.error("Error fetching pipeline data:", error);
  }

  const winRate = pipelineData.length > 0
    ? ((wonCount / pipelineData.length) * 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Outreach Pipeline</h1>
          <p className="page-subtitle">Track and manage your B2B lead outreach.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="kpi-card">
          <p className="label-overline mb-3">Total Leads</p>
          <p className="text-[28px] font-bold leading-none" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            {pipelineData.length}
          </p>
          <p className="text-[11px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>pipeline entries</p>
        </div>

        <div className="kpi-card">
          <p className="label-overline mb-3">Active</p>
          <p className="text-[28px] font-bold leading-none" style={{ color: "var(--accent-orange)", fontFamily: "var(--font-display)" }}>
            {activeCount}
          </p>
          <p className="text-[11px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>in progress</p>
        </div>

        <div className="kpi-card">
          <p className="label-overline mb-3">Won</p>
          <p className="text-[28px] font-bold leading-none" style={{ color: "var(--accent)", fontFamily: "var(--font-display)" }}>
            {wonCount}
          </p>
          <p className="text-[11px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>closed deals</p>
        </div>

        <div className="kpi-card">
          <p className="label-overline mb-3">Win Rate</p>
          <div className="flex items-end gap-2 mt-0.5">
            <p className="text-[28px] font-bold leading-none" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {winRate}%
            </p>
            {Number(winRate) > 0 && (
              <span className="trend-up mb-0.5">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                {winRate}%
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>conversion</p>
        </div>
      </div>

      {/* Followup Reminder */}
      <FollowupReminder />

      {/* Kanban Board */}
      <PipelineKanban initialData={pipelineData} />
    </div>
  );
}
