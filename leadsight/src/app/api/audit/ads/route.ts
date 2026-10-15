import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkMetaAds, checkGoogleAds, estimateDomainAuthority } from "@/lib/scraper/ads";
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
      .select("id, name, website")
      .eq("id", business_id)
      .single();

    if (error || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const b = business as Pick<Business, "id" | "name" | "website">;
    const domain = b.website ? new URL(b.website.startsWith("http") ? b.website : `https://${b.website}`).hostname : "";

    // Run all checks in parallel
    const [metaResult, googleResult, daResult] = await Promise.all([
      checkMetaAds(b.name),
      b.website ? checkGoogleAds(b.website) : Promise.resolve({ has_google_ads: false, detection_method: "no_website" }),
      domain ? estimateDomainAuthority(domain) : Promise.resolve({ domain_authority: null, backlink_estimate: null, indexed_pages_estimate: null }),
    ]);

    const auditData = {
      business_id,
      has_meta_ads: metaResult.has_active_ads,
      meta_ad_count: metaResult.active_ad_count,
      meta_ad_categories: metaResult.ad_categories,
      has_google_ads: googleResult.has_google_ads,
      has_remarketing_pixel: googleResult.detection_method === "remarketing_pixel",
      domain_authority: daResult.domain_authority,
      backlink_estimate: daResult.backlink_estimate,
    };

    const { data: audit, error: upsertError } = await adminClient
      .from("ads_audits")
      .upsert(auditData, { onConflict: "business_id" })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ audit, detectionMethod: googleResult.detection_method });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Ads audit error:", error);
    return NextResponse.json({ error: "Ads audit failed" }, { status: 500 });
  }
}
