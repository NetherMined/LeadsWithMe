import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { businesses, outreachPipeline, proofSnapshots } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { CaseStudyCard } from "@/components/proof/CaseStudyCard";

interface BusinessWithSnapshots {
  id: string;
  name: string;
  category: string | null;
  address_city: string | null;
  won_amount?: number | null;
  pipeline_status?: string | null;
}

export default async function ProofPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const businessList: BusinessWithSnapshots[] = [];

  // Fetch all businesses for this user
  const allBusinesses = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      category: businesses.category,
      address_city: businesses.address_city,
    })
    .from(businesses)
    .where(eq(businesses.user_id, user.id));

  if (allBusinesses.length > 0) {
    // For each business, check if it has proof snapshots or is in the outreach pipeline
    const businessIds = allBusinesses.map((b) => b.id);

    // Get proof snapshots
    const snapshots = await db
      .select({ business_id: proofSnapshots.business_id })
      .from(proofSnapshots)
      .where(and(eq(proofSnapshots.user_id, user.id), inArray(proofSnapshots.business_id, businessIds)));

    const businessIdsWithProof = new Set(snapshots.map((s) => s.business_id));

    // Get pipeline deals (won/lost status)
    const pipeline = await db
      .select({
        business_id: outreachPipeline.business_id,
        status: outreachPipeline.status,
        won_amount: outreachPipeline.won_amount,
      })
      .from(outreachPipeline)
      .where(
        and(
          eq(outreachPipeline.user_id, user.id),
          inArray(outreachPipeline.business_id, businessIds),
          inArray(outreachPipeline.status, ["won", "lost"])
        )
      );

    const pipelineMap = new Map(pipeline.map((p) => [p.business_id, p]));

    // Combine: include any business with proof snapshots or pipeline status
    const filteredBusinesses = allBusinesses.filter((b) => {
      const hasProof = businessIdsWithProof.has(b.id);
      const hasPipeline = pipelineMap.has(b.id);
      return hasProof || hasPipeline;
    });

    // Enrich with pipeline data
    for (const biz of filteredBusinesses) {
      const pipelineData = pipelineMap.get(biz.id);
      businessList.push({
        ...biz,
        won_amount: pipelineData?.won_amount ?? null,
        pipeline_status: pipelineData?.status ?? null,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Case Studies & Proof</h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          {businessList.length > 0
            ? `${businessList.length} case stud${businessList.length === 1 ? "y" : "ies"}`
            : "Track before/after metrics for delivered client work"}
        </p>
      </div>

      {/* Content */}
      {businessList.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center" style={{ borderColor: "rgba(255,255,255,0.07)", background: "var(--bg-elevated)" }}>
          <p className="mb-2" style={{ color: "var(--text-secondary)" }}>No proof snapshots yet.</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            After delivering work for a client, capture before/after PageSpeed scores here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {businessList.map((biz) => (
            <CaseStudyCard
              key={biz.id}
              businessId={biz.id}
              businessName={biz.name}
              category={biz.category ?? "Uncategorized"}
              city={biz.address_city}
              wonAmount={biz.won_amount ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
