import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/server";

const STATUSES = ["not_contacted", "contacted", "replied", "negotiating", "won", "lost", "ghosted"] as const;
const CHANNELS = ["email", "linkedin", "both"] as const;
const LOST_REASONS = ["price", "no_response", "not_interested", "competitor", "other"] as const;

const createSchema = z.object({
  business_id: z.string().uuid(),
  status: z.enum(STATUSES).optional().default("contacted"),
  channel: z.enum(CHANNELS).optional().default("email"),
  first_contact_at: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  reply_received_at: z.string().nullable().optional(),
  outcome_notes: z.string().nullable().optional(),
  won_amount: z.number().nullable().optional(),
  lost_reason: z.enum(LOST_REASONS).nullable().optional(),
  next_followup_at: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const adminClient = createAdminClient();

  let query = adminClient
    .from("outreach_pipeline")
    .select("*, businesses(name, category, address_city, rating, review_count)")
    .eq("user_id", user.id)
    .order("last_contact_at", { ascending: false, nullsFirst: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { business_id, status, channel, first_contact_at } = parsed.data;
  const now = new Date().toISOString();

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("outreach_pipeline")
    .upsert(
      {
        business_id,
        user_id: user.id,
        status,
        channel,
        first_contact_at: first_contact_at ?? now,
        last_contact_at: now,
        updated_at: now,
      },
      { onConflict: "business_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...updates } = parsed.data;
  const now = new Date().toISOString();

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("outreach_pipeline")
    .update({ ...updates, last_contact_at: now, updated_at: now })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
