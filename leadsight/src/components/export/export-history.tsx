import type { ExportRecord } from "@/types/export";

interface ExportHistoryProps {
  exports?: ExportRecord[];
}

export function ExportHistory({ exports = [] }: ExportHistoryProps) {
  if (!exports.length) return <div>No exports yet.</div>;
  return (
    <ul className="space-y-2">
      {exports.map((e) => (
        <li key={e.id} className="border rounded p-4">
          <p className="font-medium">{e.type} export</p>
          <p className="text-sm text-muted-foreground">{e.created_at}</p>
        </li>
      ))}
    </ul>
  );
}
