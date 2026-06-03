import Fuse from "fuse.js";
import type { NwcsCatalogItem } from "@/types/db";

export type CatalogSuggestion = {
  item: NwcsCatalogItem;
  score: number; // 0..1, higher is better
};

// Fuse.js returns a distance score (0 = perfect, 1 = no match). Invert to 0..1 similarity.
export function suggestCatalogMatches(
  query: string,
  catalog: NwcsCatalogItem[],
  limit = 5,
): CatalogSuggestion[] {
  if (!query.trim() || catalog.length === 0) return [];
  const fuse = new Fuse(catalog, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "product_family", weight: 0.2 },
      { name: "sku", weight: 0.1 },
    ],
    includeScore: true,
    threshold: 0.5,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  return fuse
    .search(query, { limit })
    .map((r) => ({ item: r.item, score: 1 - (r.score ?? 1) }));
}

export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}% match`;
}
