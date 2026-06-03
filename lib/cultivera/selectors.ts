/**
 * Cultivera DOM selectors.
 *
 * These are NOT final — they will be replaced with values generated from
 *   npx playwright codegen $CULTIVERA_URL
 * during Phase 2 kickoff. Prefer, in order:
 *   1. data-* attributes
 *   2. role / aria-label
 *   3. stable class names
 *   4. structural selectors (last resort)
 *
 * Each selector is a placeholder that WILL cause the client to throw until
 * the codegen pass replaces it.
 */
export const SELECTORS = {
  login: {
    username: 'input[name="username"]',
    password: 'input[name="password"]',
    submit: 'button[type="submit"]',
  },
  dashboard: {
    // A stable element that only appears post-login.
    marker: '[data-test="dashboard"]',
  },
  nav: {
    inventoryTab: 'a:has-text("Inventory")',
  },
  inventory: {
    // A selector that resolves only when the inventory table has finished loading.
    tableReady: '[data-test="inventory-table"]',
    rows: '[data-test="inventory-row"]',
    // Column selectors relative to a row
    cellSku: '[data-test="cell-sku"]',
    cellName: '[data-test="cell-name"]',
    cellOnHand: '[data-test="cell-on-hand"]',
    // Pagination — set to null if Cultivera uses infinite scroll / load-more
    nextPage: '[data-test="pagination-next"]',
    // Alternatively, for load-more / infinite scroll, to be resolved at codegen time:
    loadMore: null as string | null,
  },
} as const;
