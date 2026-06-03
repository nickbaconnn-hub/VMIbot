import type { CatalogItem, InventoryMap } from "./types";

/**
 * Find a substitute when `target` is out of stock.
 *
 * Strict 4-field match required: product_family, strain_type, dosage, format.
 * Candidate must also have > 0 on_hand in Cultivera.
 * If multiple pass: pick the highest on_hand, ties alphabetical by name.
 * If none pass: return null (caller skips the line with no_substitute_available).
 */
export function findSubstitute(
  target: CatalogItem,
  inventory: InventoryMap,
  catalog: CatalogItem[],
): CatalogItem | null {
  const candidates = catalog.filter((c) => {
    if (c.id === target.id) return false;
    if (!c.active) return false;
    if (!sameMeta(c, target)) return false;
    const stock = inventory[c.sku]?.on_hand ?? 0;
    return stock > 0;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aStock = inventory[a.sku]?.on_hand ?? 0;
    const bStock = inventory[b.sku]?.on_hand ?? 0;
    if (aStock !== bStock) return bStock - aStock;
    return a.name.localeCompare(b.name);
  });

  return candidates[0];
}

function sameMeta(a: CatalogItem, b: CatalogItem): boolean {
  // All four must match AND be non-null. The engine fails silently on missing
  // metadata — the seed script is responsible for flagging gaps.
  if (!a.product_family || !b.product_family) return false;
  if (!a.strain_type || !b.strain_type) return false;
  if (!a.dosage || !b.dosage) return false;
  if (!a.format || !b.format) return false;
  return (
    a.product_family === b.product_family &&
    a.strain_type === b.strain_type &&
    a.dosage === b.dosage &&
    a.format === b.format
  );
}
