import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UploadClient } from "./upload-client";
import { getSavedColumnMapping } from "./actions";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!partner) notFound();

  const saved = await getSavedColumnMapping(partner.id);

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <h2 className="text-lg font-semibold">Upload Headset CSV</h2>
      <p className="text-sm text-muted-foreground">
        Drop a CSV exported from Headset. First upload prompts column mapping; we
        save it for next time.
      </p>
      <UploadClient partnerId={partner.id} savedMapping={saved} />
    </div>
  );
}
