import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  type: z.enum(["leads", "plans"]),
});

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const { type } = parsed.data;

  if (type === "leads") {
    const tables = [
      "outreach_assets",
      "outreach_pipeline",
      "proof_snapshots",
      "scores",
      "website_audits",
      "social_audits",
      "ads_audits",
      "businesses",
    ] as const;

    const errors: string[] = [];
    for (const table of tables) {
      const { error } = await adminClient.from(table).delete().eq("user_id", user.id);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Some deletions failed", details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "All your lead records deleted" });
  }

  if (type === "plans") {
    const { error } = await adminClient.from("marketing_plans").delete().eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "All your plan records deleted" });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
