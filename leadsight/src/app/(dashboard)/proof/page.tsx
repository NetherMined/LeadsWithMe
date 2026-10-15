import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { CaseStudyCard } from "@/components/proof/CaseStudyCard";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const businesses: BusinessWithSnapshots[] = [];

  if (user) {
    try {
      // Fetch all businesses for this user
      const { data: allBusinesses } = await adminClient
        .from("businesses")
        .select("id, name, category, address_city")
        .eq("user_id", user.id);

      if (allBusinesses && allBusinesses.length > 0) {
        // For each business, check if it has proof snapshots or is in the outreach pipeline
        const businessIds = allBusinesses.map((b) => b.id);

        // Get proof snapshots
        const { data: snapshots } = await adminClient
          .from("proof_snapshots")
          .select("business_id")
          .in("business_id", businessIds);

        const businessIdsWithProof = new Set(
          snapshots?.map((s) => s.business_id) ?? []
        );

        // Get pipeline deals (won/lost status)
        const { data: pipeline } = await adminClient
          .from("outreach_pipeline")
          .select("business_id, status, won_amount")
          .in("business_id", businessIds)
          .in("status", ["won", "lost"]);

        const pipelineMap = new Map(
          (pipeline ?? []).map((p) => [p.business_id, p])
        );

        // Combine: include any business with proof snapshots or pipeline status
        const filteredBusinesses = allBusinesses.filter((b) => {
          const hasProof = businessIdsWithProof.has(b.id);
          const hasPipeline = pipelineMap.has(b.id);
          return hasProof || hasPipeline;
        });

        // Enrich with pipeline data
        for (const biz of filteredBusinesses) {
          const pipelineData = pipelineMap.get(biz.id);
          businesses.push({
            ...biz,
            won_amount: pipelineData?.won_amount ?? null,
            pipeline_status: pipelineData?.status ?? null,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch businesses:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Case Studies & Proof</h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          {businesses.length > 0
            ? `${businesses.length} case stud${businesses.length === 1 ? "y" : "ies"}`
            : "Track before/after metrics for delivered client work"}
        </p>
      </div>

      {/* Content */}
      {businesses.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center" style={{ borderColor: "rgba(255,255,255,0.07)", background: "var(--bg-elevated)" }}>
          <p className="mb-2" style={{ color: "var(--text-secondary)" }}>No proof snapshots yet.</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            After delivering work for a client, capture before/after PageSpeed scores here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {businesses.map((biz) => (
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
