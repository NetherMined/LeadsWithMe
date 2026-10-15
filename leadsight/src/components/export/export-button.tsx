// src/components/export/export-button.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  businessId?: string;
  businessIds?: string[];
  planId?: string;
  onSuccess?: (url: string) => void;
}

type ExportType = "sheets" | "docs" | "pdf";

type PDFStep = "capturing" | "analysing" | "generating" | "building" | null;

const PDF_STEPS: PDFStep[] = ["capturing", "analysing", "generating", "building"];

const PDF_STEP_LABELS: Record<NonNullable<PDFStep>, string> = {
  capturing: "Capturing screenshots...",
  analysing: "Analysing competitor...",
  generating: "Generating A/B tests...",
  building: "Building PDF report...",
};

export function ExportButton({ businessId, businessIds, planId, onSuccess }: ExportButtonProps) {
  const [loading, setLoading] = useState<ExportType | null>(null);
  const [open, setOpen] = useState(false);
  const [pdfStep, setPdfStep] = useState<PDFStep>(null);
  const [pdfResult, setPdfResult] = useState<{ url: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(type: "sheets" | "docs") {
    setLoading(type);
    setOpen(false);
    setError(null);
    try {
      const body = type === "sheets"
        ? { business_ids: businessIds ?? (businessId ? [businessId] : []) }
        : { plan_id: planId };

      const res = await fetch(`/api/export/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      if (onSuccess && data.url) onSuccess(data.url);
      if (data.url) window.open(data.url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(null);
    }
  }

  async function handlePDFExport() {
    if (!businessId && (!businessIds || businessIds.length === 0)) return;
    const bizId = businessId ?? businessIds![0];
    setLoading("pdf");
    setOpen(false);
    setError(null);
    setPdfResult(null);

    // Simulate progress steps (real progress comes from server timing)
    let stepIdx = 0;
    setPdfStep(PDF_STEPS[0]);
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, PDF_STEPS.length - 1);
      setPdfStep(PDF_STEPS[stepIdx]);
    }, 8000);

    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: bizId, include_competitor: true }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "PDF generation failed");
      }

      // Get filename from Content-Disposition header
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const nameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = nameMatch?.[1] ?? "leadsight-report.pdf";

      // Download PDF blob directly
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      clearInterval(stepInterval);
      setPdfStep(null);
      setPdfResult({ url: blobUrl, fileName });
      if (onSuccess) onSuccess(blobUrl);

      // Auto-download
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.click();
    } catch (err) {
      clearInterval(stepInterval);
      setPdfStep(null);
      setError(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setLoading(null);
    }
  }

  const hasBusiness = !!(businessId || (businessIds && businessIds.length > 0));
  const isLoading = !!loading;

  return (
    <div className="relative">
      {/* Main export button */}
      <button
        onClick={() => { setOpen(o => !o); setError(null); }}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isLoading && loading !== "pdf" ? `Exporting to ${loading}...` : "Export"}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border bg-white shadow-lg">
          {hasBusiness && (
            <button
              onClick={() => handleExport("sheets")}
              disabled={isLoading}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="text-green-600">📊</span> Export to Sheets
            </button>
          )}
          {planId && (
            <button
              onClick={() => handleExport("docs")}
              disabled={isLoading}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="text-blue-600">📄</span> Export to Docs
            </button>
          )}
          {hasBusiness && (
            <>
              {(planId || hasBusiness) && <div className="my-1 border-t border-gray-100" />}
              <button
                onClick={handlePDFExport}
                disabled={isLoading}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="text-red-500">📋</span>
                <div className="text-left">
                  <div className="font-medium">Download PDF Report</div>
                  <div className="text-xs text-gray-400">With competitor analysis + A/B tests</div>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {/* PDF progress overlay */}
      {loading === "pdf" && pdfStep && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-teal-200 bg-white p-4 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-sm font-medium text-gray-700">Generating PDF Report</span>
          </div>
          <div className="space-y-1.5">
            {PDF_STEPS.map((step, idx) => {
              const currentIdx = PDF_STEPS.indexOf(pdfStep);
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <div key={step} className={`flex items-center gap-2 text-xs ${done ? "text-teal-600" : active ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                  {done ? (
                    <svg className="h-3.5 w-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : active ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border border-teal-500 border-t-transparent" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-gray-300" />
                  )}
                  {step ? PDF_STEP_LABELS[step] : ""}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">This may take up to 60 seconds</p>
        </div>
      )}

      {/* Success state */}
      {pdfResult && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-green-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">PDF Report Ready!</p>
              <p className="text-xs text-gray-400 mt-0.5">Download started automatically</p>
              <div className="flex gap-2 mt-2">
                <a
                  href={pdfResult.url}
                  download={pdfResult.fileName}
                  className="text-xs text-teal-600 hover:underline"
                >
                  Download again
                </a>
              </div>
            </div>
            <button
              onClick={() => setPdfResult(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-red-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Export Failed</p>
              <p className="text-xs text-gray-500 mt-0.5">{error}</p>
              <button
                onClick={() => { setError(null); if (loading === null) handlePDFExport(); }}
                className="mt-2 text-xs text-teal-600 hover:underline"
              >
                Retry
              </button>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
