import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartnerTabs } from "./partner-tabs";

export default async function PartnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("id, name, location, archived")
    .eq("id", id)
    .maybeSingle();

  if (!partner) notFound();

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b px-6 pt-6 pb-3 space-y-3">
        <div className="text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            Partners
          </Link>
          <span className="mx-1.5">/</span>
          <span>{partner.name}</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">
            {partner.name}
            {partner.archived && (
              <span className="ml-2 text-xs font-normal rounded bg-muted px-2 py-0.5 align-middle">
                archived
              </span>
            )}
          </h1>
          {partner.location && (
            <p className="text-sm text-muted-foreground">{partner.location}</p>
          )}
        </div>
        <PartnerTabs partnerId={partner.id} />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
