import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { outreachPipeline } from "@/lib/db/schema";
import { getBusinessById, getPipelineForUser } from "@/lib/db/queries";

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

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const data = await getPipelineForUser(user.id, statusFilter);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Pipeline GET] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load pipeline" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const { business_id, status, channel, first_contact_at } = parsed.data;
    const now = new Date().toISOString();

    const business = await getBusinessById(business_id, user.id);
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const values = {
      business_id,
      user_id: user.id,
      status,
      channel,
      first_contact_at: first_contact_at ?? now,
      last_contact_at: now,
      updated_at: now,
    };

    const [data] = await db
      .insert(outreachPipeline)
      .values(values)
      .onConflictDoUpdate({ target: outreachPipeline.business_id, set: values })
      .returning();

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[Pipeline POST] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save pipeline entry" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const { id, ...updates } = parsed.data;
    const now = new Date().toISOString();

    const [data] = await db
      .update(outreachPipeline)
      .set({ ...updates, last_contact_at: now, updated_at: now })
      .where(and(eq(outreachPipeline.id, id), eq(outreachPipeline.user_id, user.id)))
      .returning();

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Pipeline PATCH] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update pipeline entry" },
      { status: 500 }
    );
  }
}
