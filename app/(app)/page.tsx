import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, Archive } from "lucide-react";

type PartnerCard = {
  id: string;
  name: string;
  location: string | null;
  archived: boolean;
  last_snapshot_at: string | null;
  unmapped_count: number;
};

async function loadPartners(): Promise<PartnerCard[]> {
  const supabase = await createSupabaseServerClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("id, name, location, archived")
    .order("archived", { ascending: true })
    .order("name", { ascending: true });
  if (!partners) return [];

  const results: PartnerCard[] = [];
  for (const p of partners) {
    const { data: latest } = await supabase
      .from("snapshots")
      .select("id, uploaded_at")
      .eq("partner_id", p.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let unmapped = 0;
    if (latest) {
      const { count } = await supabase
        .from("snapshot_rows")
        .select("id", { count: "exact", head: true })
        .eq("snapshot_id", latest.id)
        .eq("mapping_status", "pending");
      unmapped = count ?? 0;
    }

    results.push({
      id: p.id,
      name: p.name,
      location: p.location,
      archived: p.archived,
      last_snapshot_at: latest?.uploaded_at ?? null,
      unmapped_count: unmapped,
    });
  }
  return results;
}

export default async function DashboardPage() {
  const partners = await loadPartners();
  const active = partners.filter((p) => !p.archived);
  const archived = partners.filter((p) => p.archived);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Partners</h1>
          <p className="text-sm text-muted-foreground">
            NWCS VMI retail accounts
          </p>
        </div>
        <Link href="/partners/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          New partner
        </Link>
      </div>

      {active.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No partners yet.{" "}
            <Link href="/partners/new" className="underline">
              Create your first partner
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((p) => (
            <PartnerCardView key={p.id} partner={p} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="pt-6">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
            <Archive className="h-4 w-4" /> Archived
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((p) => (
              <PartnerCardView key={p.id} partner={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PartnerCardView({ partner }: { partner: PartnerCard }) {
  return (
    <Card className={partner.archived ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle className="text-base">
          <Link href={`/partners/${partner.id}`} className="hover:underline">
            {partner.name}
          </Link>
        </CardTitle>
        <CardDescription>
          {partner.location ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Last snapshot:{" "}
          {partner.last_snapshot_at
            ? new Date(partner.last_snapshot_at).toLocaleString()
            : "never"}
        </div>
        <div className="flex items-center gap-2">
          {partner.unmapped_count > 0 ? (
            <Badge variant="destructive">{partner.unmapped_count} unmapped</Badge>
          ) : partner.last_snapshot_at ? (
            <Badge variant="secondary">All mapped</Badge>
          ) : (
            <Badge variant="outline">No data</Badge>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Link
            href={`/partners/${partner.id}/upload`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload CSV
          </Link>
          <Link
            href={`/partners/${partner.id}`}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            Open
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
