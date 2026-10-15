import { getAuthUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { OutreachAssetCard } from "@/components/outreach/OutreachAssetCard";
import type { Business } from "@/types/business";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OutreachPageProps {
  params: Promise<{ id: string }>;
}

export default async function OutreachPage({ params }: OutreachPageProps) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
    redirect("/auth/login");
  }

  const businessRes = await adminClient.from("businesses").select("name").eq("id", id).single();
  const businessName = businessRes.error ? `Business #${id}` : (businessRes.data as Business).name;

  return (
    <div className="min-h-screen space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/leads/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          ← Back to Lead
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{businessName}</h1>
      </div>

      <div className="border-b border-border" />

      <OutreachAssetCard businessId={id} businessName={businessName} />
    </div>
  );
}