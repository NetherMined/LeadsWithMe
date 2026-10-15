"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuditButtonProps {
  businessId: string;
  hasWebsite: boolean;
}

async function postStep(url: string, body: object): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return data.error ?? `HTTP ${res.status}`;
    }
    return null;
  } catch {
    return "Network error";
  }
}

export function AuditButton({ businessId, hasWebsite }: AuditButtonProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [step, setStep] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const router = useRouter();

  async function runAudit() {
    setStatus("running");
    setErrors([]);
    const body = { business_id: businessId };
    const stepErrors: string[] = [];

    if (hasWebsite) {
      setStep("Auditing website…");
      const err = await postStep("/api/audit/website", body);
      if (err) stepErrors.push(`Website: ${err}`);
    }

    setStep("Analysing social media…");
    const socialErr = await postStep("/api/audit/social", body);
    if (socialErr) stepErrors.push(`Social: ${socialErr}`);

    setStep("Checking ads & reach…");
    const adsErr = await postStep("/api/audit/ads", body);
    if (adsErr) stepErrors.push(`Ads: ${adsErr}`);

    setStep("Finding competitors…");
    const compErr = await postStep("/api/audit/competitors", body);
    if (compErr) stepErrors.push(`Competitors: ${compErr}`);

    setStep("Computing score…");
    const scoreErr = await postStep("/api/score", body);
    if (scoreErr) stepErrors.push(`Score: ${scoreErr}`);

    setErrors(stepErrors);
    setStatus(stepErrors.length > 0 ? "error" : "done");
    setStep("");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {status === "running" && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", animation: "pulse 1.5s ease-in-out infinite" }}>
            {step}
          </span>
        )}
        <button
          onClick={runAudit}
          disabled={status === "running"}
          style={{
            flexShrink: 0,
            borderRadius: 8,
            background: status === "running" ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.85)",
            border: "1px solid rgba(34,197,94,0.4)",
            color: "#fff",
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: status === "running" ? "not-allowed" : "pointer",
            opacity: status === "running" ? 0.7 : 1,
            transition: "all 150ms",
            fontFamily: "var(--font-sans)",
          }}
        >
          {status === "running" ? "Running…" : "Run Audit"}
        </button>
      </div>
      {errors.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
          {errors.map((e, i) => (
            <span key={i} style={{ fontSize: 11, color: "#ef4444", fontFamily: "var(--font-mono)" }}>{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}
