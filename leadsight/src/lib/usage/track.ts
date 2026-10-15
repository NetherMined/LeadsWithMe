import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { estimateCost } from "./costs";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  try {
    await adminClient
      .from("api_usage")
      .insert({
        user_id:        event.userId,
        service:        event.service,
        operation:      event.operation,
        estimated_cost: cost,
        tokens_input:   event.tokensInput ?? null,
        tokens_output:  event.tokensOutput ?? null,
        metadata:       event.metadata ?? {},
      });
  } catch { /* silently ignore */ }
}
