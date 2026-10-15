import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client used by data queries until they move to Drizzle in Phase 3.
// Auth now lives in @/lib/auth (Better Auth).
export const createAdminClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
