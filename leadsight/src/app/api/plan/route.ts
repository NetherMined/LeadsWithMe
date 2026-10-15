import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getFullBusinessProfile } from "@/lib/supabase/queries";
import { buildPlanPrompt } from "@/lib/ai/prompts";
import { generateCompletion } from "@/lib/ai/client";
import { parsePlanResponse } from "@/lib/ai/parser";
import { trackApiUsage } from "@/lib/usage/track";

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

    // Fetch full profile
    const profile = await getFullBusinessProfile(business_id);

    // Build prompt
    const { system, user: userPrompt } = buildPlanPrompt(profile);
    // Generate
    const result = await generateCompletion(system, userPrompt, { maxTokens: 6000 });

    // Track usage (awaited so it completes before response is sent)
    await trackApiUsage({
      userId: user.id,
      service: result.model.startsWith("pollinations") ? "pollinations" : "anthropic",
      operation: "completion",
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
    });

    // Parse
    const plan = parsePlanResponse(result.text, business_id, result.model);

    // Store in DB
    const { data: saved, error } = await adminClient
      .from("marketing_plans")
      .upsert({
        business_id: plan.business_id,
        executive_summary: plan.executive_summary,
        website_recommendations: plan.website_recommendations,
        social_recommendations: plan.social_recommendations,
        advertising_recommendations: plan.advertising_recommendations,
        quick_wins: plan.quick_wins,
        medium_term: plan.medium_term,
        long_term: plan.long_term,
        outreach_email_draft: plan.outreach_email_draft,
        model_used: plan.model_used,
      }, { onConflict: "business_id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ plan: saved });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Plan generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Plan generation failed" },
      { status: 500 }
    );
  }
}
