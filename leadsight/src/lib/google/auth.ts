import "server-only";
import { and, eq } from "drizzle-orm";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";

export function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
}

async function findGoogleAccountId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Returns a valid Google access token for the user's Sheets/Docs/Drive calls.
 * Better Auth decrypts the stored token and refreshes it when it is near expiry.
 */
export async function getValidGoogleToken(userId: string): Promise<string> {
  const accountId = await findGoogleAccountId(userId);
  if (!accountId) {
    throw new Error("No Google account linked. Please sign in with Google again.");
  }

  try {
    const tokens = await auth.api.getAccessToken({ body: { accountId, userId } });
    if (!tokens?.accessToken) throw new Error("empty access token");
    return tokens.accessToken;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Google access expired or was revoked (${msg}). Please sign out and sign in again.`);
  }
}

/** Revokes LeadSight's Google grant and clears the stored tokens (the login link itself stays). */
export async function revokeGoogleAccess(userId: string): Promise<void> {
  try {
    const token = await getValidGoogleToken(userId);
    await getGoogleOAuth2Client().revokeToken(token);
  } catch {
    // Token may already be invalid; continue with DB cleanup
  }

  await db
    .update(accounts)
    .set({ accessToken: null, refreshToken: null, accessTokenExpiresAt: null, updatedAt: new Date() })
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")));
}
