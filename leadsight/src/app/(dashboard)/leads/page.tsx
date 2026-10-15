export const dynamic = "force-dynamic";

import { getAuthUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBusinessesByUser } from "@/lib/db/queries";
import { LeadsClient } from "@/components/leads/leads-client";

export default async function LeadsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const businesses = await getBusinessesByUser(user.id);

  // Derive unique filter options from stored data
  const categories = [...new Set(businesses.map(b => b.category).filter(Boolean))].sort();
  const searchTerms = [...new Set(businesses.map(b => b.search_term).filter((t): t is string => !!t))].sort();

  // Extract city/area from address (first meaningful part)
  const locations = [...new Set(
    businesses.map(b => {
      const parts = b.address.split(",");
      return parts.length > 1 ? parts[parts.length - 2].trim() : parts[0].trim();
    }).filter(Boolean)
  )].sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{businesses.length} businesses saved</p>
        </div>
      </div>

      <LeadsClient
        businesses={businesses}
        categories={categories}
        locations={locations}
        searchTerms={searchTerms}
      />
    </div>
  );
}
