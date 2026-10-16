"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { OutreachPipelineEntry } from "@/types/outreach";

const PIPELINE_STATUSES = [
  "not_contacted",
  "contacted",
  "replied",
  "negotiating",
  "won",
  "lost",
  "ghosted",
] as const;

const STATUS_COLORS: Record<string, { background: string; borderColor: string }> = {
  not_contacted: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
  contacted: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
  replied: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
  negotiating: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
  won: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
  lost: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
  ghosted: { background: "var(--bg-surface)", borderColor: "rgba(255,255,255,0.07)" },
};

const STATUS_BADGE_COLORS: Record<string, { background: string; color: string }> = {
  not_contacted: { background: "var(--accent)", color: "var(--text-primary)" },
  contacted: { background: "var(--accent-blue)", color: "var(--text-primary)" },
  replied: { background: "var(--accent-orange)", color: "var(--text-primary)" },
  negotiating: { background: "var(--accent-orange)", color: "var(--text-primary)" },
  won: { background: "var(--accent-green)", color: "var(--text-primary)" },
  lost: { background: "var(--accent)", color: "var(--text-primary)" },
  ghosted: { background: "var(--accent)", color: "var(--text-primary)" },
};

const CHANNEL_BADGE_COLORS: Record<string, { background: string; color: string }> = {
  email: { background: "var(--accent)", color: "var(--text-primary)" },
  linkedin: { background: "var(--accent-blue)", color: "var(--text-primary)" },
  both: { background: "var(--accent-blue)", color: "var(--text-primary)" },
};

interface Props {
  initialData: OutreachPipelineEntry[];
}

interface EditingEntry extends OutreachPipelineEntry {
  businesses?: {
    name: string;
    category: string;
    address_city: string;
    rating: number | null;
    review_count: number | null;
  } | null;
}

