export const dynamic = "force-dynamic";

import { getAuthUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import type { Business } from "@/types/business";
import { LeadsClient } from "@/components/leads/leads-client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function LeadsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { data } = await adminClient
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const businesses = (data ?? []) as Business[];

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
