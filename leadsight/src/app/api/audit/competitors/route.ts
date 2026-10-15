import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { trackApiUsage } from "@/lib/usage/track";
import type { CompetitorInfo } from "@/types/business";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: business, error } = await adminClient
      .from("businesses")
      .select("id, place_id, category, address_city, address, name")
      .eq("id", business_id)
      .single();

    if (error || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
    }

    // Derive city: use address_city first, fall back to last part of address
    const city: string = business.address_city
      ?? (business.address as string | null)?.split(",").slice(-2, -1)[0]?.trim()
      ?? "";

    const searchQuery = `${business.category} in ${city}`;
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: searchQuery, maxResultCount: 10 }),
    });
    const searchData = await searchRes.json() as { places?: PlacesTextResult[]; error?: { message: string } };

    trackApiUsage({ userId: user.id, service: "google-places", operation: "text-search" });

    if (!searchRes.ok) {
      const errMsg = searchData.error?.message ?? searchRes.statusText;
      return NextResponse.json({ error: `Places API error: ${errMsg}` }, { status: 502 });
    }

    const candidates = (searchData.places ?? [])
      .filter(p => p.id !== business.place_id)
      .slice(0, 5);

    const competitors: CompetitorInfo[] = await Promise.all(
      candidates.map(async (place) => {
        let phone: string | null = null;
        let website: string | null = null;
        try {
          const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${place.id}`, {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "nationalPhoneNumber,internationalPhoneNumber,websiteUri",
            },
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
        };
      })
    );

    await adminClient
      .from("businesses")
      .update({ competitors })
      .eq("id", business_id);

    return NextResponse.json({ competitors });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Competitors audit error:", error);
    return NextResponse.json({ error: "Competitors lookup failed" }, { status: 500 });
  }
}
