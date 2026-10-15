"use client";

import { useState } from "react";
import type { LoomScript } from "@/types/outreach";
import { Button } from "@/components/ui/button";

interface LoomScriptViewerProps {
  script: LoomScript;
}

interface ScriptSection {
  label: string;
  duration: string;
  content: string;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error("Failed to copy:", err);
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function LoomScriptViewer({ script }: LoomScriptViewerProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const sections: ScriptSection[] = [
    { label: "Hook", duration: "10s", content: script.hook },
    { label: "Problem 1", duration: "25s", content: script.problem_1 },
    { label: "Problem 2", duration: "25s", content: script.problem_2 },
    { label: "Close", duration: "25s", content: script.close },
  ];

  const handleCopySection = (index: number, text: string) => {
    copyToClipboard(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    const fullScript = sections.map(s => s.content).join("\n\n");
    copyToClipboard(fullScript);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Loom Script (85 seconds total)</h3>

      <div className="space-y-3">
        {sections.map((section, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{section.label}</h4>
                <p className="text-xs text-muted-foreground">{section.duration} • {countWords(section.content)} words</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopySection(idx, section.content)}
                className="h-8 px-2 text-xs"
              >
                {copiedIndex === idx ? "Copied!" : "Copy"}
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-secondary-foreground">{section.content}</p>
          </div>
        ))}
      </div>

      <Button
        onClick={handleCopyAll}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {copiedAll ? "✓ Copied Full Script" : "Copy All Sections"}
      </Button>
    </div>
  );
}
