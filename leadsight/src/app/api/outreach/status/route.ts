import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const businessId = searchParams.get("business_id");

  if (!businessId) {
    return NextResponse.json({ error: "Missing business_id" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Fetch latest outreach assets
  const { data: assets, error: assetsError } = await adminClient
    .from("outreach_assets")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (assetsError && assetsError.code !== "PGRST116") {
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  if (!assets) {
    // Check if there are any audits
    const [websiteRes, socialRes, adsRes] = await Promise.all([
      adminClient.from("website_audits").select("id").eq("business_id", businessId).limit(1),
      adminClient.from("social_audits").select("id").eq("business_id", businessId).limit(1),
      adminClient.from("ads_audits").select("id").eq("business_id", businessId).limit(1),
    ]);

    const hasAudits = (websiteRes.data?.length ?? 0) > 0 || (socialRes.data?.length ?? 0) > 0 || (adsRes.data?.length ?? 0) > 0;

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
}
