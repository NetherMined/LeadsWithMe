import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { exportLeadsToSheet } from "@/lib/google/sheets";
import { getOrCreateLeadSightFolder, moveFileToFolder } from "@/lib/google/drive";
import { getValidGoogleToken } from "@/lib/google/auth";
import type { Business } from "@/types/business";
import type { DigitalPresenceScore } from "@/types/score";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({ business_ids: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_ids } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch businesses + scores in parallel (scoped to user)
    const [businessesRes, scoresRes] = await Promise.all([
      adminClient.from("businesses").select("*").in("id", business_ids).eq("user_id", user.id),
      adminClient.from("scores").select("*").in("business_id", business_ids),
    ]);

    const businesses = (businessesRes.data ?? []) as Business[];
    const scores = (scoresRes.data ?? []) as DigitalPresenceScore[];
    const scoreMap = new Map(scores.map(s => [s.business_id, s]));

    const businessesWithScores = businesses.map(b => ({
      ...b,
      score: scoreMap.get(b.id) ?? null,
    }));

    // Get valid Google token
    const accessToken = await getValidGoogleToken(user.id);

    // Export to Sheets and move to Drive folder
    const [sheetResult, folderId] = await Promise.all([
      exportLeadsToSheet(accessToken, businessesWithScores),
      getOrCreateLeadSightFolder(accessToken),
    ]);

    await moveFileToFolder(accessToken, sheetResult.spreadsheetId, folderId);

    // Record export
    await adminClient.from("exports").insert({
      user_id: user.id,
      type: "sheets",
      google_file_id: sheetResult.spreadsheetId,
      google_file_url: sheetResult.spreadsheetUrl,
      business_ids,
    });

    return NextResponse.json({ url: sheetResult.spreadsheetUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Sheets export error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
