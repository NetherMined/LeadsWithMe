import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateOutreachAssets } from "@/lib/outreach/generator";
import { trackApiUsage } from "@/lib/usage/track";

const schema = z.object({
  business_id: z.string().uuid(),
  positioning_profile: z.string().optional(),
  target_currency: z.string().optional(),
  flat_fee: z.number().optional(),
  delivery_days: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { business_id, positioning_profile, target_currency, flat_fee, delivery_days } = parsed.data;

  const adminClient = createAdminClient();

  const [businessRes, websiteRes, socialRes, adsRes] = await Promise.all([
    adminClient.from("businesses").select("*").eq("id", business_id).eq("user_id", user.id).single(),
    adminClient.from("website_audits").select("*").eq("business_id", business_id).maybeSingle(),
    adminClient.from("social_audits").select("*").eq("business_id", business_id).maybeSingle(),
    adminClient.from("ads_audits").select("*").eq("business_id", business_id).maybeSingle(),
  ]);

  if (businessRes.error || !businessRes.data) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const business = businessRes.data;

  let assets;
  try {
    assets = await generateOutreachAssets({
      businessName: business.name,
      city: business.address_city ?? business.address?.split(",").pop()?.trim() ?? "",
      category: business.category ?? business.search_term ?? "",
      audits: {
        website: websiteRes.data ?? null,
        social: socialRes.data ?? null,
        ads: adsRes.data ?? null,
      },
      positioning: positioning_profile,
      feeAmount: flat_fee,
      feeCurrency: target_currency,
      deliveryDays: delivery_days,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";

    // Check if this is the "no issues found" error (no audit data)
    if (message === "No actionable issues found for this business") {
      return NextResponse.json({ error: "no_audit_data", message: "Run website audit first" }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("outreach_assets")
    .insert({
      business_id,
      user_id: user.id,
      loom_script: JSON.stringify(assets.loom_script),
      email_subject: assets.email_subject,
      email_body: assets.email_body,
      linkedin_connect_note: assets.linkedin_connect_note,
      linkedin_followup: assets.linkedin_followup,
      flat_fee_amount: flat_fee ?? null,
      flat_fee_currency: target_currency ?? "GBP",
      delivery_days: delivery_days ?? 5,
      identified_issues: assets.identified_issues,
    })
    .select()
    .single();

  if (insertError) {
    console.error("outreach_assets insert:", insertError.message);
  }

  await trackApiUsage({
    userId: user.id,
    service: "anthropic",
    operation: "outreach-generation",
  });

  return NextResponse.json({ id: inserted?.id ?? null, ...assets });
}
