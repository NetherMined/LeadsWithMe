import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { calculateDigitalPresenceScore } from "@/lib/scoring/engine";
import type { Business } from "@/types/business";
import type { WebsiteAudit, SocialAudit, AdsAudit } from "@/types/audit";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({ business_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch all data in parallel
    const [businessRes, websiteRes, socialRes, adsRes] = await Promise.all([
      adminClient.from("businesses").select("id, rating, review_count").eq("id", business_id).single(),
      adminClient.from("website_audits").select("*").eq("business_id", business_id).order("created_at", { ascending: false }).limit(1).single(),
      adminClient.from("social_audits").select("*").eq("business_id", business_id).order("created_at", { ascending: false }).limit(1).single(),
      adminClient.from("ads_audits").select("*").eq("business_id", business_id).order("created_at", { ascending: false }).limit(1).single(),
    ]);

    if (businessRes.error || !businessRes.data) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const business = businessRes.data as Pick<Business, "id" | "rating" | "review_count">;
    const websiteAudit = websiteRes.error ? null : websiteRes.data as WebsiteAudit;
    const socialAudit = socialRes.error ? null : socialRes.data as SocialAudit;
    const adsAudit = adsRes.error ? null : adsRes.data as AdsAudit;

    const score = calculateDigitalPresenceScore(
      business_id,
      websiteAudit,
      socialAudit,
      adsAudit,
      business.rating,
      business.review_count
    );

    // Upsert score
    const { data: upserted, error: upsertError } = await adminClient
      .from("scores")
      .upsert({
        business_id: score.business_id,
        total_score: score.total_score,
        grade: score.grade,
        label: score.label,
        website_score: score.website_score,
        social_score: score.social_score,
        engagement_score: score.engagement_score,
        advertising_score: score.advertising_score,
        reviews_score: score.reviews_score,
      }, { onConflict: "business_id" })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ score: upserted });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Scoring error:", error);
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}
