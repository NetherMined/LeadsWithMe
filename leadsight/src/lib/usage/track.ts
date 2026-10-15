import { db } from "@/lib/db/client";
import { apiUsage } from "@/lib/db/schema";
import { isUuid } from "@/lib/db/queries";
import { estimateCost } from "./costs";

export interface UsageEvent {
  userId: string;
  service: string;
  operation: string;
  tokensInput?: number;
  tokensOutput?: number;
  metadata?: Record<string, unknown>;
}

/** Inserts a usage row. Returns a promise (await when response timing matters). */
export async function trackApiUsage(event: UsageEvent): Promise<void> {
  const cost = estimateCost(
    event.service,
    event.operation,
    event.tokensInput,
    event.tokensOutput,
  );

  // api_usage.user_id is a uuid FK; skip rows we cannot attribute rather than fail the insert.
  if (!isUuid(event.userId)) return;

  try {
    await db
      .insert(apiUsage)
      .values({
        user_id:        event.userId,
        service:        event.service,
        operation:      event.operation,
        estimated_cost: cost,
        tokens_input:   event.tokensInput ?? null,
        tokens_output:  event.tokensOutput ?? null,
        metadata:       event.metadata ?? {},
      });
  } catch (err) {
    // Usage tracking must never break the request it is measuring.
    console.error("[trackApiUsage] insert failed:", err);
  }
}
