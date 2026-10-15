import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await adminClient
    .from("outreach_pipeline")
    .select("*, businesses(name, category, address_city, website, phone, email)")
    .eq("user_id", user.id)
    .lte("next_followup_at", now)
    .in("status", ["contacted", "replied", "negotiating"])
    .order("next_followup_at", { ascending: true });

  if (error) {
    console.error("[Followups] Query error:", error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data);
}
