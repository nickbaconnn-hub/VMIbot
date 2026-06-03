"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function confirmMapping(opts: {
  partnerId: string;
  snapshotId: string;
  partnerSkuName: string;
  nwcsCatalogId: string;
  createdBy?: string;
}) {
  const { partnerId, snapshotId, partnerSkuName, nwcsCatalogId } = opts;
  const supabase = await createSupabaseServerClient();

  // Upsert permanent mapping
  const { error: upsertErr } = await supabase.from("partner_sku_map").upsert(
    {
      partner_id: partnerId,
      partner_sku_name: partnerSkuName,
      nwcs_catalog_id: nwcsCatalogId,
      confidence: "confirmed",
      created_by: opts.createdBy ?? "user",
    },
    { onConflict: "partner_id,partner_sku_name" },
  );
  if (upsertErr) throw new Error(upsertErr.message);

  // Apply to all pending rows in this snapshot with the same name (dedup safety).
  const { error: rowErr } = await supabase
    .from("snapshot_rows")
    .update({
      nwcs_catalog_id: nwcsCatalogId,
      mapping_status: "mapped",
    })
    .eq("snapshot_id", snapshotId)
    .eq("partner_sku_name", partnerSkuName)
    .eq("mapping_status", "pending");
  if (rowErr) throw new Error(rowErr.message);

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath(`/partners/${partnerId}/snapshots/${snapshotId}`);
  revalidatePath(`/partners/${partnerId}/snapshots/${snapshotId}/unmapped`);
  revalidatePath(`/partners/${partnerId}/mappings`);
}

export async function skipSkuForSnapshot(opts: {
  partnerId: string;
  snapshotId: string;
  partnerSkuName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("snapshot_rows")
    .update({ mapping_status: "unmapped_ignored" })
    .eq("snapshot_id", opts.snapshotId)
    .eq("partner_sku_name", opts.partnerSkuName)
    .eq("mapping_status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${opts.partnerId}/snapshots/${opts.snapshotId}`);
  revalidatePath(
    `/partners/${opts.partnerId}/snapshots/${opts.snapshotId}/unmapped`,
  );
}

export async function bulkConfirmSuggestions(opts: {
  partnerId: string;
  snapshotId: string;
  items: { partnerSkuName: string; nwcsCatalogId: string }[];
}) {
  const supabase = await createSupabaseServerClient();
  if (opts.items.length === 0) return { confirmed: 0 };

  const mapRows = opts.items.map((i) => ({
    partner_id: opts.partnerId,
    partner_sku_name: i.partnerSkuName,
    nwcs_catalog_id: i.nwcsCatalogId,
    confidence: "confirmed" as const,
    created_by: "bulk-suggest",
  }));
  const { error: upsertErr } = await supabase
    .from("partner_sku_map")
    .upsert(mapRows, { onConflict: "partner_id,partner_sku_name" });
  if (upsertErr) throw new Error(upsertErr.message);

  // For each item, update matching snapshot rows.
  let confirmed = 0;
  for (const item of opts.items) {
    const { data: updated, error } = await supabase
      .from("snapshot_rows")
      .update({
        nwcs_catalog_id: item.nwcsCatalogId,
        mapping_status: "mapped",
      })
      .eq("snapshot_id", opts.snapshotId)
      .eq("partner_sku_name", item.partnerSkuName)
      .eq("mapping_status", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    confirmed += updated?.length ?? 0;
  }

  revalidatePath(`/partners/${opts.partnerId}`);
  revalidatePath(`/partners/${opts.partnerId}/snapshots/${opts.snapshotId}`);
  revalidatePath(
    `/partners/${opts.partnerId}/snapshots/${opts.snapshotId}/unmapped`,
  );
  revalidatePath(`/partners/${opts.partnerId}/mappings`);
  return { confirmed };
}
