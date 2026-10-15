import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser, createAdminClient } from "@/lib/supabase/server";
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

  const { business_id, phase, notes } = parsed.data;

  const adminClient = createAdminClient();

  const { data: business, error: bizError } = await adminClient
    .from("businesses")
    .select("name, website")
    .eq("id", business_id)
    .eq("user_id", user.id)
    .single();

  if (bizError || !business) {
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

  const { data, error } = await adminClient
    .from("proof_snapshots")
    .insert({
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
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
