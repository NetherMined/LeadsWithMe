import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { marketingPlans } from "@/lib/db/schema";
import { getFullBusinessProfile } from "@/lib/db/queries";
import { buildPlanPrompt } from "@/lib/ai/prompts";
import { generateCompletion } from "@/lib/ai/client";
import { parsePlanResponse } from "@/lib/ai/parser";
import { trackApiUsage } from "@/lib/usage/track";

export const maxDuration = 120;

const schema = z.object({ business_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch full profile (null when the business is missing or not owned by user)
    const profile = await getFullBusinessProfile(business_id, user.id);
    if (!profile) return NextResponse.json({ error: "Business not found" }, { status: 404 });

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
    const planValues = {
      user_id: user.id,
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
    };
    const [saved] = await db
      .insert(marketingPlans)
      .values(planValues)
      .onConflictDoUpdate({ target: marketingPlans.business_id, set: planValues })
      .returning();

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
