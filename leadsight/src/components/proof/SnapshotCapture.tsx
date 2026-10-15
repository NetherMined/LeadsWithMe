"use client";

import { useState } from "react";

interface SnapshotCaptureProps {
  businessId: string;
  phase: "before" | "after";
  onCaptured?: () => void;
}

export function SnapshotCapture({ businessId, phase, onCaptured }: SnapshotCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleCapture() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/proof/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          phase,
          notes: notes || undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setSuccess(true);
      setNotes("");
      setNotesExpanded(false);
      if (onCaptured) onCaptured();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture snapshot");
    } finally {
      setLoading(false);
    }
  }

  const buttonLabel = phase === "before" ? "Capture Before Snapshot" : "Capture After Snapshot";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Notes textarea (expandable) */}
      {notesExpanded && (
        <div
          style={{
            borderRadius: "0.5rem",
            border: `1px solid rgba(255,255,255,0.07)`,
            background: "var(--bg-elevated)",
            padding: "0.75rem",
          }}
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this snapshot..."
            style={{
              width: "100%",
              borderRadius: "0.375rem",
              border: `1px solid rgba(255,255,255,0.07)`,
              background: "var(--bg-deep)",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              color: "var(--text-primary)",
            }}
            rows={3}
          />
          <button
            onClick={() => setNotesExpanded(false)}
            style={{
              marginTop: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
            }}
          >
            Collapse
          </button>
        </div>
      )}

      {/* Main button and controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          onClick={handleCapture}
          disabled={loading}
          style={{
            flex: 1,
            borderRadius: "0.5rem",
            background: "var(--accent-blue)",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            color: "var(--text-primary)",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "all 0.2s",
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  height: "1rem",
                  width: "1rem",
                  animation: "spin 1s linear infinite",
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "var(--text-primary)",
                }}
              />
              Capturing...
            </>
          ) : (
            buttonLabel
          )}
        </button>

        {!notesExpanded && (
          <button
            onClick={() => setNotesExpanded(true)}
            style={{
              borderRadius: "0.5rem",
              border: `1px solid rgba(255,255,255,0.07)`,
              background: "var(--bg-elevated)",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            title="Add optional notes"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-deep)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Status messages */}
      {success && (
        <p style={{ fontSize: "0.875rem", color: "var(--accent-green)", fontWeight: "500" }}>
          Snapshot captured successfully!
        </p>
      )}
      {error && (
        <p style={{ fontSize: "0.875rem", color: "var(--accent-orange)" }}>{error}</p>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
