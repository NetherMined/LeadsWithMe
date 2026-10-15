import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { getBusinessById } from "@/lib/db/queries";
import { proposalDemos, scores } from "@/lib/db/schema";

// GET /api/businesses/[id]/proposal — digital presence score and latest proposal demo for a business
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const business = await getBusinessById(id, user.id);
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const [score] = await db
      .select()
      .from(scores)
      .where(eq(scores.business_id, business.id))
      .limit(1);

    const [demo] = await db
      .select({ html: proposalDemos.html, proposal_md: proposalDemos.proposal_md })
      .from(proposalDemos)
      .where(and(eq(proposalDemos.business_id, business.id), eq(proposalDemos.user_id, user.id)))
      .orderBy(desc(proposalDemos.created_at))
      .limit(1);

    return NextResponse.json({ score: score ?? null, demo: demo ?? null });
  } catch (err) {
    console.error("Business proposal GET error:", err);
    return NextResponse.json({ error: "Failed to load business proposal data" }, { status: 500 });
  }
}
