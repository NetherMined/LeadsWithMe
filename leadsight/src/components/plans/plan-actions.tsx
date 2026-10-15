"use client";

interface PlanActionsProps {
  planId: string;
}

export function PlanActions({ planId }: PlanActionsProps) {
  return (
    <div className="flex gap-2">
      <button className="px-4 py-2 border rounded">Export to Docs</button>
      <button className="px-4 py-2 border rounded">Export to Sheets</button>
    </div>
  );
}
