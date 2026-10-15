/**
 * app/api/proposal/demo/route.ts
 *
 * POST /api/proposal/demo
 * Body: { businessId: string, proposalMarkdown?: string, screenshots?: boolean }
 *
 * 1. Generates a single-file HTML demo site for the business
 * 2. (optional) Screenshots it desktop + mobile and uploads to Supabase Storage
 * 3. Saves everything to `proposal_demos`, linked to the lead
 *
 * INTEGRATION: swap the auth/supabase imports for your real helpers, and pass
 * your lib/ai/client.ts completion fn into generateDemoHtml() if you want to
 * reuse your circuit-breaker / Pollinations fallback. Map the `businesses`
 * SELECT columns to your actual schema (esp. however you store social links).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth/server";
import { generateCompletion } from "@/lib/ai/client";
import { generateDemoHtml, type DemoBusiness } from "@/lib/demo/generateDemo";
import { screenshotDemo } from "@/lib/demo/screenshotDemo";

export const maxDuration = 60; // allow time for generation + 2 screenshots

const Body = z.object({
  businessId: z.string().uuid(),
  proposalMarkdown: z.string().optional(),
  screenshots: z.boolean().default(true),
});

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "proposal-demos";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { businessId, proposalMarkdown, screenshots } = parsed.data;

  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .select("id, user_id, name, category, address, phone, rating, description, social_links")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .single();

  if (bizErr || !biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const business: DemoBusiness = {
    name: biz.name,
    category: biz.category,
    address: biz.address,
    phone: biz.phone,
    rating: biz.rating,
    description: biz.description,
    socials: biz.social_links as Record<string, string> | null,
  };

  // Use the app's AI client (correct model + circuit breaker + Pollinations fallback)
  const appComplete = async (system: string, user: string) => {
    const result = await generateCompletion(system, user, { maxTokens: 8000 });
    return result.text;
  };

  let html: string;
  try {
    html = await generateDemoHtml(business, proposalMarkdown, appComplete);
  } catch (err) {
    console.error("demo generation failed", err);
    return NextResponse.json({ error: "Demo generation failed" }, { status: 502 });
  }

  let desktopUrl: string | null = null;
  let mobileUrl: string | null = null;

  if (screenshots) {
    try {
      const shots = await screenshotDemo(html);
      const base = `${user.id}/${businessId}/${Date.now()}`;
      const targets = [
        ["desktop", shots.desktop],
        ["mobile", shots.mobile],
      ] as const;

      for (const [key, buf] of targets) {
        const path = `${base}-${key}.png`;
        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: "image/png", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
        if (key === "desktop") desktopUrl = pub.publicUrl;
        else mobileUrl = pub.publicUrl;
      }
    } catch (err) {
      console.error("demo screenshot failed (non-fatal)", err);
      // Still return the HTML even if screenshots fail.
    }
  }

  const { data: row, error: insErr } = await admin
    .from("proposal_demos")
    .insert({
      business_id: businessId,
      user_id: user.id,
      html,
      proposal_md: proposalMarkdown ?? null,
      screenshot_desktop_url: desktopUrl,
      screenshot_mobile_url: mobileUrl,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("demo insert failed", insErr);
    return NextResponse.json({ error: "Could not save demo" }, { status: 500 });
  }

  return NextResponse.json({
    demoId: row.id,
    html,
    screenshots: { desktop: desktopUrl, mobile: mobileUrl },
  });
}
