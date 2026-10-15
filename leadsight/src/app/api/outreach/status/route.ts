import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { adsAudits, outreachAssets, socialAudits, websiteAudits } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const businessId = searchParams.get("business_id");

  if (!businessId) {
    return NextResponse.json({ error: "Missing business_id" }, { status: 400 });
  }

  try {
    const business = await getBusinessById(businessId, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Fetch latest outreach assets
    const [assets] = await db
      .select()
      .from(outreachAssets)
      .where(and(eq(outreachAssets.business_id, businessId), eq(outreachAssets.user_id, user.id)))
      .orderBy(desc(outreachAssets.created_at))
      .limit(1);

    if (!assets) {
      // Check if there are any audits
      const [[websiteAudit], [socialAudit], [adsAudit]] = await Promise.all([
        db.select({ id: websiteAudits.id }).from(websiteAudits).where(eq(websiteAudits.business_id, businessId)).limit(1),
        db.select({ id: socialAudits.id }).from(socialAudits).where(eq(socialAudits.business_id, businessId)).limit(1),
        db.select({ id: adsAudits.id }).from(adsAudits).where(eq(adsAudits.business_id, businessId)).limit(1),
      ]);

      const hasAudits = Boolean(websiteAudit || socialAudit || adsAudit);

      if (!hasAudits) {
        return NextResponse.json({ error: "no_audit_data", message: "Run website audit first" }, { status: 400 });
      }

      return NextResponse.json({ assets: null });
    }

    // Parse the loom_script JSON if stored as string
    const loomScript = typeof assets.loom_script === "string" ? JSON.parse(assets.loom_script) : assets.loom_script;

    return NextResponse.json({
      assets: {
        id: assets.id,
        loom_script: loomScript,
        email_subject: assets.email_subject,
        email_body: assets.email_body,
        linkedin_connect_note: assets.linkedin_connect_note,
        linkedin_followup: assets.linkedin_followup,
        identified_issues: assets.identified_issues,
        flat_fee_amount: assets.flat_fee_amount,
        flat_fee_currency: assets.flat_fee_currency,
        delivery_days: assets.delivery_days,
      },
    });
  } catch (error) {
    console.error("[Outreach Status GET] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load outreach status" },
      { status: 500 }
    );
  }
}
