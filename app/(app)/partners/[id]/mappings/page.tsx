import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MappingsTable } from "./mappings-table";
import type { NwcsCatalogItem } from "@/types/db";

export default async function MappingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!partner) notFound();

  const { data: maps } = await supabase
    .from("partner_sku_map")
    .select(
      "id, partner_sku_name, nwcs_catalog_id, confidence, created_by, created_at, nwcs_catalog:nwcs_catalog_id(id, name, sku)",
    )
    .eq("partner_id", id)
    .order("partner_sku_name", { ascending: true });

  const { data: catalog } = await supabase
    .from("nwcs_catalog")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  type Row = {
    id: string;
    partner_sku_name: string;
    nwcs_catalog_id: string;
    confidence: string;
    created_by: string | null;
    created_at: string;
    nwcs_catalog: { id: string; name: string; sku: string } | { id: string; name: string; sku: string }[] | null;
  };
  const rows = ((maps ?? []) as Row[]).map((m) => {
    const c = Array.isArray(m.nwcs_catalog) ? m.nwcs_catalog[0] : m.nwcs_catalog;
    return {
      id: m.id,
      partner_sku_name: m.partner_sku_name,
      nwcs_catalog_id: m.nwcs_catalog_id,
      confidence: m.confidence,
      created_by: m.created_by,
      created_at: m.created_at,
      catalog_name: c?.name ?? "—",
      catalog_sku: c?.sku ?? "—",
    };
  });

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div>
        <h2 className="text-lg font-semibold">Translation mappings</h2>
        <p className="text-sm text-muted-foreground">
          {rows.length} partner SKU{rows.length === 1 ? "" : "s"} mapped to NWCS
          catalog items.
        </p>
      </div>
      <MappingsTable
        partnerId={id}
        rows={rows}
        catalog={(catalog ?? []) as NwcsCatalogItem[]}
      />
    </div>
  );
}
