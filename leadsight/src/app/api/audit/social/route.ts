import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { buildChannelsFromLinks, calculateSocialScores } from "@/lib/scraper/social";
import type { Business } from "@/types/business";

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

    const { data: business, error } = await adminClient
      .from("businesses")
      .select("id, social_links, category")
      .eq("id", business_id)
      .single();

    if (error || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const b = business as Pick<Business, "id" | "social_links" | "category">;
    const channels = buildChannelsFromLinks(b.social_links);
    const scores = calculateSocialScores(channels, b.category);

    const auditData = {
      business_id,
      channels,
      platform_coverage_score: scores.platformCoverageScore,
      engagement_score: scores.engagementScore,
      missing_platforms: scores.missingPlatforms,
    };

    const { data: audit, error: upsertError } = await adminClient
      .from("social_audits")
      .upsert(auditData, { onConflict: "business_id" })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ audit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Social audit error:", error);
    return NextResponse.json({ error: "Social audit failed" }, { status: 500 });
  }
}
