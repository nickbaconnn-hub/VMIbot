"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePartnerSkuMap(opts: {
  id: string;
  partnerId: string;
  nwcsCatalogId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("partner_sku_map")
    .update({ nwcs_catalog_id: opts.nwcsCatalogId })
    .eq("id", opts.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${opts.partnerId}/mappings`);
}

export async function deletePartnerSkuMap(opts: {
  id: string;
  partnerId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("partner_sku_map")
    .delete()
    .eq("id", opts.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/partners/${opts.partnerId}/mappings`);
}
