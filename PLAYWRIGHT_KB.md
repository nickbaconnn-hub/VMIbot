# Playwright Knowledge Base

A reusable reference for browser automation against the third-party systems this app
talks to. Each section captures auth, flow, selectors, waits, and gotchas so the next
agent doesn't have to re-discover them.

## Provenance & confidence

Most of this KB is **translated from Chrome MCP sessions**, not from real Playwright
runs. The Phase 2 Playwright scaffold in `lib/cultivera/client.ts` has never executed
against the live site, and `lib/cultivera/selectors.ts` is still filled with
`[data-test="…"]` placeholders that will throw on first run.

Confidence markers used below:
- **C** — confirmed by direct interaction during a real session (Chrome MCP)
- **G** — guess / suggested mapping; needs validation by a real codegen pass
- **TODO** — never verified at all

Before treating any selector here as production-ready, run `npx playwright codegen
$CULTIVERA_URL` once against the live site and update accordingly.

---

## 1. Cultivera Pro (`wa.cultiverapro.com`)

The vendor sales/CRM. Two distinct flows live here:
1. **Inventory scrape** — read the full product catalog (Phase 2 of VMIbot, scaffold only).
2. **Cart build** — for each retailer, search strains and add qtys (currently driven
   manually via Chrome MCP; see `feedback_cultivera_cart_building.md`).

### 1.1 Auth

**C** — Cookie-based session. There is no programmatic login flow we control. Nick
must log in manually in the browser; we never enter his password. The scaffold's
`/login` form-fill path (`client.ts` lines 64–67) has never been exercised — assume
it's wrong until proven otherwise.

**Recommended pattern for future Playwright runs:**
```ts
// One-time, manual: open a browser, log in by hand, save state.
const context = await browser.newContext();
// ...user logs in manually...
await context.storageState({ path: '.auth/cultivera-state.json' });

// Subsequent runs: skip login entirely.
const context = await browser.newContext({
  storageState: '.auth/cultivera-state.json',
});
```

Add `.auth/` to `.gitignore`. Rotate the file when sessions expire (TBD how long;
**TODO** measure).

### 1.2 URL structure

**C** — The Sales UI is a hash-routed SPA. Tenant + partner IDs ride in the path:
- Products catalog (per partner): `https://wa.cultiverapro.com/sales#/products/{tenantId}/{partnerId}`
- Cart: `https://wa.cultiverapro.com/sales#/cart/{tenantId}`
- Review & submit: `https://wa.cultiverapro.com/sales#/review-order/{tenantId}/{partnerId}`

Observed during this project: tenantId `143297`, partnerId `13906` for "DANKS".
Other partners have different `partnerId`s.

Because routing is hash-based, **the path after `#` does not trigger a real
navigation event**. Wait on a DOM marker, not on `page.waitForURL`.

### 1.3 Cart-build flow (the one that's actually been driven end-to-end)

**C** — Sequence:
1. Land on `…/sales#/accounts` (or click **Accounts** in the left nav).
2. Search the retailer name (e.g. "DANKS", "Lux Lake City").
3. Click the **green cart icon** in the retailer's row.
4. Modal: **"Start new Cart?"** → confirm.
5. Click **"Add Products From Inventory"**.
6. You're now on the per-partner products page.
7. For each line in the source sheet:
   - Type strain into the **Product** search field in the left sidebar.
   - Click **Filter**.
   - Wait ~2s for the table to repopulate.
   - Find the matching row (strain + format + price-disambiguator — see §1.6).
   - Triple-click the **Quantity** input on that row → wait → type qty → wait.
   - Click **Add To Cart** (the action bar button at the top).
   - Wait ~2s for the green "Items Added to Cart" toast and the
     `#Items: NN  Total: $N,NNN.NN` counter to update.
8. When the sheet is exhausted, click **Review Order** to verify the grand total
   matches the sheet, then click **Back to Cart**.
9. **STOP HERE.** Never click Submit Order / Submit as Backorder / Submit & Merge
   Order. Leave the cart for Nick to Accept manually.

### 1.4 Page landmarks (Products page)

Observed in the 1456×829 viewport during cart-build sessions:

