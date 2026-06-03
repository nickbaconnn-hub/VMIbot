import "server-only";
import type { Order } from "@/types/db";

/**
 * Phase 2 entry point — stub.
 *
 * Full implementation pending:
 *   1. CulteveraClient.fetchInventory() → save as cultivera_inventory_snapshot
 *   2. Load snapshot_rows where mapping_status = 'mapped'
 *   3. Load active NWCS catalog
 *   4. For each row: roundOrderQty, check inventory, substitute if OOS,
 *      collect warnings, build LineItem
 *   5. generateOrderNotes(lineItems)
 *   6. Insert into orders table and return
 */
export type BuildDraftOrderParams = {
  partnerId: string;
  snapshotId: string;
  userId: string;
};

export async function buildDraftOrder(
  params: BuildDraftOrderParams,
): Promise<Order> {
  void params;
  throw new Error(
    "buildDraftOrder not implemented — Phase 2 build is scaffolded only.",
  );
}
