import type { NwcsCatalogItem } from "@/types/db";

export type LineItemStatus = "filled" | "substituted" | "partial" | "skipped";
export type SkipReason = "no_substitute_available" | "insufficient_stock";
export type LineItemWarning =
  | "low_percent_days_in_stock"
  | "high_mso"
  | "partial_fill"
  | "substituted"
  | "skipped_no_substitute";

export type LineItem = {
  partner_sku_name: string;
  nwcs_catalog_id: string;
  nwcs_sku: string;
  nwcs_name: string;
  mso: number;
  qty_ordered: number;
  status: LineItemStatus;
  substitution: {
    original_catalog_id: string;
    original_name: string;
    reason: "out_of_stock";
  } | null;
  skip_reason: SkipReason | null;
  warnings: LineItemWarning[];
};

export type InventoryMap = Record<string, { on_hand: number }>;

export type CatalogItem = NwcsCatalogItem;
