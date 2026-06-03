@AGENTS.md

# Before building a cart

Read **[VMI_CART_KB.md](./VMI_CART_KB.md)** at the start of any cart build — it's
the auto-generated empirical record of what actually happened across past builds
(recurring out-of-stock items per account, stable vs flaky selectors, failure
modes + fallbacks). Pair it with [PLAYWRIGHT_KB.md](./PLAYWRIGHT_KB.md) (the
curated flow/selectors/auth reference).

Record every build with the tracker so the KB keeps improving:
`scripts/track-cart.ts` (start / line / action / actions / end) for the manual
Chrome-MCP flow, or `lib/tracker/` for the automated Playwright path. After a
build, run `npm run kb:regen` to refresh VMI_CART_KB.md from the tracker tables.
