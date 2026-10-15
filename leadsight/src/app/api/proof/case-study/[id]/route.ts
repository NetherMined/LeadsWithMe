import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: business_id } = await params;
  const adminClient = createAdminClient();

  const [businessRes, snapshotsRes, pipelineRes] = await Promise.all([
    adminClient
      .from("businesses")
      .select("name, category, website, address_city")
      .eq("id", business_id)
      .eq("user_id", user.id)
      .single(),
    adminClient
      .from("proof_snapshots")
      .select("*")
      .eq("business_id", business_id)
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false }),
    adminClient
      .from("outreach_pipeline")
      .select("won_amount, outcome_notes, status")
      .eq("business_id", business_id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (businessRes.error || !businessRes.data) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const snapshots = snapshotsRes.data ?? [];
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
    business: businessRes.data,
    before,
    after,
    deltas,
    won_amount: pipelineRes.data?.won_amount ?? null,
    outcome_notes: pipelineRes.data?.outcome_notes ?? null,
    pipeline_status: pipelineRes.data?.status ?? null,
  });
}
