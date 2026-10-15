// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

const DEV_USER = {
  id: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "14e6c02a-b318-4c6f-ba2f-4d4323718ea4",
  email: "dev@localhost",
  user_metadata: { full_name: "Dev User" },
} as unknown as User;

/**
 * Returns the authenticated user, or a mock dev user when NEXT_PUBLIC_DISABLE_AUTH=true.
 * Use this instead of supabase.auth.getUser() in server-side code.
 */
export async function getAuthUser(): Promise<User | null> {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") return DEV_USER;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
};

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS, server-side only
export const createAdminClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
