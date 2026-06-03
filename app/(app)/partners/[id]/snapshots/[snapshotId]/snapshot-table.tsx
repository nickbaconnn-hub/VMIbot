import { Badge } from "@/components/ui/badge";
import type { MappingStatus } from "@/types/db";

type Row = {
  id: string;
  partner_sku_name: string;
  units_sold: number;
  on_hand: number | null;
  mapping_status: MappingStatus;
  nwcs_catalog: { name: string; sku: string } | { name: string; sku: string }[] | null;
};

function statusBadge(status: MappingStatus) {
  if (status === "mapped") return <Badge variant="secondary">Mapped</Badge>;
  if (status === "pending") return <Badge variant="destructive">Unmapped</Badge>;
  return <Badge variant="outline">Ignored</Badge>;
}

function catalogName(c: Row["nwcs_catalog"]): string | null {
  if (!c) return null;
  const entry = Array.isArray(c) ? c[0] : c;
  return entry?.name ?? null;
}

export function SnapshotTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">
        No rows match this filter.
      </div>
    );
  }
  return (
    <div className="border rounded-md overflow-hidden text-sm">
      <table className="w-full">
        <thead className="bg-muted/50 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Partner SKU</th>
            <th className="text-left px-3 py-2 font-medium">NWCS product</th>
            <th className="text-right px-3 py-2 font-medium">Units sold</th>
            <th className="text-right px-3 py-2 font-medium">On hand</th>
            <th className="text-left px-3 py-2 font-medium w-28">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.partner_sku_name}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {catalogName(r.nwcs_catalog) ?? (
                  <span className="italic">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.units_sold}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.on_hand ?? "—"}
              </td>
              <td className="px-3 py-2">{statusBadge(r.mapping_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
