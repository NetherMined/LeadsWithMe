import { redirect } from "next/navigation";
import { PlanViewer } from "@/components/plans/plan-viewer";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { isUuid } from "@/lib/db/queries";
import { businesses, marketingPlans } from "@/lib/db/schema";
import { and, eq, getTableColumns } from "drizzle-orm";
import type { MarketingPlan } from "@/types/plan";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [row] = isUuid(id)
    ? await db
        .select({
          ...getTableColumns(marketingPlans),
          businesses: { name: businesses.name, address: businesses.address },
        })
        .from(marketingPlans)
        .innerJoin(businesses, eq(businesses.id, marketingPlans.business_id))
        .where(and(eq(marketingPlans.id, id), eq(marketingPlans.user_id, user.id)))
        .limit(1)
    : [];
  if (!row) return <div className="text-center py-16 text-gray-500">Plan not found.</div>;
  const plan = row as unknown as MarketingPlan & { businesses?: { name: string; address: string } };
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
