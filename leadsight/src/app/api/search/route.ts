import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses as businessesTable, websiteAudits } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { enrichWebsite } from "@/lib/scraper/website";
import { enrichFromWebSearch, isBlockedDomain } from "@/lib/scraper/web-search";
import type { Business, BusinessReview, SocialLinks, WebResult } from "@/types/business";
import { trackApiUsage } from "@/lib/usage/track";

const searchSchema = z.object({
  query: z.string().min(1),
  location: z.string().min(1),
  radius: z.number().optional().default(10000),
  limit: z.number().min(1).max(50).optional().default(20),
  country: z.string().optional().default(""),
  stale_only: z.boolean().optional().default(false),
});

interface PlacesResult {
  id: string;
  displayName: { text: string; languageCode?: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
}

function parseAddressComponents(
  components?: Array<{ longText: string; shortText: string; types: string[] }>
): { street: string | null; suburb: string | null; city: string | null; postal_code: string | null; country: string | null } {
  const result = { street: null as string | null, suburb: null as string | null, city: null as string | null, postal_code: null as string | null, country: null as string | null };
  if (!components) return result;

  let streetNumber = "";
  let route = "";

  for (const comp of components) {
    const types = comp.types || [];
    if (types.includes("street_number")) streetNumber = comp.longText;
    if (types.includes("route")) route = comp.longText;
    if (types.includes("sublocality")) result.suburb = comp.longText;
    if (types.includes("neighborhood") && !result.suburb) result.suburb = comp.longText;
    if (types.includes("locality")) result.city = comp.longText;
    if (types.includes("postal_code")) result.postal_code = comp.longText;
    if (types.includes("country")) result.country = comp.longText;
  }

  if (streetNumber || route) {
    result.street = `${streetNumber} ${route}`.trim();
  }

  return result;
}

function buildStructuredHours(
  periods?: Array<{ open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }>
): Record<string, { open: string; close: string } | { open: string; close: string }[] | string> {
  const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const result: Record<string, { open: string; close: string } | { open: string; close: string }[] | string> = {};

  for (const day of daysOfWeek) {
    result[day] = "Closed";
  }

  if (!periods || periods.length === 0) {
    return result;
  }

  const dayMap: Record<number, Array<{ open: string; close: string }>> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  const padTime = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  for (const period of periods) {
    const dayIndex = period.open.day;
    if (!dayMap[dayIndex]) dayMap[dayIndex] = [];
    dayMap[dayIndex].push({
      open: padTime(period.open.hour, period.open.minute),
      close: period.close ? padTime(period.close.hour, period.close.minute) : "00:00",
    });
  }

  for (let i = 0; i < daysOfWeek.length; i++) {
    if (dayMap[i] && dayMap[i].length > 0) {
      if (dayMap[i].length === 1) {
        result[daysOfWeek[i]] = dayMap[i][0];
      } else {
        result[daysOfWeek[i]] = dayMap[i];
      }
    }
  }

  return result;
}

interface PlaceDetails {
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
    periods?: Array<{ open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }>;
  };
  currentOpeningHours?: { openNow?: boolean };
  editorialSummary?: { overview?: string; text?: string };
  addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
  photos?: Array<{ name: string; heightPx: number; widthPx: number }>;
  reviews?: Array<{
    name: string;
    relativePublishTimeDescription: string;
    rating: number;
    text?: { text: string; languageCode: string };
    authorAttribution?: { displayName: string; uri?: string; photoUri?: string };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, location, radius, limit, stale_only } = searchSchema.parse(body);

