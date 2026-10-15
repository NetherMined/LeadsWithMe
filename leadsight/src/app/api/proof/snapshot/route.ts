import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { proofSnapshots } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries";
import { runPageSpeedAudit } from "@/lib/scraper/website";

const schema = z.object({
  business_id: z.string().uuid(),
  phase: z.enum(["before", "after"]),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const { business_id, phase, notes } = parsed.data;

    const business = await getBusinessById(business_id, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let pagespeedMobile: number | null = null;
    let pagespeedDesktop: number | null = null;
    let seoScore: number | null = null;
    let accessibilityScore: number | null = null;
    const screenshotUrl: string | null = null;

    if (business.website) {
      try {
        const result = await runPageSpeedAudit(business.website);
        pagespeedMobile = result?.performanceScore ?? null;
        pagespeedDesktop = null; // API only supports mobile strategy
        seoScore = result?.seoScore ?? null;
        accessibilityScore = result?.accessibilityScore ?? null;
      } catch {
        // PageSpeed failure is non-fatal — snapshot still recorded
      }

    }

    const [data] = await db
      .insert(proofSnapshots)
      .values({
        business_id,
        user_id: user.id,
        phase,
        pagespeed_mobile: pagespeedMobile,
        pagespeed_desktop: pagespeedDesktop,
        seo_score: seoScore,
        accessibility_score: accessibilityScore,
        screenshot_url: screenshotUrl,
        notes: notes ?? null,
        captured_at: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[Proof Snapshot POST] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to capture snapshot" },
      { status: 500 }
    );
  }
}
