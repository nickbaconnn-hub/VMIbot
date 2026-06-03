/**
 * Round Headset's Minimum Suggested Order (MSO) to an order quantity per
 * Nick's rule: nearest multiple of 5, ties go DOWN. MSO < 4 → skip entirely
 * (not an order line at all, not a skipped line).
 *
 * Reference table (from Phase 2 spec):
 *   1/2/3  → null (skip)
 *   4/5/6  → 5
 *   7/8/9  → 10
 *   10/11  → 10
 *   12/13/14 → 15
 *   15/16  → 15
 *   17/18/19 → 20
 *   20/21  → 20
 */
export function roundOrderQty(mso: number): number | null {
  if (!Number.isFinite(mso)) return null;
  if (mso < 4) return null;
  const remainder = mso % 5;
  if (remainder === 0) return mso;
  // +1 over a breakpoint rounds DOWN; +2 or more rounds UP.
  if (remainder === 1) return mso - 1;
  return mso + (5 - remainder);
}
