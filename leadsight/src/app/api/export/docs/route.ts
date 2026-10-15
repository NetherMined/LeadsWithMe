import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { exportPlanToDoc } from "@/lib/google/docs";
import { getOrCreateLeadSightFolder, moveFileToFolder } from "@/lib/google/drive";
import { getValidGoogleToken } from "@/lib/google/auth";
import type { Business } from "@/types/business";
import type { MarketingPlan } from "@/types/plan";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({ plan_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch plan + business (scoped to user)
    const { data: plan, error: planError } = await adminClient
      .from("marketing_plans")
      .select("*, businesses(*)")
      .eq("id", plan_id)
      .eq("user_id", user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const typedPlan = plan as MarketingPlan & { businesses: Business };
    const accessToken = await getValidGoogleToken(user.id);

    const [docResult, folderId] = await Promise.all([
      exportPlanToDoc(accessToken, typedPlan, typedPlan.businesses),
      getOrCreateLeadSightFolder(accessToken),
    ]);

    await moveFileToFolder(accessToken, docResult.documentId, folderId);

    await adminClient.from("exports").insert({
      user_id: user.id,
      type: "docs",
      google_file_id: docResult.documentId,
      google_file_url: docResult.documentUrl,
      business_ids: [typedPlan.business_id],
    });

    return NextResponse.json({ url: docResult.documentUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Docs export error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
