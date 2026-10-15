import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import {
  businesses,
  websiteAudits,
  socialAudits,
  adsAudits,
  scores,
  marketingPlans,
  outreachAssets,
  outreachPipeline,
  proofSnapshots,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["leads", "plans"]),
});

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const { type } = parsed.data;

    // Audit and score tables have no user_id, so they are scoped through the caller's businesses.
    const userBusinessIds = () =>
      db.select({ id: businesses.id }).from(businesses).where(eq(businesses.user_id, user.id));

    if (type === "leads") {
      const targets: { table: string; run: () => PromiseLike<unknown> }[] = [
        { table: "outreach_assets", run: () => db.delete(outreachAssets).where(eq(outreachAssets.user_id, user.id)) },
        { table: "outreach_pipeline", run: () => db.delete(outreachPipeline).where(eq(outreachPipeline.user_id, user.id)) },
        { table: "proof_snapshots", run: () => db.delete(proofSnapshots).where(eq(proofSnapshots.user_id, user.id)) },
        { table: "scores", run: () => db.delete(scores).where(inArray(scores.business_id, userBusinessIds())) },
        { table: "website_audits", run: () => db.delete(websiteAudits).where(inArray(websiteAudits.business_id, userBusinessIds())) },
        { table: "social_audits", run: () => db.delete(socialAudits).where(inArray(socialAudits.business_id, userBusinessIds())) },
        { table: "ads_audits", run: () => db.delete(adsAudits).where(inArray(adsAudits.business_id, userBusinessIds())) },
        { table: "businesses", run: () => db.delete(businesses).where(eq(businesses.user_id, user.id)) },
      ];

      const errors: string[] = [];
      for (const target of targets) {
        try {
          await target.run();
        } catch (error) {
          console.error("Delete records failed for", target.table, error);
          errors.push(`${target.table}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }

      if (errors.length > 0) {
        return NextResponse.json({ error: "Some deletions failed", details: errors }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "All your lead records deleted" });
    }

    if (type === "plans") {
      await db.delete(marketingPlans).where(eq(marketingPlans.user_id, user.id));
      return NextResponse.json({ success: true, message: "All your plan records deleted" });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Delete records error:", error);
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }
}
