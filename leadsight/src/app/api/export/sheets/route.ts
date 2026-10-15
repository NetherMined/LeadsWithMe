import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses, exports, scores } from "@/lib/db/schema";
import { exportLeadsToSheet } from "@/lib/google/sheets";
import { getOrCreateLeadSightFolder, moveFileToFolder } from "@/lib/google/drive";
import { getValidGoogleToken } from "@/lib/google/auth";
import type { Business } from "@/types/business";
import type { DigitalPresenceScore } from "@/types/score";

const schema = z.object({ business_ids: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_ids } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch businesses + scores in parallel (businesses scoped to user)
    const [businessRows, scoreRows] = await Promise.all([
      db
        .select()
        .from(businesses)
        .where(and(inArray(businesses.id, business_ids), eq(businesses.user_id, user.id))),
      db.select().from(scores).where(inArray(scores.business_id, business_ids)),
    ]);

    const businessList = businessRows as unknown as Business[];
    const scoreList = scoreRows as unknown as DigitalPresenceScore[];
    const scoreMap = new Map(scoreList.map(s => [s.business_id, s]));

    const businessesWithScores = businessList.map(b => ({
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

    // The Google file already exists; a failed history row must not hide its URL from the user.
    await db.insert(exports).values({
      user_id: user.id,
      type: "sheets",
      google_file_id: sheetResult.spreadsheetId,
      google_file_url: sheetResult.spreadsheetUrl,
      business_ids,
    }).catch((err) => console.error("[export/sheets] failed to record export:", err));

    return NextResponse.json({ url: sheetResult.spreadsheetUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Sheets export error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
