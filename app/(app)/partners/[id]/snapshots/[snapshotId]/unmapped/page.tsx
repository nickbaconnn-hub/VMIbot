import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnmappedQueue } from "./unmapped-queue";
import type { NwcsCatalogItem } from "@/types/db";

type UnmappedRow = {
  partner_sku_name: string;
  units_sold: number;
  on_hand: number | null;
  row_count: number;
};

export default async function UnmappedPage({
  params,
}: {
  params: Promise<{ id: string; snapshotId: string }>;
}) {
  const { id, snapshotId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: snapshot } = await supabase
    .from("snapshots")
    .select("id, partner_id")
    .eq("id", snapshotId)
    .eq("partner_id", id)
    .maybeSingle();
  if (!snapshot) notFound();

  const { data: rows } = await supabase
    .from("snapshot_rows")
    .select("partner_sku_name, units_sold, on_hand")
    .eq("snapshot_id", snapshotId)
    .eq("mapping_status", "pending");

  // De-dupe by partner_sku_name, aggregating units/on_hand.
  const grouped = new Map<string, UnmappedRow>();
  for (const r of rows ?? []) {
    const existing = grouped.get(r.partner_sku_name);
    if (existing) {
      existing.units_sold += Number(r.units_sold);
      existing.on_hand =
        existing.on_hand == null && r.on_hand == null
          ? null
          : (existing.on_hand ?? 0) + (r.on_hand ?? 0);
      existing.row_count += 1;
    } else {
      grouped.set(r.partner_sku_name, {
        partner_sku_name: r.partner_sku_name,
        units_sold: Number(r.units_sold),
        on_hand: r.on_hand == null ? null : Number(r.on_hand),
        row_count: 1,
      });
    }
  }
  const unmapped = Array.from(grouped.values()).sort(
    (a, b) => b.units_sold - a.units_sold,
  );

  const { data: catalog } = await supabase
    .from("nwcs_catalog")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Unmapped SKU queue</h2>
          <p className="text-sm text-muted-foreground">
            {unmapped.length} unique partner SKU{unmapped.length === 1 ? "" : "s"}{" "}
            need mapping.{" "}
            <Link
              href={`/partners/${id}/snapshots/${snapshotId}`}
              className="underline"
            >
              Back to snapshot
            </Link>
          </p>
        </div>
      </div>

      {unmapped.length === 0 ? (
        <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">
          Nothing to map — every row is resolved.
        </div>
      ) : (
        <UnmappedQueue
          partnerId={id}
          snapshotId={snapshotId}
          rows={unmapped}
          catalog={(catalog ?? []) as NwcsCatalogItem[]}
        />
      )}
    </div>
  );
}
