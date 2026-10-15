import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { exports as exportsTable } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ExportHistory } from "@/components/export/export-history";
import type { ExportRecord } from "@/types/export";

export default async function ExportsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.user_id, user.id))
    .orderBy(desc(exportsTable.created_at));
  const exports = rows as unknown as ExportRecord[];

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
