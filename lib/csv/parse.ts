import Papa from "papaparse";
import type { ColumnMapping } from "@/types/db";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

// Headset / NWCS Inventory Details format defaults.
// Matches the Inventory Details.xlsx exports the team currently uses.
export const HEADSET_DEFAULT_MAPPING: ColumnMapping = {
  partner_sku_name: "Name",
  units_sold: "Total Units Sold",
  on_hand: "Total Quantity on Hand",
};

// Candidate header names we'll try to auto-detect per field.
const HEADER_CANDIDATES: Record<keyof ColumnMapping, string[]> = {
  partner_sku_name: ["name", "product name", "product", "item name", "sku name"],
  units_sold: [
    "total units sold",
    "units sold",
    "qty sold",
    "quantity sold",
    "sold units",
  ],
  on_hand: [
    "total quantity on hand",
    "quantity on hand",
    "on hand",
    "qty on hand",
    "stock on hand",
    "total on hand",
  ],
};

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const pick = (field: keyof ColumnMapping): string | null => {
    for (const cand of HEADER_CANDIDATES[field]) {
      const hit = normalized.find((h) => h.norm === cand);
      if (hit) return hit.raw;
    }
    // Fallback: includes
    for (const cand of HEADER_CANDIDATES[field]) {
      const hit = normalized.find((h) => h.norm.includes(cand));
      if (hit) return hit.raw;
    }
    return null;
  };
  return {
    partner_sku_name: pick("partner_sku_name") ?? "",
    units_sold: pick("units_sold") ?? "",
    on_hand: pick("on_hand"),
  };
}

export type NormalizedSnapshotRow = {
  partner_sku_name: string;
  units_sold: number;
  on_hand: number | null;
};

export function normalizeRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): NormalizedSnapshotRow[] {
  const out: NormalizedSnapshotRow[] = [];
  for (const row of rows) {
    const name = (row[mapping.partner_sku_name] ?? "").toString().trim();
    if (!name) continue;
    const unitsRaw = row[mapping.units_sold];
    const units = parseNum(unitsRaw);
    if (units === null) continue;
    const onHand = mapping.on_hand ? parseNum(row[mapping.on_hand]) : null;
    out.push({
      partner_sku_name: name,
      units_sold: units,
      on_hand: onHand,
    });
  }
  return out;
}

function parseNum(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}
