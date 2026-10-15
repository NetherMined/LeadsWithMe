import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { calculateDigitalPresenceScore } from "@/lib/scoring/engine";
import { getBusinessById, upsertScore } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { websiteAudits, socialAudits, adsAudits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Business } from "@/types/business";
import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";

const schema = z.object({ business_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getBusinessById(business_id, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Fetch audits in parallel (business_id is UNIQUE on each audit table)
    const [[websiteRow], [socialRow], [adsRow]] = await Promise.all([
      db.select().from(websiteAudits).where(eq(websiteAudits.business_id, business_id)).limit(1),
      db.select().from(socialAudits).where(eq(socialAudits.business_id, business_id)).limit(1),
      db.select().from(adsAudits).where(eq(adsAudits.business_id, business_id)).limit(1),
    ]);

    const websiteAudit = (websiteRow as unknown as WebsiteAudit) ?? null;
    const socialAudit = (socialRow as unknown as SocialAudit) ?? null;
    const adsAudit = (adsRow as unknown as AdsAudit) ?? null;

    const score = calculateDigitalPresenceScore(
      business_id,
      websiteAudit,
      socialAudit,
      adsAudit,
      business.rating,
      business.review_count
    );

    const upserted = await upsertScore({
      business_id: score.business_id,
      total_score: score.total_score,
      grade: score.grade,
      label: score.label,
      website_score: score.website_score,
      social_score: score.social_score,
      engagement_score: score.engagement_score,
      advertising_score: score.advertising_score,
      reviews_score: score.reviews_score,
    });

    return NextResponse.json({ score: upserted });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Scoring error:", error);
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}
