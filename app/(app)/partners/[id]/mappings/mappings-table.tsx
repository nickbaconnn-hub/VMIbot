"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";
import type { NwcsCatalogItem } from "@/types/db";
import { updatePartnerSkuMap, deletePartnerSkuMap } from "./actions";

type Row = {
  id: string;
  partner_sku_name: string;
  nwcs_catalog_id: string;
  confidence: string;
  created_by: string | null;
  catalog_name: string;
  catalog_sku: string;
};

export function MappingsTable({
  partnerId,
  rows,
  catalog,
}: {
  partnerId: string;
  rows: Row[];
  catalog: NwcsCatalogItem[];
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.partner_sku_name.toLowerCase().includes(q) ||
        r.catalog_name.toLowerCase().includes(q) ||
        r.catalog_sku.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  if (rows.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">
        No mappings yet. Confirm rows in the unmapped queue after uploading a snapshot.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter mappings…"
        className="max-w-sm"
      />
      <div className="border rounded-md overflow-hidden text-sm">
        <table className="w-full">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Partner SKU</th>
              <th className="text-left px-3 py-2 font-medium">NWCS product</th>
              <th className="text-left px-3 py-2 font-medium">SKU</th>
              <th className="text-left px-3 py-2 font-medium">Source</th>
              <th className="w-40"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <MappingRowView
                key={r.id}
                row={r}
                catalog={catalog}
                partnerId={partnerId}
              />
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="text-xs text-muted-foreground">No matches for filter.</div>
      )}
    </div>
  );
}

function MappingRowView({
  row,
  catalog,
  partnerId,
}: {
  row: Row;
  catalog: NwcsCatalogItem[];
  partnerId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draftId, setDraftId] = useState(row.nwcs_catalog_id);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const draftItem = useMemo(
    () => catalog.find((c) => c.id === draftId) ?? null,
    [catalog, draftId],
  );

  async function save() {
    start(async () => {
      try {
        await updatePartnerSkuMap({ id: row.id, partnerId, nwcsCatalogId: draftId });
        toast.success("Mapping updated");
        setEditing(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  async function remove() {
    if (!confirm(`Delete mapping for "${row.partner_sku_name}"?`)) return;
    start(async () => {
      try {
        await deletePartnerSkuMap({ id: row.id, partnerId });
        toast.success("Mapping deleted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-mono text-xs">{row.partner_sku_name}</td>
      <td className="px-3 py-2">
        {editing ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "justify-start w-full",
              )}
            >
              <span className="truncate">{draftItem?.name ?? "Pick…"}</span>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search catalog…" />
                <CommandList>
                  <CommandEmpty>No items.</CommandEmpty>
                  <CommandGroup>
                    {catalog.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.sku}`}
                        onSelect={() => {
                          setDraftId(c.id);
                          setOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.sku}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          row.catalog_name
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
        {editing ? draftItem?.sku ?? "—" : row.catalog_sku}
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className="text-xs">
          {row.created_by ?? "?"}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={save}
                disabled={pending || draftId === row.nwcs_catalog_id}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraftId(row.nwcs_catalog_id);
                }}
                disabled={pending}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                disabled={pending}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
