"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Check, ChevronsUpDown } from "lucide-react";
import type { NwcsCatalogItem } from "@/types/db";
import {
  suggestCatalogMatches,
  formatConfidence,
  type CatalogSuggestion,
} from "@/lib/matching/fuzzy";
import {
  confirmMapping,
  skipSkuForSnapshot,
  bulkConfirmSuggestions,
} from "./actions";
import { cn } from "@/lib/utils";

type Row = {
  partner_sku_name: string;
  units_sold: number;
  on_hand: number | null;
};

const BULK_THRESHOLD = 0.95;

export function UnmappedQueue({
  partnerId,
  snapshotId,
  rows,
  catalog,
}: {
  partnerId: string;
  snapshotId: string;
  rows: Row[];
  catalog: NwcsCatalogItem[];
}) {
  const router = useRouter();
  const [bulking, startBulk] = useTransition();

  // Precompute top suggestion for each row — used for bulk button + display.
  const suggestionsByRow = useMemo(() => {
    const out = new Map<string, CatalogSuggestion[]>();
    for (const r of rows) {
      out.set(r.partner_sku_name, suggestCatalogMatches(r.partner_sku_name, catalog, 3));
    }
    return out;
  }, [rows, catalog]);

  const highConfidenceCount = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      const top = suggestionsByRow.get(r.partner_sku_name)?.[0];
      if (top && top.score >= BULK_THRESHOLD) n++;
    }
    return n;
  }, [rows, suggestionsByRow]);

  async function onBulkConfirm() {
    const items: { partnerSkuName: string; nwcsCatalogId: string }[] = [];
    for (const r of rows) {
      const top = suggestionsByRow.get(r.partner_sku_name)?.[0];
      if (top && top.score >= BULK_THRESHOLD) {
        items.push({
          partnerSkuName: r.partner_sku_name,
          nwcsCatalogId: top.item.id,
        });
      }
    }
    startBulk(async () => {
      try {
        const res = await bulkConfirmSuggestions({
          partnerId,
          snapshotId,
          items,
        });
        toast.success(`Confirmed ${res.confirmed} rows`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Bulk confirm failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      {highConfidenceCount > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{highConfidenceCount}</span> row
            {highConfidenceCount === 1 ? " has" : "s have"} a ≥95% match. Spot-check
            first.
          </div>
          <Button size="sm" onClick={onBulkConfirm} disabled={bulking}>
            {bulking ? "Confirming…" : `Confirm all ≥95%`}
          </Button>
        </div>
      )}

      <div className="border rounded-md divide-y">
        {rows.map((r) => (
          <UnmappedRow
            key={r.partner_sku_name}
            partnerId={partnerId}
            snapshotId={snapshotId}
            row={r}
            catalog={catalog}
            suggestions={suggestionsByRow.get(r.partner_sku_name) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function UnmappedRow({
  partnerId,
  snapshotId,
  row,
  catalog,
  suggestions,
}: {
  partnerId: string;
  snapshotId: string;
  row: Row;
  catalog: NwcsCatalogItem[];
  suggestions: CatalogSuggestion[];
}) {
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    suggestions[0]?.item.id ?? null,
  );
  const router = useRouter();

  async function confirm(id: string) {
    start(async () => {
      try {
        await confirmMapping({
          partnerId,
          snapshotId,
          partnerSkuName: row.partner_sku_name,
          nwcsCatalogId: id,
        });
        toast.success(`Mapped: ${row.partner_sku_name}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to confirm");
      }
    });
  }

  async function skip() {
    start(async () => {
      try {
        await skipSkuForSnapshot({
          partnerId,
          snapshotId,
          partnerSkuName: row.partner_sku_name,
        });
        toast.success(`Skipped: ${row.partner_sku_name}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to skip");
      }
    });
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="font-mono text-sm">{row.partner_sku_name}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {row.units_sold} units sold · {row.on_hand ?? "—"} on hand
        </div>
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Suggestions
            </div>
            {suggestions.map((s) => (
              <button
                key={s.item.id}
                onClick={() => setSelectedId(s.item.id)}
                className={cn(
                  "w-full text-left flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm transition",
                  selectedId === s.item.id
                    ? "border-foreground"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="truncate">{s.item.name}</span>
                <Badge
                  variant={s.score >= BULK_THRESHOLD ? "default" : "secondary"}
                  className="shrink-0"
                >
                  {formatConfidence(s.score)}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <CatalogCombobox
          catalog={catalog}
          value={selectedId}
          onChange={setSelectedId}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => selectedId && confirm(selectedId)}
            disabled={!selectedId || pending}
          >
            Confirm mapping
          </Button>
          <Button size="sm" variant="ghost" onClick={skip} disabled={pending}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

function CatalogCombobox({
  catalog,
  value,
  onChange,
}: {
  catalog: NwcsCatalogItem[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => catalog.find((c) => c.id === value) ?? null,
    [catalog, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "justify-between w-full",
        )}
      >
        <span className="truncate text-left">
          {selected ? selected.name : "Pick a catalog item…"}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search catalog…" />
          <CommandList>
            <CommandEmpty>No items found.</CommandEmpty>
            <CommandGroup>
              {catalog.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.sku}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.sku}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

