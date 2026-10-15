import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { proposalDemos } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries";

const Body = z.object({
  businessId: z.string().uuid(),
  html: z.string().optional(),
  demoSiteUrl: z.string().url().optional(),
}).refine(d => d.html || d.demoSiteUrl, {
  message: "Either html or demoSiteUrl is required",
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { businessId, html, demoSiteUrl } = parsed.data;

    // Verify business belongs to user
    const business = await getBusinessById(businessId, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Upsert: check if a row already exists for this business
    const [existing] = await db
      .select({ id: proposalDemos.id })
      .from(proposalDemos)
      .where(and(eq(proposalDemos.business_id, businessId), eq(proposalDemos.user_id, user.id)))
      .orderBy(desc(proposalDemos.created_at))
      .limit(1);

    if (existing) {
      const update: { html?: string; demo_site_url?: string } = {};
      if (html !== undefined) update.html = html;
      if (demoSiteUrl !== undefined) update.demo_site_url = demoSiteUrl;

      try {
        await db
          .update(proposalDemos)
          .set(update)
          .where(and(eq(proposalDemos.id, existing.id), eq(proposalDemos.user_id, user.id)));
      } catch (updErr) {
        console.error("[DemoUpload] update failed", updErr);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
      }
    } else {
      try {
        await db.insert(proposalDemos).values({
          business_id: businessId,
          user_id: user.id,
          html: html ?? null,
          demo_site_url: demoSiteUrl ?? null,
        });
      } catch (insErr) {
        console.error("[DemoUpload] insert failed", insErr);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DemoUpload] error", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
