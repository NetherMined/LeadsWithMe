import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { getProposalVersion } from "@/lib/proposal/build";

/** GET /api/proposal/builds/[id] — one version with its proposal markdown and demo HTML. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const version = await getProposalVersion(id, user.id);
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ version });
  } catch (err) {
    console.error("[proposal/builds/:id] failed:", err);
    return NextResponse.json({ error: "Could not load proposal" }, { status: 500 });
  }
}
