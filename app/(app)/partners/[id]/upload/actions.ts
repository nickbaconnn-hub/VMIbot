"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ColumnMapping } from "@/types/db";

export type IngestPayload = {
  partnerId: string;
  sourceFileName: string | null;
  mapping: ColumnMapping;
  rawRows: Record<string, unknown>[];
  normalizedRows: {
    partner_sku_name: string;
    units_sold: number;
    on_hand: number | null;
  }[];
};

export async function ingestSnapshot(payload: IngestPayload) {
  const supabase = await createSupabaseServerClient();

  // Load partner's current lookback_days
  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("id, lookback_days")
    .eq("id", payload.partnerId)
    .single();
  if (partnerErr || !partner) throw new Error(partnerErr?.message ?? "Partner not found");

  // Save column mapping for future uploads
  const { error: mapErr } = await supabase
    .from("partner_column_mappings")
    .upsert({
      partner_id: partner.id,
      mapping: payload.mapping,
      updated_at: new Date().toISOString(),
    });
  if (mapErr) throw new Error(mapErr.message);

  // Create snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from("snapshots")
    .insert({
      partner_id: partner.id,
      source_file_name: payload.sourceFileName,
      lookback_days_used: partner.lookback_days,
      raw_rows: payload.rawRows,
      row_count: payload.normalizedRows.length,
      column_mapping: payload.mapping,
    })
    .select("id")
    .single();
  if (snapErr || !snapshot) throw new Error(snapErr?.message ?? "Snapshot insert failed");

  // Translation pass: look up existing mappings for this partner
  const partnerSkuNames = Array.from(
    new Set(payload.normalizedRows.map((r) => r.partner_sku_name)),
  );

  const mappingByName = new Map<string, string>();
  if (partnerSkuNames.length > 0) {
    // Chunk to avoid overly long IN clauses
    const chunkSize = 500;
    for (let i = 0; i < partnerSkuNames.length; i += chunkSize) {
      const chunk = partnerSkuNames.slice(i, i + chunkSize);
      const { data: existing, error } = await supabase
        .from("partner_sku_map")
        .select("partner_sku_name, nwcs_catalog_id")
        .eq("partner_id", partner.id)
        .in("partner_sku_name", chunk);
      if (error) throw new Error(error.message);
      for (const row of existing ?? []) {
        mappingByName.set(row.partner_sku_name, row.nwcs_catalog_id);
      }
    }
  }

  // Build snapshot_rows
  const rowsToInsert = payload.normalizedRows.map((r) => {
    const catalogId = mappingByName.get(r.partner_sku_name) ?? null;
    return {
      snapshot_id: snapshot.id,
      partner_sku_name: r.partner_sku_name,
      units_sold: r.units_sold,
      on_hand: r.on_hand,
      nwcs_catalog_id: catalogId,
      mapping_status: catalogId ? ("mapped" as const) : ("pending" as const),
    };
  });

  // Bulk insert in chunks
  const chunkSize = 500;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    const chunk = rowsToInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from("snapshot_rows").insert(chunk);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath(`/partners/${partner.id}`);
  redirect(`/partners/${partner.id}/snapshots/${snapshot.id}`);
}

export async function getSavedColumnMapping(
  partnerId: string,
): Promise<ColumnMapping | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("partner_column_mappings")
    .select("mapping")
    .eq("partner_id", partnerId)
    .maybeSingle();
  return (data?.mapping as ColumnMapping | undefined) ?? null;
}
