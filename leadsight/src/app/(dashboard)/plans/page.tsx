import { getAuthUser } from "@/lib/auth/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PlanRow = { id: string; business_id: string; executive_summary: string; generated_at: string; model_used: string; businesses?: { name: string }[] | null };

export default async function PlansPage() {
  const user = await getAuthUser();
  let plans: PlanRow[] = [];
  if (user) {
    const { data } = await adminClient.from("marketing_plans").select("id, business_id, executive_summary, generated_at, model_used, businesses(name)").order("generated_at", { ascending: false });
    plans = (data ?? []) as unknown as PlanRow[];
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Marketing Plans</h1>
        <p className="page-subtitle">{plans.length} AI-generated plans</p>
      </div>
      {plans.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-secondary">
            No plans yet.{" "}
            <Link href="/leads" className="text-accent-blue hover:underline">Go to a lead</Link>
            {" "}to generate one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="card-surface p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-text-primary">{plan.businesses?.[0]?.name ?? "Business"}</h3>
                  <p className="text-[12px] mt-1.5 line-clamp-2 text-text-secondary">{plan.executive_summary}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[11px] text-text-muted font-mono">{new Date(plan.generated_at).toLocaleDateString()}</span>
                  <Link
                    href={`/plans/${plan.id}`}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                    style={{ background: "var(--accent-blue)", color: "#fff" }}
                  >
                    View Plan
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}