    // Auth check — must run before any API calls to prevent quota abuse
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
    }

    // 1. Text Search — Places API (New)
    const searchQuery = `${query} in ${location}`;
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types",
      },
      body: JSON.stringify({ textQuery: searchQuery, maxResultCount: limit }),
    });
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      const errMsg = searchData.error?.message ?? searchRes.statusText;
      console.error("[Search] Places API (New) error:", errMsg, "query:", searchQuery);
      return NextResponse.json({ error: `Places API error: ${errMsg}` }, { status: 502 });
    }

    if (!searchData.places || searchData.places.length === 0) {
      console.error("[Search] ZERO_RESULTS for query:", searchQuery);
    }

    const results: PlacesResult[] = searchData.places ?? [];

    // Track text-search call
    trackApiUsage({ userId: user.id, service: "google-places", operation: "text-search" });

    const emptySocials: SocialLinks = { facebook: null, instagram: null, linkedin: null, tiktok: null, twitter: null, youtube: null };

    // Fetch Place Details + website enrichment for all results in parallel
    const enriched = await Promise.all(
      results.map(async (place) => {
        let phone: string | null = null;
        let website: string | null = null;
        const email: string | null = null;
        let hours: string[] = [];
        let google_maps_url: string | null = null;
        let description: string | null = null;
        let is_open_now: boolean | null = null;
        let hours_weekly: Record<string, unknown> = {};
        let photo_references: string[] = [];
        let photo_count: number = 0;
        let photo_primary: string | null = null;
        let photos: string[] = [];
        let reviews: BusinessReview[] = [];
        let addressParsed: ReturnType<typeof parseAddressComponents> = { street: null, suburb: null, city: null, postal_code: null, country: null };

        try {
          const fieldMask = [
            "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri",
            "googleMapsUri", "regularOpeningHours", "currentOpeningHours",
            "editorialSummary", "addressComponents", "photos", "reviews",
          ].join(",");
          const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${place.id}`, {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": fieldMask,
            },
          });
          const d: PlaceDetails = detailsRes.ok ? await detailsRes.json() : {};
          phone   = d.nationalPhoneNumber ?? d.internationalPhoneNumber ?? null;
          website = d.websiteUri ?? null;
          // Validate: reject directory/ad URLs from Places
          if (website && isBlockedDomain(website)) {
            console.log(`[Search] Blocked directory URL for ${place.displayName.text}: ${website}`);
            website = null;
          }
          hours           = d.regularOpeningHours?.weekdayDescriptions ?? [];
          google_maps_url = d.googleMapsUri ?? null;
          description     = d.editorialSummary?.overview ?? d.editorialSummary?.text ?? null;
          is_open_now     = d.currentOpeningHours?.openNow ?? d.regularOpeningHours?.openNow ?? null;
          hours_weekly    = buildStructuredHours(d.regularOpeningHours?.periods);
          addressParsed   = parseAddressComponents(d.addressComponents);
          // Normalize reviews to consistent shape
          reviews = (d.reviews ?? []).map(r => ({
            author_name: r.authorAttribution?.displayName ?? "",
            author_photo_url: r.authorAttribution?.photoUri ?? null,
            author_profile_url: r.authorAttribution?.uri ?? null,
            author_review_count: null,
            author_is_local_guide: false,
            rating: r.rating,
            relative_time: r.relativePublishTimeDescription,
            text: r.text?.text ?? "",
            reaction_count: null,
          }));

          if (d.photos && d.photos.length > 0) {
            photo_count = d.photos.length;
            photo_references = d.photos.map(p => p.name);
            photo_primary = `https://places.googleapis.com/v1/${photo_references[0]}/media?maxWidthPx=800&key=${apiKey}`;
            photos = photo_references.slice(0, 5).map(ref => `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=800&key=${apiKey}`);
          }

          trackApiUsage({ userId: user.id, service: "google-places", operation: "place-details" });
        } catch { /* use defaults */ }

        // Website enrichment (social links, scraped email/mobile/whatsapp)
        let socialLinks = emptySocials;
        let scrapedEmail: string | null = null;
        let emails: string[] = [];
        let mobile: string | null = null;
        let whatsapp: string | null = null;
        if (website) {
          try {
            const enrichment = await enrichWebsite(website);
            socialLinks  = enrichment.socialLinks;
            emails       = enrichment.emails;
            scrapedEmail = enrichment.contactEmail;
            mobile       = enrichment.mobiles[0] ?? null;
            whatsapp     = enrichment.whatsapp;
          } catch { /* use defaults */ }
        }

        // Web search enrichment — runs for ALL businesses (with or without websites)
        let webResults: WebResult[] = [];
        try {
          const city = addressParsed.city || location.split(",")[0]?.trim() || "";
          const webEnrichment = await Promise.race([
            enrichFromWebSearch(place.displayName.text, city, { website, socialLinks }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);

          if (webEnrichment) {
            webResults = webEnrichment.webResults;

            // Fill website gap — if we discovered one, also scrape it
            if (!website && webEnrichment.website) {
              website = webEnrichment.website;
              try {
                const siteData = await enrichWebsite(website);
                for (const [p, u] of Object.entries(siteData.socialLinks)) {
                  const key = p as keyof SocialLinks;
                  if (u && !socialLinks[key]) socialLinks[key] = u;
                }
                if (!scrapedEmail) scrapedEmail = siteData.contactEmail;
                if (emails.length === 0) emails = siteData.emails;
                if (!mobile) mobile = siteData.mobiles[0] ?? null;
                if (!whatsapp) whatsapp = siteData.whatsapp;
              } catch { /* use defaults */ }
            }

            // Cross-reference social links — log confirmations, fill gaps
            for (const [platform, url] of Object.entries(webEnrichment.socialLinks)) {
              const key = platform as keyof SocialLinks;
              if (!url) continue;
              if (socialLinks[key]) {
                console.log(`[Search] ✓ ${place.displayName.text}: ${platform} confirmed by web search`);
              } else {
                socialLinks[key] = url;
              }
            }

            // Fill contact gaps
            if (emails.length === 0 && webEnrichment.emails.length > 0) {
              emails = webEnrichment.emails;
              if (!scrapedEmail) scrapedEmail = webEnrichment.emails[0];
            }
            if (!mobile && webEnrichment.mobile) mobile = webEnrichment.mobile;
            if (!whatsapp && webEnrichment.whatsapp) whatsapp = webEnrichment.whatsapp;
          }
        } catch { /* web search failure never blocks the pipeline */ }

        // Deduplicate emails across all sources
        emails = [...new Set(emails.map(e => e.toLowerCase()))];

        const socialChannelCount = Object.values(socialLinks).filter(v => !!v).length;

        return {
          phone,
          website,
          email: email ?? scrapedEmail,
          emails,
          mobile,
          whatsapp,
          hours,
          socialLinks,
          google_maps_url,
          description,
          is_open_now,
          hours_weekly,
          photo_references,
          photo_count,
          photo_primary,
          photos,
          reviews,
          addressParsed,
          socialChannelCount,
          webResults,
        };
      })
    );

    const businesses: Business[] = [];

    for (let i = 0; i < results.length; i++) {
      const place = results[i];
      const e = enriched[i];

      // Return existing record without re-scraping
      const [existing] = await db
        .select({ id: businessesTable.id })
        .from(businessesTable)
        .where(and(eq(businessesTable.place_id, place.id), eq(businessesTable.user_id, user.id)))
        .limit(1);

      if (existing) {
        const [b] = await db.select().from(businessesTable).where(eq(businessesTable.id, existing.id)).limit(1);
        if (b) {
          const biz = b as unknown as Business;
          const socialLinks = biz.social_links ?? {};
          const allSocialsNull = Object.values(socialLinks).every(v => !v);
          const needsEnrichment = allSocialsNull || !biz.email || !biz.website || !biz.mobile || !biz.whatsapp
            || (!biz.web_results || (biz.web_results as WebResult[]).length === 0);

          const hasNewData =
            (allSocialsNull && Object.values(e.socialLinks).some(v => !!v)) ||
            (!biz.email && !!e.email) ||
            (!biz.website && !!e.website) ||
            (!biz.mobile && !!e.mobile) ||
            (!biz.whatsapp && !!e.whatsapp) ||
            ((!biz.emails || (biz.emails as string[]).length === 0) && e.emails.length > 0) ||
            ((!biz.web_results || (biz.web_results as WebResult[]).length === 0) && e.webResults.length > 0);

          if (needsEnrichment && hasNewData) {
            const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (allSocialsNull && Object.values(e.socialLinks).some(v => !!v)) {
              updatePayload.social_links = e.socialLinks;
            }
            if (!biz.email && e.email) updatePayload.email = e.email;
            // Retroactively fix stored directory URLs
            if (biz.website && isBlockedDomain(biz.website)) {
              updatePayload.website = e.website ?? null;
            } else if (!biz.website && e.website) updatePayload.website = e.website;
            if (!biz.mobile && e.mobile) updatePayload.mobile = e.mobile;
            if (!biz.whatsapp && e.whatsapp) updatePayload.whatsapp = e.whatsapp;
            if ((!biz.emails || (biz.emails as string[]).length === 0) && e.emails.length > 0) {
              updatePayload.emails = e.emails;
            }
            if ((!biz.web_results || (biz.web_results as WebResult[]).length === 0) && e.webResults.length > 0) {
              updatePayload.web_results = e.webResults;
            }
            if (Object.keys(updatePayload).length > 1) {
              const [updated] = await db
                .update(businessesTable)
                .set(updatePayload as Partial<typeof businessesTable.$inferInsert>)
                .where(and(eq(businessesTable.id, existing.id), eq(businessesTable.user_id, user.id)))
                .returning();
              if (updated) { businesses.push(updated as unknown as Business); continue; }
            }
          }
          businesses.push(biz);
        }
        continue;
      }

      const category = place.types?.[0]?.replace(/_/g, " ") ?? query;

      const values = {
        user_id: user.id,
        place_id: place.id,
        name: place.displayName.text,
        address: place.formattedAddress,
        phone: e.phone,
        website: e.website,
        email: e.email,
        emails: e.emails,
        mobile: e.mobile,
        whatsapp: e.whatsapp,
        hours: e.hours,
        search_term: query,
        category,
        rating: place.rating ?? null,
        review_count: place.userRatingCount ?? 0,
        latitude: place.location.latitude,
        longitude: place.location.longitude,
        social_links: e.socialLinks,
        google_maps_url: e.google_maps_url,
        description: e.description,
        is_open_now: e.is_open_now,
        hours_weekly: e.hours_weekly,
        photo_references: e.photo_references,
        photo_count: e.photo_count,
        photo_primary: e.photo_primary,
        photos: e.photos,
        reviews: e.reviews,
        // address_* matches migration 009 column names
        address_street: e.addressParsed.street,
        address_suburb: e.addressParsed.suburb,
        address_city: e.addressParsed.city,
        address_postal_code: e.addressParsed.postal_code,
        address_country: e.addressParsed.country,
        social_channel_count: e.socialChannelCount,
        web_results: e.webResults,
      };

      let inserted: Business | undefined;
      try {
        // Conflict on (user_id, place_id) means a concurrent request already saved this place
        const [row] = await db
          .insert(businessesTable)
          .values(values)
          .onConflictDoUpdate({
            target: [businessesTable.user_id, businessesTable.place_id],
            set: values,
          })
          .returning();
        inserted = row as unknown as Business;
      } catch (error) {
        console.error("[Search] Insert failed for", place.displayName.text, error);
      }

      if (!inserted) {
        // DB unavailable — still return the enriched data so results display
        const now = new Date().toISOString();
        businesses.push({
          id: place.id,
          place_id: place.id,
          user_id: user.id,
          name: place.displayName.text,
          address: place.formattedAddress,
          address_street: e.addressParsed.street,
          address_suburb: e.addressParsed.suburb,
          address_city: e.addressParsed.city,
          address_postal_code: e.addressParsed.postal_code,
          address_country: e.addressParsed.country,
          latitude: place.location.latitude,
          longitude: place.location.longitude,
          google_maps_url: e.google_maps_url,
          feature_id: null,
          phone: e.phone,
          mobile: e.mobile,
          email: e.email,
          emails: e.emails,
          whatsapp: e.whatsapp,
          website: e.website,
          category,
          search_term: query,
          description: e.description,
          rating: place.rating ?? null,
          review_count: place.userRatingCount ?? 0,
          rating_distribution: null,
          reviews: e.reviews,
          is_open_now: e.is_open_now,
          current_status: null,
          hours: e.hours,
          hours_weekly: e.hours_weekly as Business["hours_weekly"],
          photo_count: e.photo_count,
          photos: e.photos,
          photo_primary: e.photo_primary,
          photo_references: e.photo_references,
          social_links: e.socialLinks,
          social_channel_count: e.socialChannelCount,
          products: null,
          services_url: null,
          appointments_url: null,
          has_updates: null,
          updates_url: null,
          popular_times: null,
          live_busyness: null,
          typical_visit_duration: null,
          service_area_primary: null,
          service_areas: null,
          related_businesses: null,
          review_topics: null,
          web_results: e.webResults,
          is_claimed: null,
          gmb_claim_url: null,
          competitors: null,
          created_at: now,
          updated_at: now,
          is_stale: null,
        } as Business);
      } else {
        businesses.push(inserted);
      }
    }

    // Apply stale_only filter if requested
    let filteredBusinesses = businesses;
    if (stale_only) {
      // Fetch the caller's website_audits and their last_audit_at (created_at)
      const audits = await db
        .select({ business_id: websiteAudits.business_id, created_at: websiteAudits.created_at })
        .from(websiteAudits)
        .innerJoin(businessesTable, eq(businessesTable.id, websiteAudits.business_id))
        .where(eq(businessesTable.user_id, user.id));

      const auditMap = new Map<string, string>();
      for (const audit of audits) {
        const businessId = audit.business_id;
        const createdAt = audit.created_at;
        if (createdAt) {
          auditMap.set(businessId, createdAt);
        }
      }

      const now = new Date();

      filteredBusinesses = businesses
        .map(b => {
          const lastAuditAt = auditMap.get(b.id);
          if (!lastAuditAt) {
            // No audit yet = potentially stale (unknown)
            return { ...b, is_stale: null };
          }
          const auditDate = new Date(lastAuditAt);
          const daysSinceAudit = Math.floor((now.getTime() - auditDate.getTime()) / (1000 * 60 * 60 * 24));
          const isStale = daysSinceAudit > 365;
          return { ...b, is_stale: isStale };
        })
        .filter(b => b.is_stale === true || b.is_stale === null);
    } else {
      // Not filtering by stale, but still mark staleness for display
      const audits = await db
        .select({ business_id: websiteAudits.business_id, created_at: websiteAudits.created_at })
        .from(websiteAudits)
        .innerJoin(businessesTable, eq(businessesTable.id, websiteAudits.business_id))
        .where(eq(businessesTable.user_id, user.id));

      const auditMap = new Map<string, string>();
      for (const audit of audits) {
        const businessId = audit.business_id;
        const createdAt = audit.created_at;
        if (createdAt) {
          auditMap.set(businessId, createdAt);
        }
      }

      const now = new Date();
      filteredBusinesses = businesses.map(b => {
        const lastAuditAt = auditMap.get(b.id);
        if (!lastAuditAt) {
          return { ...b, is_stale: null };
        }
        const auditDate = new Date(lastAuditAt);
        const daysSinceAudit = Math.floor((now.getTime() - auditDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...b, is_stale: daysSinceAudit > 365 };
      });
    }

    return NextResponse.json({ businesses: filteredBusinesses, count: filteredBusinesses.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
