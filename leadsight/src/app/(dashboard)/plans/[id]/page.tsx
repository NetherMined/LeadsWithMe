import { PlanViewer } from "@/components/plans/plan-viewer";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { MarketingPlan } from "@/types/plan";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await adminClient.from("marketing_plans").select("*, businesses(name, address)").eq("id", id).single();
  if (error || !data) return <div className="text-center py-16 text-gray-500">Plan not found.</div>;
  const plan = data as MarketingPlan & { businesses?: { name: string; address: string } };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marketing Plan</h1>
        {plan.businesses && <p className="text-gray-500">{plan.businesses.name}</p>}
      </div>
      <PlanViewer plan={plan} />
    </div>
  );
}