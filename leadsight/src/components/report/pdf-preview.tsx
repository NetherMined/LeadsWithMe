// src/components/report/pdf-preview.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface PDFPreviewProps {
  url: string;
  fileName?: string;
  onClose: () => void;
}

export function PDFPreview({ url, fileName = "leadsight-report.pdf", onClose }: PDFPreviewProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-red-500">📋</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">PDF Report</p>
              <p className="text-xs text-gray-400 font-mono">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={fileName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div className="relative flex-1 overflow-hidden rounded-b-xl bg-gray-100">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                <p className="text-sm text-gray-500">Loading PDF preview...</p>
              </div>
            </div>
          )}
          <iframe
            src={`${url}#toolbar=1&navpanes=1`}
            className="h-full w-full"
            onLoad={() => setLoaded(true)}
            title="PDF Report Preview"
          />
        </div>
      </div>
    </div>
  );
}
