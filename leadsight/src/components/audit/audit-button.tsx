"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuditButtonProps {
  businessId: string;
  hasWebsite: boolean;
}

/** Returns the step's error and any warnings (e.g. PageSpeed unavailable) as display messages. */
async function postStep(url: string, body: object): Promise<string[]> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; warnings?: string[] };
    if (!res.ok) return [data.error ?? `HTTP ${res.status}`];
    return data.warnings ?? [];
  } catch {
    return ["Network error"];
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
      stepErrors.push(...err.map((e) => `Website: ${e}`));
    }

    setStep("Analysing social media…");
    const socialErr = await postStep("/api/audit/social", body);
    stepErrors.push(...socialErr.map((e) => `Social: ${e}`));

    setStep("Checking ads & reach…");
    const adsErr = await postStep("/api/audit/ads", body);
    stepErrors.push(...adsErr.map((e) => `Ads: ${e}`));

    setStep("Finding competitors…");
    const compErr = await postStep("/api/audit/competitors", body);
    stepErrors.push(...compErr.map((e) => `Competitors: ${e}`));

    setStep("Computing score…");
    const scoreErr = await postStep("/api/score", body);
    stepErrors.push(...scoreErr.map((e) => `Score: ${e}`));

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
