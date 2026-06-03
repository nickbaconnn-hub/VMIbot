import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EndBuildInput,
  LogActionInput,
  LogLineInput,
  StartBuildInput,
} from "./types";

/**
 * CartBuildTracker — programmatic tracker for the automated (Playwright) build
 * path. The manual / Chrome-MCP path uses the equivalent CLI in
 * scripts/track-cart.ts; both write to the same tables (migration 0003).
 *
 * The tracker keeps an in-memory step counter so callers don't have to manage
 * step_index. It NEVER throws on a logging failure — observability must not
 * break a build — it warns and continues.
 */
export class CartBuildTracker {
  private stepIndex = 0;

  private constructor(
    private readonly sb: SupabaseClient,
    public readonly buildId: string,
  ) {}

  /** Begin a build; inserts the cart_builds row and returns a live tracker. */
  static async start(
    sb: SupabaseClient,
    input: StartBuildInput,
  ): Promise<CartBuildTracker> {
    const { data, error } = await sb
      .from("cart_builds")
      .insert({
        partner_id: input.partnerId,
        snapshot_id: input.snapshotId ?? null,
        source_type: input.sourceType,
        source_filename: input.sourceFilename ?? null,
        source_account_label: input.sourceAccountLabel ?? null,
        cultivera_account_label: input.cultiveraAccountLabel ?? null,
        cultivera_account_url: input.cultiveraAccountUrl ?? null,
        driver: input.driver,
        viewport_width: input.viewportWidth ?? null,
        viewport_height: input.viewportHeight ?? null,
        agent_session_id: input.agentSessionId ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`CartBuildTracker.start failed: ${error?.message}`);
    }
    return new CartBuildTracker(sb, data.id as string);
  }

  /** Log a per-line decision; returns the line id (or null on failure). */
  async logLine(input: LogLineInput): Promise<string | null> {
    const { data, error } = await this.sb
      .from("cart_build_lines")
      .insert({
        cart_build_id: this.buildId,
        source_line_index: input.sourceLineIndex ?? null,
        source_strain: input.sourceStrain,
        source_brand: input.sourceBrand ?? null,
        source_format: input.sourceFormat ?? null,
        source_unit_price_cents: input.sourceUnitPriceCents ?? null,
        target_qty: input.targetQty ?? null,
        mso: input.mso ?? null,
        outcome: input.outcome,
        outcome_reason: input.outcomeReason,
        outcome_reason_detail: input.outcomeReasonDetail ?? null,
        picked_product_name: input.pickedProductName ?? null,
        picked_unit_price_cents: input.pickedUnitPriceCents ?? null,
        picked_qty: input.pickedQty ?? null,
        substituted_from_strain: input.substitutedFromStrain ?? null,
        substituted_from_brand: input.substitutedFromBrand ?? null,
        searches_attempted: input.searchesAttempted ?? [],
        candidates_considered: input.candidatesConsidered ?? [],
      })
      .select("id")
      .single();
    if (error || !data) {
      console.warn(`[tracker] logLine failed: ${error?.message}`);
      return null;
    }
    return data.id as string;
  }

  /** Log a single browser action. step_index auto-assigned if omitted. */
  async logAction(input: LogActionInput): Promise<void> {
    const step = input.stepIndex ?? this.stepIndex++;
    const { error } = await this.sb.from("cart_build_actions").insert({
      cart_build_id: this.buildId,
      cart_build_line_id: input.cartBuildLineId ?? null,
      step_index: step,
      action: input.action,
      selector_kind: input.selectorKind ?? null,
      selector: input.selector ?? null,
      target_description: input.targetDescription ?? null,
      input_value: input.inputValue ?? null,
      result: input.result,
      result_detail: input.resultDetail ?? null,
      attempt: input.attempt ?? 1,
      duration_ms: input.durationMs ?? null,
      mcp_tool: input.mcpTool ?? null,
    });
    if (error) console.warn(`[tracker] logAction failed: ${error.message}`);
  }

  /** Bulk-insert many actions in one round trip (preferred in hot loops). */
  async logActions(inputs: LogActionInput[]): Promise<void> {
    if (inputs.length === 0) return;
    const rows = inputs.map((input) => ({
      cart_build_id: this.buildId,
      cart_build_line_id: input.cartBuildLineId ?? null,
      step_index: input.stepIndex ?? this.stepIndex++,
      action: input.action,
      selector_kind: input.selectorKind ?? null,
      selector: input.selector ?? null,
      target_description: input.targetDescription ?? null,
      input_value: input.inputValue ?? null,
      result: input.result,
      result_detail: input.resultDetail ?? null,
      attempt: input.attempt ?? 1,
      duration_ms: input.durationMs ?? null,
      mcp_tool: input.mcpTool ?? null,
    }));
    const { error } = await this.sb.from("cart_build_actions").insert(rows);
    if (error) console.warn(`[tracker] logActions failed: ${error.message}`);
  }

  /** Finalize the build. */
  async end(input: EndBuildInput = {}): Promise<void> {
    const patch: Record<string, unknown> = {
      status: input.status ?? "completed",
      ended_at: new Date().toISOString(),
    };
    if (input.cartLineCount != null) patch.cart_line_count = input.cartLineCount;
    if (input.cartListTotalCents != null)
      patch.cart_list_total_cents = input.cartListTotalCents;
    if (input.cartGrandTotalCents != null)
      patch.cart_grand_total_cents = input.cartGrandTotalCents;
    if (input.sheetExpectedTotalCents != null)
      patch.sheet_expected_total_cents = input.sheetExpectedTotalCents;
    if (input.notes != null) patch.notes = input.notes;

    const { error } = await this.sb
      .from("cart_builds")
      .update(patch)
      .eq("id", this.buildId);
    if (error) console.warn(`[tracker] end failed: ${error.message}`);
  }
}
