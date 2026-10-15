// src/app/api/export/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getFullBusinessProfile } from "@/lib/supabase/queries";
import { launchBrowser, closeBrowser } from "@/lib/scraper/browser";
import { findTopCompetitor } from "@/lib/competitor/finder";
import { captureScreenshots } from "@/lib/screenshots/capture";
import { deepScrape } from "@/lib/competitor/scraper";
import { compareSites } from "@/lib/competitor/compare";
import { generateABTests } from "@/lib/competitor/ab-tests";
import { generatePDF } from "@/lib/pdf/generator";
import type { SiteComparison, ABTestSuggestion, ScreenshotResult, PDFReportData } from "@/types/report";
import type { Business } from "@/types/business";

export const maxDuration = 60;

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  business_id: z.string().uuid(),
  include_competitor: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    const body = await request.json();
    const { business_id, include_competitor } = schema.parse(body);

    // Auth check
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify business belongs to user
    const { data: biz } = await adminClient
      .from("businesses")
      .select("id")
      .eq("id", business_id)
      .eq("user_id", user.id)
      .single();
    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    // 1. Fetch full business profile
    const profile = await getFullBusinessProfile(business_id);
    if (!profile.plan) {
      return NextResponse.json(
        { error: "Business must have a marketing plan before generating a PDF report. Run the scoring and plan generation first." },
        { status: 422 }
      );
    }

    // 2. Launch shared browser
    browser = await launchBrowser();

    // 3. Find competitor (if enabled)
    let competitor: Business | null = null;
    if (include_competitor && profile.business.website) {
      try {
        competitor = await findTopCompetitor(profile.business);
      } catch (err) {
        console.warn("[pdf] findTopCompetitor failed, continuing without:", err);
      }
    }

    // 4. Capture screenshots in parallel
    const [bizScreenshots, compScreenshots]: [ScreenshotResult[], ScreenshotResult[]] = await Promise.all([
      profile.business.website
        ? captureScreenshots(profile.business.website, browser).catch(() => [])
        : Promise.resolve([]),
      competitor?.website
        ? captureScreenshots(competitor.website, browser).catch(() => [])
        : Promise.resolve([]),
    ]);

    // 5. Deep scrape in parallel (for comparison)
    let comparison: SiteComparison | null = null;
    if (competitor?.website && profile.business.website) {
      try {
        const [bizAnalysis, compAnalysis] = await Promise.all([
          deepScrape(profile.business.website, browser).catch(() => null),
          deepScrape(competitor.website, browser).catch(() => null),
        ]);

        if (bizAnalysis && compAnalysis) {
          comparison = compareSites(bizAnalysis, compAnalysis, profile.business.name, competitor.name);
        }
      } catch (err) {
        console.warn("[pdf] deepScrape/compareSites failed, continuing without comparison:", err);
      }
    }

    // 6. Generate A/B tests
    let abTests: ABTestSuggestion[] = [];
    if (comparison) {
      abTests = await generateABTests(comparison, profile.business.category ?? "local business").catch(() => []);
    }

    // 7. Generate PDF
    const reportData: PDFReportData = {
      profile,
      competitor,
      comparison,
      abTests,
      bizScreenshots,
      compScreenshots,
    };

    const pdfBuffer = await generatePDF(reportData);

    // 8. Close browser
    await closeBrowser(browser);
    browser = null;

    // 9. Build filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `${profile.business.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-report-${timestamp}.pdf`;

    // 10. Record export (no storage URL)
    await adminClient.from("exports").insert({
      user_id: user.id,
      type: "pdf",
      google_file_id: null,
      google_file_url: null,
      business_ids: [business_id],
    }).then(({ error }) => {
      if (error) console.warn("[pdf] export record insert failed:", error.message);
    });

    // 11. Return PDF directly as binary response
    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    if (browser) await closeBrowser(browser).catch(() => {});
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[pdf] export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
