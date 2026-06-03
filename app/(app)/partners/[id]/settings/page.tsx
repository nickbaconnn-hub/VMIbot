import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartnerForm } from "../../partner-form";
import { updatePartner } from "../../actions";
import { ArchiveToggle } from "./archive-toggle";

export default async function PartnerSettings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!partner) notFound();

  const boundUpdate = updatePartner.bind(null, id);

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <section>
        <h2 className="text-lg font-semibold mb-4">Partner details</h2>
        <PartnerForm action={boundUpdate} defaults={partner} submitLabel="Save changes" />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">Archive</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Archiving hides this partner from the dashboard. Data is preserved.
        </p>
        <ArchiveToggle partnerId={id} archived={partner.archived} />
      </section>
    </div>
  );
}
