import type { InventoryItem } from "./types";

export type RawInventoryRow = {
  sku: string | null;
  name: string | null;
  on_hand: string | null;
};

/**
 * Normalize raw scraped cells into clean InventoryItem objects.
 * Drops rows where any required field is blank.
 */
export function parseInventoryTable(rows: RawInventoryRow[]): InventoryItem[] {
  const out: InventoryItem[] = [];
  for (const r of rows) {
    const sku = r.sku?.trim();
    const name = r.name?.trim();
    if (!sku || !name) continue;
    const onHand = parseNumber(r.on_hand);
    if (onHand === null) continue;
    out.push({ sku, name, on_hand: onHand });
  }
  return out;
}

function parseNumber(v: string | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  const s = v.trim().replace(/[,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
