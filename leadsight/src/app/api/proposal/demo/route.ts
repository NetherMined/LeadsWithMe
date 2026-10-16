/**
 * app/api/proposal/demo/route.ts
 *
 * POST /api/proposal/demo
 * Body: { businessId: string, proposalMarkdown?: string, screenshots?: boolean }
 *
 * 1. Generates a single-file HTML demo site for the business
 * 2. (optional) Screenshots it desktop + mobile and saves them to local storage
 * 3. Saves everything to `proposal_demos`, linked to the lead
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses, proposalDemos } from "@/lib/db/schema";
import { generateDemoHtml, type DemoBusiness } from "@/lib/demo/generateDemo";
import { screenshotDemo } from "@/lib/demo/screenshotDemo";
import { saveUserFile } from "@/lib/storage/local";

export const maxDuration = 180; // an 8k-token generation plus 2 screenshots

const Body = z.object({
  businessId: z.string().uuid(),
  proposalMarkdown: z.string().optional(),
  screenshots: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { businessId, proposalMarkdown, screenshots } = parsed.data;

    const [biz] = await db
      .select({
        id: businesses.id,
        user_id: businesses.user_id,
        name: businesses.name,
        category: businesses.category,
        address: businesses.address,
        phone: businesses.phone,
        rating: businesses.rating,
        description: businesses.description,
        social_links: businesses.social_links,
      })
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.user_id, user.id)))
      .limit(1);

    if (!biz) {
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

    let html: string;
    try {
      html = await generateDemoHtml(business, proposalMarkdown);
    } catch (err) {
      console.error("demo generation failed", err);
      return NextResponse.json({ error: "Demo generation failed" }, { status: 502 });
    }

    let desktopUrl: string | null = null;
    let mobileUrl: string | null = null;

    if (screenshots) {
      try {
        const shots = await screenshotDemo(html);
        const base = `proposal-demos/${businessId}/${Date.now()}`;
        const targets = [
          ["desktop", shots.desktop],
          ["mobile", shots.mobile],
        ] as const;

        for (const [key, buf] of targets) {
          const url = await saveUserFile(user.id, `${base}-${key}.png`, Buffer.from(buf));
          if (key === "desktop") desktopUrl = url;
          else mobileUrl = url;
        }
      } catch (err) {
        console.error("demo screenshot failed (non-fatal)", err);
        // Still return the HTML even if screenshots fail.
      }
    }

    let row: { id: string };
    try {
      [row] = await db
        .insert(proposalDemos)
        .values({
          business_id: businessId,
          user_id: user.id,
          html,
          proposal_md: proposalMarkdown ?? null,
          screenshot_desktop_url: desktopUrl,
          screenshot_mobile_url: mobileUrl,
        })
        .returning({ id: proposalDemos.id });
    } catch (insErr) {
      console.error("demo insert failed", insErr);
      return NextResponse.json({ error: "Could not save demo" }, { status: 500 });
    }

    return NextResponse.json({
      demoId: row.id,
      html,
      screenshots: { desktop: desktopUrl, mobile: mobileUrl },
    });
  } catch (err) {
    console.error("[proposal/demo] error", err);
    return NextResponse.json({ error: "Demo request failed" }, { status: 500 });
  }
}
