"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { getStorageMode, setStorageMode, type StorageMode } from "@/lib/storage-preference";

interface SettingItem {
  key: string;
  title: string;
  description: string;
}

const SETTINGS: SettingItem[] = [
  {
    key: "reportPlans",
    title: "Generate Report Plans",
    description: "Automatically generate AI marketing strategy reports for new leads",
  },
  {
    key: "websiteStrategy",
    title: "Website Strategy Updates",
    description: "Include website improvement recommendations in audit reports",
  },
  {
    key: "aiServices",
    title: "AI Automated Services",
    description: "Enable AI-powered automated service suggestions and outreach templates",
  },
];

const CARD_STYLE: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "20px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
};

const DANGER_STYLE: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid #ef4444",
  borderRadius: 12,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
};

export function Settings() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    reportPlans: true,
    websiteStrategy: true,
    aiServices: false,
  });
  const [storageMode, setStorageModeState] = useState<StorageMode>("drive");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setStorageModeState(getStorageMode());
  }, []);

  function handleStorageToggle() {
    const next: StorageMode = storageMode === "drive" ? "local" : "drive";
    setStorageMode(next);
    setStorageModeState(next);
  }

  function toggle(key: string) {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function deleteRecords(type: "leads" | "plans") {
    setDeleting(type);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/delete-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete records" });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 16 }}>
          Configure how LeadSight generates reports and recommendations for your leads.
        </p>
        {SETTINGS.map(item => (
          <div key={item.key} style={CARD_STYLE}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginBottom: 4 }}>
                {item.title}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {item.description}
              </p>
            </div>
            <Switch
              checked={enabled[item.key] ?? false}
              onCheckedChange={() => toggle(item.key)}
            />
          </div>
        ))}
      </div>

      {/* File Storage */}
      <div className="border-t border-border" style={{ paddingTop: 24 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 16 }}>
          Choose where generated files (proposals, demo sites) are saved.
        </p>
        <div style={CARD_STYLE}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-sans)", marginBottom: 4 }}>
              {storageMode === "drive" ? "Google Drive" : "Local Download"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {storageMode === "drive"
                ? "Files are saved to LeadSight/{Business}/ in your Google Drive"
                : "Files are downloaded directly to your device (.md + .html where applicable)"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {storageMode === "drive" ? "Drive" : "Local"}
            </span>
            <Switch
              checked={storageMode === "drive"}
              onCheckedChange={handleStorageToggle}
            />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border-t border-border" style={{ paddingTop: 24 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 16 }}>
          Database management — permanently delete records from your account.
        </p>

        <div style={DANGER_STYLE}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", fontFamily: "var(--font-sans)", marginBottom: 4 }}>
              Delete All Leads
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Removes all businesses, audits, scores, outreach assets, and pipeline entries
            </p>
          </div>
          <button
            onClick={() => deleteRecords("leads")}
            disabled={deleting === "leads"}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: deleting === "leads" ? "not-allowed" : "pointer",
              opacity: deleting === "leads" ? 0.6 : 1,
            }}
          >
            {deleting === "leads" ? "Deleting..." : "Delete All"}
          </button>
        </div>

        <div style={{ ...DANGER_STYLE, marginTop: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", fontFamily: "var(--font-sans)", marginBottom: 4 }}>
              Delete All Plans
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Removes all marketing plans generated for leads
            </p>
          </div>
          <button
            onClick={() => deleteRecords("plans")}
            disabled={deleting === "plans"}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: deleting === "plans" ? "not-allowed" : "pointer",
              opacity: deleting === "plans" ? 0.6 : 1,
            }}
          >
            {deleting === "plans" ? "Deleting..." : "Delete All"}
          </button>
        </div>

        {message && (
          <p
            style={{
              marginTop: 12,
              fontSize: 12,
              fontWeight: 600,
              color: message.type === "success" ? "#22c55e" : "#ef4444",
              fontFamily: "var(--font-mono)",
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}