| Element | Selector candidate (G) | Coord backup (C) | Notes |
|---|---|---|---|
| Cart summary banner | `text=/^#Items:\\s+\\d+\\s+Total:/` | y≈97 | Source of truth for cart state during a build |
| Review Order button | `getByRole('button', { name: 'Review Order' })` | (335, 122) | Navigates to review-order page |
| Add To Cart (top) | `getByRole('button', { name: 'Add To Cart' })` | (446, 119) | Commits qtys currently typed on the visible page |
| Product (strain) search | `getByLabel('Product')` | (281, 224) | Triple-click to select all before retyping |
| Strains filter | `getByLabel('Strains')` | (281, 282) | Untouched in any session |
| Product Line filter | `getByLabel('Product Line')` | (281, 340) | Untouched; would let us pre-filter by brand prefix |
| Sub Product Line | `getByLabel('Sub Product Line')` | (281, 397) | Untouched |
| Product Tag | `getByLabel('Product Tag')` | (281, 454) | Untouched |
| Price Range slider | (no stable selector found) | — | **TODO** |
| QA radios | `All` / `Available Only` / `Backorder Only` | (192, 628/650/673) | "Available Only" is the cleanest filter for a build pass; we used "All" throughout |
| Non-Cannabis checkbox | `getByLabel('Non-Cannabis')` | (186, 724) | Off by default |
| Filter (submit) button | `getByRole('button', { name: 'Filter' })` | (262, 761) | Applies sidebar filters |

Row layout for the product list (after Filter):

| Column | Selector candidate (G) | x-range | Notes |
|---|---|---|---|
| Product Name | `td.product-name` (G) | 400–990 | Format: `{BRAND-PREFIX} - {Type} - {Strain} - {Size} - DoH` |
| Price | — | 990–1100 | Struck-through list price + net price + per-unit discount delta |
| Units For Sale | — | 1100–1280 | Number, right-aligned; "Out of Stock" badge replaces it when OOS |
| Quantity input | `input[type="number"]` scoped to row | 1280–1440 | Triple-click + type; see §1.7 quirks |

First row y≈176, subsequent rows step by ~30px (206, 235, 265, 295…). **Do not
hard-code y by row index** — search rows by accessible name and click within.

### 1.5 Products-page initialization rule

**C** — On first land on `/sales#/products/…`, **set the page-size dropdown at the
bottom to "all"** before scraping/iterating. Pagination defaults to 20 and silently
hides the rest. See `feedback_cultivera_products_page.md`.

