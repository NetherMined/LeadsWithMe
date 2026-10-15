"use client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OutreachData } from "@/types/outreach";

interface OutreachSummaryCardProps {
  data: OutreachData;
}

export function OutreachSummaryCard({ data }: OutreachSummaryCardProps) {
  const { status, score, issueCount, priorityScore } = data;

  // Helper to determine color/badge based on status
  const getStatusBadge = () => {
    switch (status) {
      case "not_contacted":
        return "bg-yellow-500/80 text-yellow-100";
      case "contacted":
        return "bg-blue-500/80 text-blue-100";
      case "replied":
        return "bg-green-500/80 text-green-100";
      case "negotiating":
        return "bg-purple-500/80 text-purple-100";
      case "won":
        return "bg-teal-500/80 text-teal-100";
      case "lost":
        return "bg-red-500/80 text-red-100";
      default:
        return "bg-gray-500/80 text-gray-100";
    }
  };

  // Helper for score badge
  const getScoreBadge = (score: number | null) => {
    if (!score) return null;
    let color = "bg-gray-100 text-gray-600";
    if (score >= 80) color = "bg-green-100 text-green-800";
    else if (score >= 60) color = "bg-yellow-100 text-yellow-800";
    else if (score >= 40) color = "bg-blue-100 text-blue-800";
    else color = "bg-red-100 text-red-800";
    return `<Badge class="${cn("text-sm", color)}">${score}</Badge>`;
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-var(--bg-surface) border border-var(--border) rounded-lg shadow-sm">
      <div className="flex justify-between items-center">
        <Badge className="text-sm ${getStatusBadge()}">{status}</Badge>
        {score && getScoreBadge(score) && <div dangerouslySetInnerHTML={{ __html: getScoreBadge(score)! }} />}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {issueCount > 0 && (
          <Badge className="bg-pink-100 text-pink-700">⚠️ {issueCount} Issues</Badge>
        )}
        {priorityScore && (
          <Badge className="bg-indigo-100 text-indigo-700">🎯 {priorityScore.toFixed(1)} Priority</Badge>
        )}
      </div>
    </div>
  );
}