import { NextResponse } from "next/server";
import { and, asc, eq, getTableColumns, inArray, lte } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses, outreachPipeline } from "@/lib/db/schema";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();

  try {
    const data = await db
      .select({
        ...getTableColumns(outreachPipeline),
        businesses: {
          name: businesses.name,
          category: businesses.category,
          address_city: businesses.address_city,
          website: businesses.website,
          phone: businesses.phone,
          email: businesses.email,
        },
      })
      .from(outreachPipeline)
      .innerJoin(businesses, eq(businesses.id, outreachPipeline.business_id))
      .where(
        and(
          eq(outreachPipeline.user_id, user.id),
          lte(outreachPipeline.next_followup_at, now),
          inArray(outreachPipeline.status, ["contacted", "replied", "negotiating"])
        )
      )
      .orderBy(asc(outreachPipeline.next_followup_at));

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[Followups] Query error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 });
  }
}
