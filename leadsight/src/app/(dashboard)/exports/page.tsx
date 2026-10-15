import { getAuthUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ExportHistory } from "@/components/export/export-history";
import type { ExportRecord } from "@/types/export";

const adminClient = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ExportsPage() {
  const user = await getAuthUser();
  let exports: ExportRecord[] = [];
  if (user) {
    const { data } = await adminClient.from("exports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    exports = (data ?? []) as ExportRecord[];
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Export History</h1>
        <p className="page-subtitle">{exports.length} exports to Google Workspace</p>
      </div>
      <ExportHistory exports={exports} />
    </div>
  );
}