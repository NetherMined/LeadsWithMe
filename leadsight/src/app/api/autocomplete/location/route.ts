import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { trackApiUsage } from "@/lib/usage/track";

interface PlacePrediction {
  placeId: string;
  text: { text: string };
  structuredFormat: {
    mainText: { text: string };
    secondaryText?: { text: string };
  };
}

interface AutocompleteResponse {
  suggestions?: Array<{ placePrediction: PlacePrediction }>;
}

export interface LocationSuggestion {
  label: string;       // city/area/postal code only (first term)
  full: string;        // full description e.g. "Cape Town, Western Cape, South Africa"
  country: string;     // extracted country name (last meaningful term)
  place_id: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: q,
        languageCode: "en",
        includedPrimaryTypes: ["(regions)"],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as AutocompleteResponse;

    const suggestions: LocationSuggestion[] = (data.suggestions ?? [])
      .slice(0, 8)
      .map(({ placePrediction: p }) => {
        const label = p.structuredFormat.mainText.text;
        const full = p.text.text;
        // Country = last comma-separated part of the full text
        const parts = full.split(",").map((s: string) => s.trim());
        const country = parts.length >= 2 ? parts[parts.length - 1] : "";
        return { label, full, country, place_id: p.placeId };
      });

    // Track call (fire-and-forget, skip if no auth)
    try {
      const user = await getAuthUser();
      if (user) {
        trackApiUsage({ userId: user.id, service: "google-places", operation: "autocomplete" });
      }
    } catch { /* ignore */ }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
