"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PartnerFormState = {
  error?: string;
};

function parsePartnerForm(formData: FormData) {
  const name = (formData.get("name") ?? "").toString().trim();
  const location = (formData.get("location") ?? "").toString().trim() || null;
  const lookback = Number(formData.get("lookback_days") ?? 60);
  const doc = Number(formData.get("days_of_cover_target") ?? 21);
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  return {
    name,
    location,
    lookback_days: Number.isFinite(lookback) && lookback > 0 ? lookback : 60,
    days_of_cover_target: Number.isFinite(doc) && doc > 0 ? doc : 21,
    notes,
  };
}

export async function createPartner(
  _prev: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const data = parsePartnerForm(formData);
  if (!data.name) return { error: "Name is required" };

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("partners")
    .insert(data)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/");
  redirect(`/partners/${row.id}`);
}

export async function updatePartner(
  id: string,
  _prev: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const data = parsePartnerForm(formData);
  if (!data.name) return { error: "Name is required" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("partners").update(data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath(`/partners/${id}`);
  revalidatePath(`/partners/${id}/settings`);
  return {};
}

export async function archivePartner(id: string, archived: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("partners")
    .update({ archived })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/partners/${id}`);
}
