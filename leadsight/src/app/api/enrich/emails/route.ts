import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { enrichEmails } from "@/lib/scraper/emails";
import type { EmailResult } from "@/lib/scraper/emails";
import type { Business } from "@/types/business";
import { trackApiUsage } from "@/lib/usage/track";

const schema = z.object({ business_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    // Auth check
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch business (owned by the caller only)
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, business_id), eq(businesses.user_id, user.id)))
      .limit(1);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const b = business as unknown as Business;

    // If business has no website stored, try fetching it fresh from Places API
    let websiteUrl = b.website;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!websiteUrl && apiKey && b.place_id) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${b.place_id}&fields=website&key=${apiKey}`;
        const detailsData = await fetch(detailsUrl).then(r => r.json()) as { result?: { website?: string } };
        websiteUrl = detailsData.result?.website ?? null;
        trackApiUsage({ userId: user.id, service: "google-places", operation: "place-details" });
      } catch { /* ignore */ }

      if (websiteUrl) {
        await db
          .update(businesses)
          .set({ website: websiteUrl })
          .where(and(eq(businesses.id, business_id), eq(businesses.user_id, user.id)));
      }
    }

    // Run deep email scrape (website + social)
    const results = await enrichEmails(websiteUrl, b.social_links ?? {});
    const allResults = [...results];

    if (allResults.length === 0) {
      return NextResponse.json({ emails: [], message: "No emails found" });
    }

    // Merge with existing emails (deduplicate), filtering out any file-extension false positives
    const FILE_EXT_TLDS = new Set(["png","jpg","jpeg","gif","svg","webp","ico","bmp","tiff","avif","css","js","ts","json","xml","html","htm","woff","woff2","ttf","eot","otf","pdf","zip","php","asp","aspx"]);
    const cleanEmail = (e: string) => {
      const tld = e.split(".").pop()?.toLowerCase() ?? "";
      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e) && !FILE_EXT_TLDS.has(tld);
    };
    const existingEmails: string[] = (Array.isArray(b.emails) ? (b.emails as string[]) : []).filter(cleanEmail);
    const newEmails = allResults.map(r => r.email);
    const merged = [...new Set([...existingEmails, ...newEmails])];

    // Update business record
    await db
      .update(businesses)
      .set({ emails: merged, email: merged[0] ?? b.email ?? null })
      .where(and(eq(businesses.id, business_id), eq(businesses.user_id, user.id)));

    return NextResponse.json({ emails: allResults, total: allResults.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Email enrichment error:", error);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }
}
