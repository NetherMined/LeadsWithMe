import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const Body = z.object({
  businessId: z.string().uuid(),
  html: z.string().optional(),
  demoSiteUrl: z.string().url().optional(),
}).refine(d => d.html || d.demoSiteUrl, {
  message: "Either html or demoSiteUrl is required",
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { businessId, html, demoSiteUrl } = parsed.data;

  // Verify business belongs to user
  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .single();

  if (bizErr || !biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Upsert: check if a row already exists for this business
  const { data: existing } = await admin
    .from("proposal_demos")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const update: Record<string, string | null> = {};
    if (html !== undefined) update.html = html;
    if (demoSiteUrl !== undefined) update.demo_site_url = demoSiteUrl;

    const { error: updErr } = await admin
      .from("proposal_demos")
      .update(update)
      .eq("id", existing.id);

    if (updErr) {
      console.error("[DemoUpload] update failed", updErr);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  } else {
    const { error: insErr } = await admin
      .from("proposal_demos")
      .insert({
        business_id: businessId,
        user_id: user.id,
        html: html ?? null,
        demo_site_url: demoSiteUrl ?? null,
      });

    if (insErr) {
      console.error("[DemoUpload] insert failed", insErr);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
