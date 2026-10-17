import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { proposalDemos } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries";
import { ACTIVE_STATUSES } from "@/lib/proposal/build";

const Body = z.object({
  businessId: z.string().uuid(),
  // Version to attach the demo to. Without it a new version is created.
  versionId: z.string().uuid().optional(),
  html: z.string().max(2_000_000).optional(),
  demoSiteUrl: z.string().url().optional(),
}).refine(d => d.html || d.demoSiteUrl, {
  message: "Either html or demoSiteUrl is required",
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { businessId, versionId, html, demoSiteUrl } = parsed.data;

    const business = await getBusinessById(businessId, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const update: { html?: string; demo_site_url?: string } = {};
    if (html !== undefined) update.html = html;
    if (demoSiteUrl !== undefined) update.demo_site_url = demoSiteUrl;

    if (versionId) {
      const [version] = await db
        .select({ status: proposalDemos.status })
        .from(proposalDemos)
        .where(and(eq(proposalDemos.id, versionId), eq(proposalDemos.business_id, businessId), eq(proposalDemos.user_id, user.id)))
        .limit(1);
      if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
      if ((ACTIVE_STATUSES as readonly string[]).includes(version.status)) {
        return NextResponse.json({ error: "This version is still building" }, { status: 409 });
      }

      await db
        .update(proposalDemos)
        .set(update)
        .where(and(eq(proposalDemos.id, versionId), eq(proposalDemos.user_id, user.id)));
      return NextResponse.json({ ok: true, versionId });
    }

    const [row] = await db
      .insert(proposalDemos)
      .values({ business_id: businessId, user_id: user.id, status: "ready", ...update })
      .returning({ id: proposalDemos.id });
    return NextResponse.json({ ok: true, versionId: row.id });
  } catch (err) {
    console.error("[DemoUpload] error", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