For cart-build this matters less (you're searching one strain at a time), but for
the Phase 2 inventory scrape it's mandatory.

### 1.6 Product naming conventions

**C** — Cultivera product names follow strict patterns. Knowing these lets you build
robust matchers from sheet rows:

| Brand prefix | Format | Example |
|---|---|---|
| `CC - {Disp\|Cart\|Syringe\|Live Resin Disp\|Live Resin Cart}` | Crystal Clear vapes | `CC - Disp - FLV - Strawberry Jam - 1.0 gram - DoH` |
| `FL - LEG` | Legends flower | `FL - LEG - Hybrid - Grape Wave - 03.5 gram Jar - DoH` |
| `FL - MINI` | Mini Budz flower | `FL - MINI - Hybrid - Grape Wave - 07.0 gram BAG - DoH` |
| `FL - EZ` | Ez Flower | `FL - EZ - Indica - Planet Sherb - 03.5 gram Jar - DoH` |
| `EZ - Vape - {Disp\|FLV}` | Ez-Vape | `EZ - Vape - Disp - FLV - Huckleberry - 1.0 gram - DoH` |
| `EZ - Joint` | Ez-Joint | `EZ - Joint - Indica - Northern Lights - 1.0g - DoH` |
| `1988 Blunts - FLV` | 1988 line | `1988 Blunts - FLV - Blackberry Lemonade - 1.0g - DoH` |
| `MarmasBar - {CC - Cart\|Disp}` | Marmas vapes | `MarmasBar - Disp - Mango Sunrise - 1.0 gram - DoH` |
| `Marmas - {Indica\|Hybrid\|Sativa\|CBD:THC X:Y}` | Marmas gummies | `Marmas - Hybrid - Raspberry Lemonade - 10 PK - DoH` |
| `Mari's Mints - {strain} - {Sativa Move\|Indica Retire\|CBD:THC 1:1 Fulfill} - 20 PK` | Mints | `Mari's Mints - Wintermint - Sativa - Move - 20 PK` |
| `Hi-Burst - {Sativa\|Indica\|CBN:THC 2:1}` | Hi-Burst gummies | `Hi-Burst - CBN:THC 2:1 - Blackberry Dream - 10 PK - DoH` |
| `Cosmic Candy - {strain-prefix Big Bang/Space Time} - {strain} - {Sativa\|Indica} - 10 PK` | Cosmic Candy | `Cosmic Candy - Space Time Sour Raspberry Sativa - 10 PK - DoH` |
| `TS` | Terp Stix | `TS - African Mango - Indica - 1.0g - DoH` |

Every product name ends in **` - DoH`** (Department of Health compliance suffix).

**Crystal Clear price disambiguation rule** — when the sheet just says
"Crystal Clear" or "CC", use the sheet's unit price to pick the format
(verbatim from `feedback_cultivera_cart_building.md`):

- `$9.21` → CC - Syringe (sheet "DISTILLATE APPLICATOR")
- `$8.33` → CC - Cart (sheet "C-CELL CART 1g")
- `$10.00` → CC - Disp **OR** CC - Live Resin Cart (disambiguate by sheet text:
  `(Live resin)` 510-thread → Live Resin Cart; plain `1000mg Disposable` → Disp)
- `$11.67` → CC - Live Resin Disp (sheet "LIVE RESIN DISPO")

The Cultivera review page shows list price (e.g. $13.33) with a partner discount
that nets to the sheet price ($10). **Validation: the cart Grand Total should
equal the sheet's order total exactly** — that's the single check that catches
mis-mapped lines.

### 1.7 Gotchas (all **C** — discovered the hard way)

- **Triple-click + type batching is unreliable.** When two `triple_click → type`
  pairs are batched in one `browser_batch` call, the second one's `type` often
  drops. Pattern that works: `triple_click → wait(1s) → type → wait(1s)`, then
  a separate batch for Add To Cart. Verify with a `zoom` screenshot before
  committing.
- **Each Add To Cart clears all visible quantity inputs.** So if you set qtys on
  five rows and click Add To Cart, the next strain page starts blank — you
  cannot re-use values. (This is fine because you're iterating one strain at a
  time.)
- **Clicking the column header re-sorts and resets all entered quantities.**
  Never click anywhere in the table `<thead>`. There is no undo.
- **"Quantity not set" modal appears** if you click Add To Cart with no qty
  filled in — this is your sign that a triple-click+type pair silently failed.
  Dismiss with `Ok`, re-enter the qty, retry.
- **Viewport-dependent y coordinates.** 1456×829 vs 1512×805 yields different
  row offsets. The Find-tool / role-based selectors in §1.4 are immune; coord
  fallbacks must be retuned per viewport.
- **`End` key on the review-order page paints blank.** The page is scrollable
  but doesn't respond to `End`/`Home`. Use mouse-wheel `scroll(down, 10 ticks)`
  instead.
- **No CAPTCHA, no iframes, no anti-bot.** Standard cookie session.

### 1.8 Wait strategies (what actually worked)

- After **Filter** click: `wait(2s)`. There's no spinner to wait on; the table
  just replaces its rows. A more robust pattern (G) would be
  `page.waitForResponse(url => url.includes('/products'))`.
- After **Add To Cart**: `wait(2s)`. Brief green "Items Added to Cart" toast
  appears (~2s). The cart-summary counter updates synchronously with it.
- After navigation to Review Order: `wait(3s)`. The page renders the full line
  list which can be long (80+ rows).

### 1.9 Network observations

**TODO** — no HAR was ever captured. Strong hypothesis: every Filter click hits
an XHR endpoint returning JSON product rows. Capturing that endpoint would let
us replace the entire `_scrapeAllPages` UI loop with a direct API call.

**One-time investigation step** for the next session:
```ts
const context = await browser.newContext();
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
// drive a Filter click
await context.tracing.stop({ path: 'traces/cultivera-investigate.zip' });
```
Then open the trace in `npx playwright show-trace` and look at the Network tab.

### 1.10 Selectors that need replacement in `lib/cultivera/selectors.ts`

Every entry is a **TODO** placeholder. None will work against live Cultivera.
The file's own comment admits this. Run a codegen pass before relying on the
scaffold for anything.

---

## 2. Headset

Headset (the partner sell-through analytics tool) is **not** browser-automated
in this codebase. Partners export CSV/XLSX from Headset themselves and upload
via `app/(app)/partners/[id]/upload/upload-client.tsx`. CSV parsing lives in
`lib/csv/parse.ts`.

No Playwright work here, no auth, no scrapes. Listed for completeness so future
agents don't go looking.

---

## 3. Google Sheets

No evidence in this repo of any Playwright/MCP interaction with Google Sheets.
Listed for completeness.

---

## Future-runs hygiene

When you do start running real Playwright against Cultivera:

1. **Turn on tracing by default** — see one-line fix in §1.9. Save under
   `traces/{site}-{timestamp}.zip` so we accumulate evidence over time.
2. **Save storage state after manual login** — see §1.1.
3. **Add `traces/`, `test-results/`, `playwright-report/`, `.auth/` to
   `.gitignore`** before the first run produces them.
4. **Run codegen against the live site** to replace
   `lib/cultivera/selectors.ts` placeholders, then update §1.4 with the
   confirmed selectors and demote the C/G markers accordingly.
5. **Capture one HAR of a Filter + Add-to-Cart cycle** — see §1.9. This is the
   single highest-value piece of intel we don't yet have.
