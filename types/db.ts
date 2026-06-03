// Phase 1 DB types — keep in sync with supabase/migrations/0001_phase1_schema.sql
// Regenerate from Supabase CLI later: `supabase gen types typescript --project-id ...`

export type MappingStatus = "pending" | "mapped" | "unmapped_ignored";
export type MappingConfidence = "confirmed" | "auto-suggested";
export type OrderStatus = "draft" | "approved" | "submitted" | "cancelled";

export type Partner = {
  id: string;
  name: string;
  location: string | null;
  lookback_days: number;
  days_of_cover_target: number;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type NwcsCatalogItem = {
  id: string;
  sku: string;
  name: string;
  product_family: string | null;
  strain_type: string | null;
  dosage: string | null;
  format: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type PartnerSkuMap = {
  id: string;
  partner_id: string;
  partner_sku_name: string;
  nwcs_catalog_id: string;
  confidence: MappingConfidence;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ColumnMapping = {
  partner_sku_name: string; // CSV column header mapped to partner_sku_name
  units_sold: string;
  on_hand: string | null;
};

export type Snapshot = {
  id: string;
  partner_id: string;
  uploaded_at: string;
  source_file_name: string | null;
  lookback_days_used: number;
  raw_rows: Record<string, unknown>[];
  row_count: number;
  column_mapping: ColumnMapping | null;
  created_at: string;
  updated_at: string;
};

export type SnapshotRow = {
  id: string;
  snapshot_id: string;
  partner_sku_name: string;
  units_sold: number;
  on_hand: number | null;
  nwcs_catalog_id: string | null;
  mapping_status: MappingStatus;
  created_at: string;
  updated_at: string;
};

export type PartnerColumnMapping = {
  partner_id: string;
  mapping: ColumnMapping;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  partner_id: string;
  snapshot_id: string;
  status: OrderStatus;
  line_items: unknown | null;
  created_at: string;
  approved_at: string | null;
  submitted_at: string | null;
  updated_at: string;
};
