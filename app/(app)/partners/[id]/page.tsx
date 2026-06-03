import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PartnerOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: snapshots } = await supabase
    .from("snapshots")
    .select("id, uploaded_at, source_file_name, row_count")
    .eq("partner_id", id)
    .order("uploaded_at", { ascending: false })
    .limit(10);

  const latest = snapshots?.[0];
  let unmapped = 0;
  if (latest) {
    const { count } = await supabase
      .from("snapshot_rows")
      .select("id", { count: "exact", head: true })
      .eq("snapshot_id", latest.id)
      .eq("mapping_status", "pending");
    unmapped = count ?? 0;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <Link href={`/partners/${id}/upload`} className={buttonVariants()}>
          <Upload className="h-4 w-4" />
          Upload CSV
        </Link>
        {latest && unmapped > 0 && (
          <Link
            href={`/partners/${id}/snapshots/${latest.id}/unmapped`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <AlertTriangle className="h-4 w-4" />
            Resolve {unmapped} unmapped
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {!snapshots || snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No snapshots yet. Upload a Headset CSV to get started.
            </p>
          ) : (
            <ul className="divide-y">
              {snapshots.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <div>
                    <Link
                      href={`/partners/${id}/snapshots/${s.id}`}
                      className="text-sm font-medium hover:underline flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      {s.source_file_name ?? "Snapshot"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.uploaded_at).toLocaleString()} · {s.row_count} rows
                    </div>
                  </div>
                  <Badge variant="outline">{s.row_count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
