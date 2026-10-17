import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { proposalDemos } from "@/lib/db/schema";
import { getFullBusinessProfile } from "@/lib/db/queries";
import { generateWebsiteProposal } from "@/lib/proposal/generate";

export const maxDuration = 240;

const schema = z.object({ business_id: z.string().uuid() });

/**
 * POST /api/audit/website-proposal — writes the proposal .md only (no demo) and saves it
 * as a proposal version. The full proposal → demo → screenshots flow is /api/proposal/builds.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getFullBusinessProfile(business_id, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { markdown, filename } = await generateWebsiteProposal({
      business: profile.business,
      websiteAudit: profile.websiteAudit,
      score: profile.score,
    });

    const [row] = await db
      .insert(proposalDemos)
      .values({
        business_id,
        user_id: user.id,
        proposal_md: markdown,
        status: "ready",
        finished_at: new Date().toISOString(),
      })
      .returning({ id: proposalDemos.id });

    return NextResponse.json({ markdown, filename, versionId: row.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    console.error("[WebsiteProposal] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }
}
