# VMI Cart-Build Knowledge Base

> **Auto-generated — do not hand-edit.** Run `npm run kb:regen` to refresh.
> Generated 2026-06-07T02:00:30.017Z from **1 build(s)** (1 completed),
> **52 line decision(s)**, **0 browser action(s)**.
>
> Curated prose (auth model, naming conventions, the canonical flow) lives in
> [PLAYWRIGHT_KB.md](./PLAYWRIGHT_KB.md). This file is the *empirical* layer: what
> actually happened across real builds. Read both before building a cart.

## How to use this at the start of a build
1. Find the target account under **Per-account quirks** — check its recurring
   OOS items and substitution history so you don't waste searches.
2. Skim **Known failure modes** so you recognize the retry/fallback patterns.
3. Prefer selectors marked ✅ stable; treat ⚠️ flaky and coordinate selectors
   with the documented fallbacks.

## Confirmed build flow (by driver)

### Driver: `chrome_mcp` — 1 build(s)

Action frequency (most common first):

| Action | Times | OK rate |
|---|---|---|


## Selectors: stable vs flaky

_No selector data yet._

## Decision rules that have held up

Outcome distribution across all recorded lines:

| Outcome | Lines | Share |
|---|---|---|
| filled | 37 | 71% |
| skipped | 13 | 25% |
| not_found | 2 | 4% |

Reason distribution:

| Reason | Lines | Share |
|---|---|---|
| matched_clean | 37 | 71% |
| out_of_stock | 12 | 23% |
| product_not_found | 2 | 4% |
| no_substitute | 1 | 2% |

## Known failure modes + fallbacks

_No failures recorded yet. Known modes (from prior sessions) are in PLAYWRIGHT_KB.md §1.7._

## Per-account quirks

### FLOYDS SEDRO WOOLLEY

- Builds recorded: **1**
- Avg cart line count: 37
- Sheet-total match rate: — (0/0)
- Lines partial-filled: 0
- Substitutions: 0
- Recurring out-of-stock items:
  - Legends Blue Runtz (2×)
  - Crystal Clear Blue Dream (1×)
  - 1988 Blunts Maui Wowie (1×)
  - Crystal Clear Pink Cookies (1×)
  - Crystal Clear Grape Pie (1×)
  - Crystal Clear Pink Ink (1×)
  - Mini Budz Super Boof (1×)
  - Crystal Clear Nerdz (1×)
  - 1988 Blunts Northern Lights (1×)
  - Mini Budz Candyland (1×)

