import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, getTableColumns } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses, exports, marketingPlans } from "@/lib/db/schema";
import { exportPlanToDoc } from "@/lib/google/docs";
import { getOrCreateLeadSightFolder, moveFileToFolder } from "@/lib/google/drive";
import { getValidGoogleToken } from "@/lib/google/auth";
import type { Business } from "@/types/business";
import type { MarketingPlan } from "@/types/plan";

const schema = z.object({ plan_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch plan + business (scoped to user)
    const [plan] = await db
      .select({ ...getTableColumns(marketingPlans), businesses: getTableColumns(businesses) })
      .from(marketingPlans)
      .innerJoin(businesses, eq(businesses.id, marketingPlans.business_id))
      .where(and(eq(marketingPlans.id, plan_id), eq(marketingPlans.user_id, user.id)))
      .limit(1);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const typedPlan = plan as unknown as MarketingPlan & { businesses: Business };
    const accessToken = await getValidGoogleToken(user.id);

    const [docResult, folderId] = await Promise.all([
      exportPlanToDoc(accessToken, typedPlan, typedPlan.businesses),
      getOrCreateLeadSightFolder(accessToken),
    ]);

    await moveFileToFolder(accessToken, docResult.documentId, folderId);

    // The Google file already exists; a failed history row must not hide its URL from the user.
    await db.insert(exports).values({
      user_id: user.id,
      type: "docs",
      google_file_id: docResult.documentId,
      google_file_url: docResult.documentUrl,
      business_ids: [typedPlan.business_id],
    }).catch((err) => console.error("[export/docs] failed to record export:", err));

    return NextResponse.json({ url: docResult.documentUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Docs export error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
