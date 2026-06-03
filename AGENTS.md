<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Browser automation

Before writing any Playwright (or Chrome MCP) automation against Cultivera Pro, Headset, or any third-party site this project touches, read [PLAYWRIGHT_KB.md](./PLAYWRIGHT_KB.md). It captures the auth model, page flow, naming conventions, working selectors, wait strategies, and gotchas learned from prior sessions — so you don't re-discover them.

# "Phase N" — disambiguation

This project has **two unrelated phase tracks**, and the user often says "Phase N" without specifying which. Always ask if it's ambiguous from context.

**Track A — Product pipeline phases** (from `phase2_spec.md` memory; this is the original VMIbot roadmap):
- **Phase 1** — Headset CSV upload → snapshots + snapshot_rows (DONE; `app/(app)/partners/[id]/upload/`)
- **Phase 2** — Cultivera scrape + order builder (`lib/cultivera/client.ts`, `lib/order-builder/build.ts`) — SCAFFOLDED, never run. Selectors in `lib/cultivera/selectors.ts` are placeholders.
- **Phase 3** — End-to-end automation including draft submission (NOT BUILT)

**Track B — Cart-build observability phases** (started 2026-06-01 in this codebase; tracker layer for the cart-build sessions that happen via Chrome MCP):
- **Phase 1** — Map the build flow (DONE; reported in chat, not in repo)
- **Phase 2** — Schema design + migration `supabase/migrations/0003_cart_builds_tracking.sql` (FILE WRITTEN, APPLY PENDING)
- **Phase 3** — Build `scripts/track-cart.ts` CLI + MCP-action auto-capture
- **Phase 4** — Auto-regenerated `VMI_CART_KB.md` from the tracker tables

**Disambiguation rule:** if someone says "Phase 3," default to **Track B** if the context is the tracker/observability/MCP work; **Track A** if it's about end-to-end Cultivera automation. When in doubt, say "Track A Phase 3 (full automation) or Track B Phase 3 (track-cart CLI)?"

**Note for sessions in other repos:** `nwcs-menu-updater` (at `/Users/nickbacon/NWCS INVENTORY`) is a *separate* Playwright project that *also* uses "Phase N" naming for its own pipeline. That project's phases are unrelated to VMIbot's. Confirm which repo you're in (`pwd`) before acting on any "Phase N" instruction.
