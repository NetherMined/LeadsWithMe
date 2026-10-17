import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/server";
import { getBusinessById } from "@/lib/db/queries";
import { BuildInProgressError, listProposalVersions, runProposalBuild, startProposalBuild } from "@/lib/proposal/build";

// The build runs in after(): proposal (~2 min) + demo (~2-3 min) + screenshots.
export const maxDuration = 800;

const startSchema = z.object({ business_id: z.string().uuid() });

/** POST /api/proposal/builds — start a proposal → demo → screenshots build. Returns 202 at once. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { business_id } = parsed.data;

  const business = await getBusinessById(business_id, user.id);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  try {
    const buildId = await startProposalBuild(business_id, user.id);
    after(() => runProposalBuild(buildId, business_id, user.id));
    return NextResponse.json({ buildId, status: "queued" }, { status: 202 });
  } catch (err) {
    if (err instanceof BuildInProgressError) {
      return NextResponse.json({ error: err.message, buildId: err.buildId }, { status: 409 });
    }
    console.error("[proposal/builds] start failed:", err);
    return NextResponse.json({ error: "Could not start the build" }, { status: 500 });
  }
}

/** GET /api/proposal/builds?business_id= — all versions for a lead, newest first. */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = request.nextUrl.searchParams.get("business_id") ?? "";
  if (!z.string().uuid().safeParse(businessId).success) {
    return NextResponse.json({ error: "Invalid business_id" }, { status: 400 });
  }

  try {
    const versions = await listProposalVersions(businessId, user.id);
    return NextResponse.json({ versions });
  } catch (err) {
    console.error("[proposal/builds] list failed:", err);
    return NextResponse.json({ error: "Could not load proposals" }, { status: 500 });
  }
}
