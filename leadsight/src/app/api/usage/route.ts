import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Run three queries in parallel
    const [byServiceRes, byDayRes, recentRes] = await Promise.all([
      // Aggregated by service for this billing month
      adminClient
        .from("api_usage")
        .select("service, estimated_cost")
        .eq("user_id", user.id)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd),

      // Aggregated by day for last 30 days
      adminClient
        .from("api_usage")
        .select("created_at, estimated_cost")
        .eq("user_id", user.id)
        .gte("created_at", last30Start)
        .order("created_at", { ascending: true }),

      // Recent 20 calls
      adminClient
        .from("api_usage")
        .select("id, service, operation, estimated_cost, tokens_input, tokens_output, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Build by-service summary
    const serviceMap: Record<string, { calls: number; cost: number }> = {};
    for (const row of byServiceRes.data ?? []) {
      if (!serviceMap[row.service]) serviceMap[row.service] = { calls: 0, cost: 0 };
      serviceMap[row.service].calls += 1;
      serviceMap[row.service].cost  += Number(row.estimated_cost ?? 0);
    }

    const FREE_TIER_MONTHLY: Record<string, number | null> = {
      "google-places": 200,
      "pagespeed":     null,
      "anthropic":     null,
      "pollinations":  null,
    };

    const SERVICE_COLORS: Record<string, string> = {
      "google-places": "#4285F4",
      "pagespeed":     "#34A853",
      "anthropic":     "#D97706",
      "pollinations":  "#EC4899",
      "supabase":      "#3ECF8E",
    };

    const byService = Object.entries(serviceMap).map(([service, { calls, cost }]) => {
      const freeTier = FREE_TIER_MONTHLY[service];
      const pct = freeTier ? Math.min((cost / freeTier) * 100, 100) : null;
      const status = pct === null ? "pay-per-use" : pct > 85 ? "red" : pct > 60 ? "amber" : "green";
      return { service, calls, cost: parseFloat(cost.toFixed(6)), freeTierPct: pct, status, color: SERVICE_COLORS[service] ?? "#888" };
    });

    // Monthly totals
    const totalCalls = byService.reduce((s, r) => s + r.calls, 0);
    const totalCost  = byService.reduce((s, r) => s + r.cost, 0);
    const googleCost = serviceMap["google-places"]?.cost ?? 0;
    const googleCreditRemaining = Math.max(200 - googleCost, 0);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate() + 1;

    // Build daily breakdown
    const dayMap: Record<string, { calls: number; cost: number }> = {};
    for (const row of byDayRes.data ?? []) {
      const day = row.created_at.slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { calls: 0, cost: 0 };
      dayMap[day].calls += 1;
      dayMap[day].cost  += Number(row.estimated_cost ?? 0);
    }
    const dailyBreakdown = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { calls, cost }]) => ({ date, calls, cost: parseFloat(cost.toFixed(6)) }));

    return NextResponse.json({
      summary: {
        totalCalls,
        totalCost: parseFloat(totalCost.toFixed(4)),
        googleCreditRemaining: parseFloat(googleCreditRemaining.toFixed(4)),
        daysLeft,
        periodStart,
        periodEnd,
      },
      byService,
      dailyBreakdown,
      recentCalls: recentRes.data ?? [],
    });
  } catch (error) {
    console.error("Usage API error:", error);
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
