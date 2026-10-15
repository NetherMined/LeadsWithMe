import { getAuthUser } from "@/lib/auth/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { OutreachAssetCard } from "@/components/outreach/OutreachAssetCard";
import { getBusinessById } from "@/lib/db/queries";

interface OutreachPageProps {
  params: Promise<{ id: string }>;
}

export default async function OutreachPage({ params }: OutreachPageProps) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const business = await getBusinessById(id, user.id);
  if (!business) {
    notFound();
  }
  const businessName = business.name;

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
