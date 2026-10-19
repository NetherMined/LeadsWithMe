import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { getBusinessById } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const schema = z.object({
  business_id: z.string().uuid(),
  competitors: z.array(z.object({
    place_id: z.string(),
    name: z.string(),
    rating: z.number().nullable(),
    review_count: z.number(),
    website: z.string().nullable(),
    address: z.string(),
    phone: z.string().nullable(),
    pinned: z.boolean().optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, competitors } = schema.parse(body);

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getBusinessById(business_id, user.id);
    if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(businesses)
      .set({ competitors })
      .where(and(eq(businesses.id, business_id), eq(businesses.user_id, user.id)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Pin competitors error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