export function PipelineKanban({ initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<EditingEntry[]>(initialData);
  const [selectedChannel, setSelectedChannel] = useState<"all" | "email" | "linkedin" | "both">("all");
  const [selectedEntry, setSelectedEntry] = useState<EditingEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog form state
  const [formStatus, setFormStatus] = useState<EditingEntry["status"]>("not_contacted");
  const [formNotes, setFormNotes] = useState("");
  const [formWonAmount, setFormWonAmount] = useState("");
  const [formFollowupDate, setFormFollowupDate] = useState("");

  const handleCardClick = (entry: EditingEntry) => {
    setSelectedEntry(entry);
    setFormStatus(entry.status);
    setFormNotes(entry.outcome_notes || "");
    setFormWonAmount(entry.won_amount?.toString() || "");
    setFormFollowupDate(entry.next_followup_at?.split("T")[0] || "");
    setIsDialogOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!selectedEntry) return;

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: selectedEntry.id,
        status: formStatus,
      };

      if (formNotes) payload.outcome_notes = formNotes;
      if (formWonAmount) payload.won_amount = parseFloat(formWonAmount);
      if (formFollowupDate) payload.next_followup_at = formFollowupDate;

      const response = await fetch("/api/outreach/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update pipeline entry");

      // Optimistic update
      setData((prev) =>
        prev.map((entry) =>
          entry.id === selectedEntry.id
            ? {
                ...entry,
                status: formStatus,
                outcome_notes: formNotes || entry.outcome_notes,
                won_amount: formWonAmount ? parseFloat(formWonAmount) : entry.won_amount,
                next_followup_at: formFollowupDate || entry.next_followup_at,
              }
            : entry
        )
      );

      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating entry:", error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedEntry, formStatus, formNotes, formWonAmount, formFollowupDate, router]);

  const filterData = (entries: EditingEntry[]) => {
    if (selectedChannel === "all") return entries;
    return entries.filter((entry) => entry.channel === selectedChannel);
  };

  const getDaysSinceContact = (date: string | null): string | null => {
    if (!date) return null;
    const days = Math.floor(
      (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days === 0 ? "today" : `${days}d ago`;
  };

  const getGradeFromScore = (score?: number): string | null => {
    if (!score) return null;
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    if (score >= 20) return "D";
    return "F";
  };

  const filteredData = filterData(data);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex gap-2">
        {(["all", "email", "linkedin", "both"] as const).map((channel) => (
          <button
            key={channel}
            onClick={() => setSelectedChannel(channel)}
            style={{
              background:
                selectedChannel === channel ? "var(--accent-blue)" : "transparent",
              color: "var(--text-primary)",
              border: `1px solid ${selectedChannel === channel ? "var(--accent-blue)" : "rgba(255,255,255,0.07)"}`,
              cursor: "pointer",
            }}
            className="px-3 py-1.5 text-sm rounded transition-all"
          >
            {channel === "all"
              ? "All Channels"
              : channel.charAt(0).toUpperCase() + channel.slice(1)}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 overflow-x-auto">
        {PIPELINE_STATUSES.map((status) => {
          const statusEntries = filteredData.filter((entry) => entry.status === status);
          const statusLabel = status
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          const colorConfig = STATUS_COLORS[status];

          return (
            <div
              key={status}
              className="rounded border-2 p-4"
              style={{
                borderColor: colorConfig.borderColor,
                background: colorConfig.background,
              }}
            >
              {/* Column Header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  {statusLabel}
                </h3>
                <div
                  className="rounded-sm px-2 py-1 text-xs font-semibold text-text-primary"
                  style={{ background: "var(--accent)" }}
                >
                  {statusEntries.length}
                </div>
              </div>

              {/* Column Cards */}
              <div className="flex flex-col gap-3">
                {statusEntries.length === 0 ? (
                  <p className="text-xs text-text-secondary">No entries</p>
                ) : (
                  statusEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => handleCardClick(entry)}
                      className="flex flex-col gap-2 rounded border border-white/5 bg-bg-elevated p-3 cursor-pointer transition-all hover:shadow-lg"
                    >
                      {/* Business Name */}
                      <div className="truncate font-medium text-sm text-text-primary">
                        {entry.businesses?.name || "Unknown Business"}
                      </div>

                      {/* City */}
                      <div className="text-xs text-text-secondary">
                        {entry.businesses?.address_city || "Unknown"}
                      </div>

                      {/* Channel Badge */}
                      <div className="flex flex-wrap gap-1">
                        <div
                          className="rounded-sm px-2 py-1 text-xs font-semibold"
                          style={CHANNEL_BADGE_COLORS[entry.channel]}
                        >
                          {entry.channel}
                        </div>
                      </div>

                      {/* Days Since Contact */}
                      {entry.last_contact_at && (
                        <div className="text-xs text-text-secondary">
                          {getDaysSinceContact(entry.last_contact_at)}
                        </div>
                      )}

                      {/* Rating and Score */}
                      {entry.businesses?.rating && (
                        <div className="text-xs text-text-secondary">
                          ★ {entry.businesses.rating.toFixed(1)} (
                          {entry.businesses.review_count} reviews)
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      {isDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 50,
          }}
          onClick={() => setIsDialogOpen(false)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: `1px solid rgba(255,255,255,0.07)`,
              borderRadius: "0.5rem",
              padding: "1.5rem",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <h2 style={{ fontSize: "1.125rem", fontWeight: "700", marginBottom: "1.5rem", color: "var(--text-primary)" }}>
              {selectedEntry?.businesses?.name || "Edit Entry"}
            </h2>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              {/* Status Dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="status" style={{ fontSize: "0.875rem", fontWeight: "500", color: "var(--text-primary)" }}>
                  Status
                </label>
                <select
                  id="status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as EditingEntry["status"])}
                  style={{
                    display: "flex",
                    height: "2.5rem",
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {PIPELINE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Outcome Notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="notes" style={{ fontSize: "0.875rem", fontWeight: "500", color: "var(--text-primary)" }}>
                  Outcome Notes
                </label>
                <textarea
                  id="notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Add notes about this opportunity..."
                  style={{
                    display: "flex",
                    minHeight: "5rem",
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              {/* Won Amount */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="won-amount" style={{ fontSize: "0.875rem", fontWeight: "500", color: "var(--text-primary)" }}>
                  Won Amount ($)
                </label>
                <input
                  id="won-amount"
                  type="number"
                  placeholder="0.00"
                  value={formWonAmount}
                  onChange={(e) => setFormWonAmount(e.target.value)}
                  style={{
                    height: "2.5rem",
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              {/* Next Followup Date */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="followup-date" style={{ fontSize: "0.875rem", fontWeight: "500", color: "var(--text-primary)" }}>
                  Next Followup Date
                </label>
                <input
                  id="followup-date"
                  type="date"
                  value={formFollowupDate}
                  onChange={(e) => setFormFollowupDate(e.target.value)}
                  style={{
                    height: "2.5rem",
                    width: "100%",
                    borderRadius: "0.375rem",
                    border: `1px solid rgba(255,255,255,0.07)`,
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setIsDialogOpen(false)}
                style={{
                  background: "transparent",
                  color: "var(--text-primary)",
                  border: `1px solid rgba(255,255,255,0.07)`,
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  background: "var(--accent-blue)",
                  color: "var(--text-primary)",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                  transition: "all 0.2s",
                }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
