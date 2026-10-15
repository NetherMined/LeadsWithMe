import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("Code exchange error:", error);
    return NextResponse.redirect(`${origin}/login?error=code_exchange_failed`);
  }

  // Store Google OAuth tokens if present
  if (data.session.provider_token && data.session.user) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const expiresAt = data.session.expires_at
      ? new Date(data.session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    await admin.from("user_google_tokens").upsert(
      {
        user_id: data.session.user.id,
        access_token: data.session.provider_token,
        refresh_token: data.session.provider_refresh_token ?? "",
        expires_at: expiresAt,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/drive.file",
        ],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.redirect(`${origin}/search`);
}
