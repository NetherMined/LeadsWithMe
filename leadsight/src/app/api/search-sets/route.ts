import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { searchSets } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { isUuid } from "@/lib/db/queries";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1),
  location: z.string().min(1),
  country: z.string().optional().default(""),
  limit_count: z.number().min(1).max(50).optional().default(20),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  last_run_at: z.string().optional(),
  result_count: z.number().optional(),
});

// GET /api/search-sets — list all saved searches for the user
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await db
      .select()
      .from(searchSets)
      .where(eq(searchSets.user_id, user.id))
      .orderBy(desc(searchSets.created_at));

    return NextResponse.json({ search_sets: data });
  } catch (err) {
    console.error("Search sets GET error:", err);
    return NextResponse.json({ error: "Failed to load search sets" }, { status: 500 });
  }
}

// POST /api/search-sets — create a new saved search
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const [data] = await db
      .insert(searchSets)
      .values({ ...parsed, user_id: user.id })
      .returning();

    return NextResponse.json({ search_set: data }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save search" }, { status: 500 });
  }
}

// PATCH /api/search-sets — update last_run_at / result_count after re-running
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ...fields } = updateSchema.parse(body);

    await db
      .update(searchSets)
      .set({ ...fields, updated_at: new Date().toISOString() })
      .where(and(eq(searchSets.id, id), eq(searchSets.user_id, user.id)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update search set" }, { status: 500 });
  }
}

// DELETE /api/search-sets?id=<uuid>
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (!isUuid(id)) return NextResponse.json({ error: "Search set not found" }, { status: 404 });

    await db
      .delete(searchSets)
      .where(and(eq(searchSets.id, id), eq(searchSets.user_id, user.id)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Search sets DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete search set" }, { status: 500 });
  }
}
