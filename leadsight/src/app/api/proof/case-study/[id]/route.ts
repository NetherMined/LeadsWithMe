import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { outreachPipeline, proofSnapshots } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: business_id } = await params;

    const business = await getBusinessById(business_id, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const [snapshots, [pipeline]] = await Promise.all([
      db
        .select()
        .from(proofSnapshots)
        .where(and(eq(proofSnapshots.business_id, business_id), eq(proofSnapshots.user_id, user.id)))
        .orderBy(desc(proofSnapshots.captured_at)),
      db
        .select({
          won_amount: outreachPipeline.won_amount,
          outcome_notes: outreachPipeline.outcome_notes,
          status: outreachPipeline.status,
        })
        .from(outreachPipeline)
        .where(and(eq(outreachPipeline.business_id, business_id), eq(outreachPipeline.user_id, user.id)))
        .limit(1),
    ]);

    const before = snapshots.find((s) => s.phase === "before") ?? null;
    const after = snapshots.find((s) => s.phase === "after") ?? null;

    const deltas =
      before && after
        ? {
            pagespeed_mobile_delta: (after.pagespeed_mobile ?? 0) - (before.pagespeed_mobile ?? 0),
            pagespeed_desktop_delta: (after.pagespeed_desktop ?? 0) - (before.pagespeed_desktop ?? 0),
            seo_score_delta: (after.seo_score ?? 0) - (before.seo_score ?? 0),
            accessibility_score_delta: (after.accessibility_score ?? 0) - (before.accessibility_score ?? 0),
          }
        : null;

    return NextResponse.json({
      business: {
        name: business.name,
        category: business.category,
        website: business.website,
        address_city: business.address_city,
      },
      before,
      after,
      deltas,
      won_amount: pipeline?.won_amount ?? null,
      outcome_notes: pipeline?.outcome_notes ?? null,
      pipeline_status: pipeline?.status ?? null,
    });
  } catch (error) {
    console.error("[Case Study GET] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load case study" },
      { status: 500 }
    );
  }
}
