"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FollowupData {
  id: string;
  business_id: string;
}

export function FollowupReminder() {
  const [followups, setFollowups] = useState<FollowupData[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFollowups = async () => {
      try {
        const response = await fetch("/api/outreach/followups");
        if (!response.ok) throw new Error("Failed to fetch followups");
        const data = await response.json();
        setFollowups(data || []);
      } catch (error) {
        console.error("Error fetching followups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowups();
  }, []);

  if (isLoading || isDismissed || followups.length === 0) {
    return null;
  }

  const count = followups.length;
  const plural = count !== 1 ? "s" : "";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
      <div className="text-sm text-amber-900">
        You have{" "}
        <span className="font-semibold">
          {count} follow-up{plural}
        </span>{" "}
        due. Review them in the pipeline below.
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsDismissed(true)}
        className="h-6 w-6"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
