"use client";

import type { IdentifiedIssue } from "@/types/outreach";
import { Badge } from "@/components/ui/badge";

interface IssueRankerProps {
  issues: IdentifiedIssue[];
}

function SeverityBadge({ severity }: { severity: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (severity === "critical") {
    variant = "destructive";
  } else if (severity === "high") {
    variant = "default";
  }

  return (
    <Badge variant={variant} className="capitalize">
      {severity}
    </Badge>
  );
}

export function IssueRanker({ issues }: IssueRankerProps) {
  // Display top 3 issues sorted by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...issues].sort(
    (a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]
  );
  const topIssues = sorted.slice(0, 3);

  if (topIssues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No critical issues found — this business may not be a priority target
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Top Issues</h3>
      <div className="space-y-2">
        {topIssues.map((issue, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-foreground">{issue.type}</h4>
              <SeverityBadge severity={issue.severity} />
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{issue.description}</p>
            <p className="text-xs font-mono text-secondary-foreground">Fix estimate: {issue.fix_estimate}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
