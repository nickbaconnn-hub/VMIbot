import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { SnapshotTable } from "./snapshot-table";

type Search = {
  filter?: "all" | "mapped" | "unmapped" | "ignored";
};

export default async function SnapshotReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; snapshotId: string }>;
  searchParams: Promise<Search>;
}) {
  const { id, snapshotId } = await params;
  const search = await searchParams;
  const filter = search.filter ?? "all";
  const supabase = await createSupabaseServerClient();

  const { data: snapshot } = await supabase
    .from("snapshots")
    .select("id, uploaded_at, source_file_name, row_count, lookback_days_used")
    .eq("id", snapshotId)
    .eq("partner_id", id)
    .maybeSingle();
  if (!snapshot) notFound();

  let q = supabase
    .from("snapshot_rows")
    .select(
      "id, partner_sku_name, units_sold, on_hand, mapping_status, nwcs_catalog_id, nwcs_catalog:nwcs_catalog_id(name, sku)",
    )
    .eq("snapshot_id", snapshotId)
    .order("units_sold", { ascending: false });

  if (filter === "mapped") q = q.eq("mapping_status", "mapped");
  else if (filter === "unmapped") q = q.eq("mapping_status", "pending");
  else if (filter === "ignored") q = q.eq("mapping_status", "unmapped_ignored");

  const { data: rows } = await q;

  const { count: unmappedCount } = await supabase
    .from("snapshot_rows")
    .select("id", { count: "exact", head: true })
    .eq("snapshot_id", snapshotId)
    .eq("mapping_status", "pending");

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">
            {snapshot.source_file_name ?? "Snapshot"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Uploaded {new Date(snapshot.uploaded_at).toLocaleString()} ·{" "}
            {snapshot.row_count} rows · lookback {snapshot.lookback_days_used}d
          </p>
        </div>
        {(unmappedCount ?? 0) > 0 && (
          <Link
            href={`/partners/${id}/snapshots/${snapshotId}/unmapped`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <AlertTriangle className="h-4 w-4" />
            {unmappedCount} unmapped — resolve
          </Link>
        )}
      </div>

      {(unmappedCount ?? 0) > 0 && (
        <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 px-3 py-2 text-sm">
          <span className="font-medium">{unmappedCount}</span> of {snapshot.row_count}{" "}
          rows unmapped.{" "}
          <Link
            href={`/partners/${id}/snapshots/${snapshotId}/unmapped`}
            className="underline"
          >
            Jump to unmapped queue →
          </Link>
        </div>
      )}

      <div className="flex gap-1 text-sm">
        <FilterLink
          partnerId={id}
          snapshotId={snapshotId}
          value="all"
          active={filter}
          label="All"
        />
        <FilterLink
          partnerId={id}
          snapshotId={snapshotId}
          value="mapped"
          active={filter}
          label="Mapped"
        />
        <FilterLink
          partnerId={id}
          snapshotId={snapshotId}
          value="unmapped"
          active={filter}
          label="Unmapped"
        />
        <FilterLink
          partnerId={id}
          snapshotId={snapshotId}
          value="ignored"
          active={filter}
          label="Ignored"
        />
      </div>

      <SnapshotTable rows={rows ?? []} />
    </div>
  );
}

function FilterLink({
  partnerId,
  snapshotId,
  value,
  active,
  label,
}: {
  partnerId: string;
  snapshotId: string;
  value: string;
  active: string;
  label: string;
}) {
  const href =
    value === "all"
      ? `/partners/${partnerId}/snapshots/${snapshotId}`
      : `/partners/${partnerId}/snapshots/${snapshotId}?filter=${value}`;
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md border transition ${
        active === value
          ? "bg-foreground text-background border-foreground"
          : "hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
