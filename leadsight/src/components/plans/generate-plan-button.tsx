"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GeneratePlanButtonProps {
  businessId: string;
}

export function GeneratePlanButton({ businessId }: GeneratePlanButtonProps) {
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGenerate() {
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });
      const data = await res.json() as { plan?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/plans/${data.plan!.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleGenerate}
        disabled={status === "generating"}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "generating" ? "Generating plan..." : "Generate Plan"}
      </button>
      {error && <p className="text-xs text-red-500 text-right">{error}</p>}
    </div>
  );
}
