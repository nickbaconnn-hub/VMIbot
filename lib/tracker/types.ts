/**
 * Shared types for the cart-build tracker. Literal unions mirror the CHECK
 * constraints in supabase/migrations/0003_cart_builds_tracking.sql — keep them
 * in sync.
 */

export type SourceType = "headset_xlsx" | "nwcs_order_form_xlsx" | "manual_chat";
export type Driver = "chrome_mcp" | "playwright" | "manual_human";
export type BuildStatus = "in_progress" | "completed" | "aborted" | "failed";

export type LineOutcome =
  | "filled"
  | "partial"
  | "substituted"
  | "skipped"
  | "not_found";

export type OutcomeReason =
  | "matched_clean"
  | "partial_inventory"
  | "out_of_stock"
  | "no_substitute"
  | "product_not_found"
  | "mso_under_threshold"
  | "substituted_4field_match"
  | "brand_substitute_fallback"
  | "other";

export type ActionResult =
  | "ok"
  | "retry"
  | "fail"
  | "unexpected_modal"
  | "silent_drop";

export type SelectorKind =
  | "role"
  | "text"
  | "css"
  | "coordinate"
  | "ref"
  | "none";

export type StartBuildInput = {
  partnerId: string;
  snapshotId?: string | null;
  sourceType: SourceType;
  sourceFilename?: string | null;
  sourceAccountLabel?: string | null;
  cultiveraAccountLabel?: string | null;
  cultiveraAccountUrl?: string | null;
  driver: Driver;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  agentSessionId?: string | null;
  notes?: string | null;
};

export type LogLineInput = {
  sourceLineIndex?: number | null;
  sourceStrain: string;
  sourceBrand?: string | null;
  sourceFormat?: string | null;
  sourceUnitPriceCents?: number | null;
  targetQty?: number | null;
  mso?: number | null;
  outcome: LineOutcome;
  outcomeReason: OutcomeReason;
  outcomeReasonDetail?: string | null;
  pickedProductName?: string | null;
  pickedUnitPriceCents?: number | null;
  pickedQty?: number | null;
  substitutedFromStrain?: string | null;
  substitutedFromBrand?: string | null;
  searchesAttempted?: string[];
  candidatesConsidered?: unknown[];
};

export type LogActionInput = {
  cartBuildLineId?: string | null;
  stepIndex?: number; // auto-assigned if omitted
  action: string;
  selectorKind?: SelectorKind | null;
  selector?: string | null;
  targetDescription?: string | null;
  inputValue?: string | null;
  result: ActionResult;
  resultDetail?: string | null;
  attempt?: number;
  durationMs?: number | null;
  mcpTool?: string | null;
};

export type EndBuildInput = {
  status?: BuildStatus;
  cartLineCount?: number | null;
  cartListTotalCents?: number | null;
  cartGrandTotalCents?: number | null;
  sheetExpectedTotalCents?: number | null;
  notes?: string | null;
};
