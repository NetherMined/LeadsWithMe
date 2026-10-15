import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
  );
}

export function getAuthUrl(client: ReturnType<typeof getGoogleOAuth2Client>): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

export async function exchangeCodeForTokens(
  client: ReturnType<typeof getGoogleOAuth2Client>,
  code: string
) {
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getValidGoogleToken(userId: string): Promise<string> {
  const { data, error } = await adminClient
    .from("user_google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("No Google token found. Please sign in again.");
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();
  const BUFFER_MS = 5 * 60 * 1000; // 5 min buffer

  if (expiresAt - now > BUFFER_MS) {
    return data.access_token;
  }

  // Token expired — refresh
  if (!data.refresh_token) {
    throw new Error("Google Drive not connected. Please reconnect in Account Settings.");
  }
  const refreshed = await refreshGoogleToken(data.refresh_token);
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();

  await adminClient
    .from("user_google_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.access_token!;
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string | null | undefined;
  expires_in: number | null | undefined;
}> {
  const client = getGoogleOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return { access_token: credentials.access_token, expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600 };
}

export async function revokeGoogleAccess(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_google_tokens")
    .select("access_token")
    .eq("user_id", userId)
    .single();

  if (data?.access_token) {
    const client = getGoogleOAuth2Client();
    try {
      await client.revokeToken(data.access_token);
    } catch {
      // Token may already be invalid — continue with DB cleanup
    }
  }

  await adminClient.from("user_google_tokens").delete().eq("user_id", userId);
}
