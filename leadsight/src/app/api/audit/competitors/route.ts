import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { trackApiUsage } from "@/lib/usage/track";
import { getBusinessById } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { CompetitorInfo } from "@/types/business";

export const maxDuration = 120;

const schema = z.object({ business_id: z.string().uuid() });

interface PlacesTextResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
}

interface PlaceDetailsResult {
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
}

/** Simple relevance heuristic: shared words between target category/name and candidate. */
function relevanceScore(targetCategory: string, targetName: string, candidateName: string): number {
  const words = (s: string) =>
    s.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const target = new Set([...words(targetCategory), ...words(targetName)]);
  const cand = words(candidateName);
  if (cand.length === 0) return 0;
  const overlap = cand.filter(w => target.has(w)).length;
  return overlap / cand.length;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getBusinessById(business_id, user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
    }

    const city: string = business.address_city
      ?? (business.address as string | null)?.split(",").slice(-2, -1)[0]?.trim()
      ?? "";

    // Prefer more specific query when possible
    const searchQuery = business.search_term
      ? `${business.search_term} in ${city}`
      : `${business.category} in ${city}`;

    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: searchQuery, maxResultCount: 15 }),
      signal: AbortSignal.timeout(10000),
    });
    const searchData = await searchRes.json() as { places?: PlacesTextResult[]; error?: { message: string } };

    trackApiUsage({ userId: user.id, service: "google-places", operation: "text-search" });

    if (!searchRes.ok) {
      const errMsg = searchData.error?.message ?? searchRes.statusText;
      return NextResponse.json({ error: `Places API error: ${errMsg}` }, { status: 502 });
    }

    const rawCandidates = (searchData.places ?? []).filter(p => p.id !== business.place_id);

    // Score relevance and keep the best 5
    const scored = rawCandidates
      .map(p => ({
        place: p,
        relevance: relevanceScore(business.category, business.name, p.displayName.text),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);

    const competitors: CompetitorInfo[] = await Promise.all(
      scored.map(async ({ place, relevance }) => {
        let phone: string | null = null;
        let website: string | null = null;
        try {
          const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${place.id}`, {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "nationalPhoneNumber,internationalPhoneNumber,websiteUri",
            },
            signal: AbortSignal.timeout(10000),
          });
          const d: PlaceDetailsResult = detailsRes.ok ? await detailsRes.json() : {};
          phone = d.nationalPhoneNumber ?? d.internationalPhoneNumber ?? null;
          website = d.websiteUri ?? null;
          trackApiUsage({ userId: user.id, service: "google-places", operation: "place-details" });
        } catch { /* use defaults */ }

        return {
          place_id: place.id,
          name: place.displayName.text,
          rating: place.rating ?? null,
          review_count: place.userRatingCount ?? 0,
          website,
          address: place.formattedAddress,
          phone,
          // Optional field — stored as extra; UI can ignore if not in type
          // relevance: relevance,
        };
      })
    );

    await db
      .update(businesses)
      .set({ competitors })
      .where(and(eq(businesses.id, business_id), eq(businesses.user_id, user.id)));

    return NextResponse.json({
      competitors,
      note: "Results ranked by name/category overlap. Review for true competitive relevance — adjacent businesses may still appear.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Competitors audit error:", error);
    return NextResponse.json({ error: "Competitors lookup failed" }, { status: 500 });
  }
}
