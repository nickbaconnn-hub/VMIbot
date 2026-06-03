/**
 * regen-cart-kb — regenerate VMI_CART_KB.md from the tracker tables.
 *
 *   npx tsx scripts/regen-cart-kb.ts        # writes VMI_CART_KB.md
 *   npm run kb:regen
 *
 * Reads cart_builds / cart_build_lines / cart_build_actions and DISTILLS them
 * into a reference the building agent reads at the START of a build:
 *   - confirmed build flow per driver
 *   - stable vs flaky selectors (by observed success rate)
 *   - decision rules that have held up (outcome-reason distribution)
 *   - known failure modes + the fallback that fixed them
 *   - per-account quirks (top OOS strains, partial-fill rate, substitutions)
 *
 * The file is fully regenerated each run — do not hand-edit it. Curated prose
 * that should survive regeneration lives in PLAYWRIGHT_KB.md instead.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

// --- row shapes (subset we read) ---------------------------------------------
type Build = {
  id: string;
  cultivera_account_label: string | null;
  source_account_label: string | null;
  driver: string;
  status: string;
  cart_line_count: number | null;
  cart_grand_total_cents: number | null;
  sheet_expected_total_cents: number | null;
  started_at: string;
};
type Line = {
  cart_build_id: string;
  source_strain: string;
  source_brand: string | null;
  outcome: string;
  outcome_reason: string;
  picked_product_name: string | null;
  substituted_from_strain: string | null;
};
type Action = {
  cart_build_id: string;
  action: string;
  selector_kind: string | null;
  selector: string | null;
  result: string;
  result_detail: string | null;
};

// Curated fallback hints, merged with observed failure modes.
const FALLBACK_HINTS: Record<string, string> = {
  silent_drop:
    "A triple_click→type pair in a batched call dropped the type. Fallback: split into triple_click → wait(1s) → type → wait(1s), verify with a zoom before Add To Cart.",
  unexpected_modal:
    '"Quantity not set" modal — a qty input silently failed before Add To Cart. Fallback: dismiss with Ok, re-enter the qty, retry.',
  retry: "Action needed a retry. Usually a timing race; widen the wait or wait on a concrete element.",
  fail: "Action failed outright. Check the selector against a fresh codegen pass.",
};

function fmtCents(c: number | null): string {
  if (c == null) return "—";
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

async function fetchAll<T>(sb: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch ${table} failed: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

// --- section renderers -------------------------------------------------------
function renderFlow(builds: Build[], actions: Action[]): string {
  const drivers = [...new Set(builds.map((b) => b.driver))].sort();
  if (drivers.length === 0) {
    return "_No builds recorded yet. The canonical flow is in PLAYWRIGHT_KB.md §1.3 until data accumulates._";
  }
  const lines: string[] = [];
  for (const d of drivers) {
    const dBuilds = builds.filter((b) => b.driver === d);
    const dActions = actions.filter((a) =>
      dBuilds.some((b) => b.id === a.cart_build_id),
    );
    const actionCounts = countBy(dActions, (a) => a.action);
    const ordered = Object.entries(actionCounts).sort((x, y) => y[1] - x[1]);
    lines.push(`### Driver: \`${d}\` — ${dBuilds.length} build(s)`);
    lines.push("");
    lines.push("Action frequency (most common first):");
    lines.push("");
    lines.push("| Action | Times | OK rate |");
    lines.push("|---|---|---|");
    for (const [action, n] of ordered) {
      const ok = dActions.filter((a) => a.action === action && a.result === "ok").length;
      lines.push(`| \`${action}\` | ${n} | ${pct(ok, n)} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderSelectors(actions: Action[]): string {
  const withSel = actions.filter((a) => a.selector);
  if (withSel.length === 0) {
    return "_No selector data yet._";
  }
  type Agg = { uses: number; ok: number; kind: string };
  const map = new Map<string, Agg>();
  for (const a of withSel) {
    const key = a.selector!;
    const cur = map.get(key) ?? { uses: 0, ok: 0, kind: a.selector_kind ?? "?" };
    cur.uses++;
    if (a.result === "ok") cur.ok++;
    map.set(key, cur);
  }
  const rows = [...map.entries()].sort((x, y) => y[1].uses - x[1].uses);
  const out: string[] = [];
  out.push("Selectors observed ≥3 times are classified **stable** (≥90% ok) or **flaky**. Coordinate selectors are inherently viewport-bound — prefer role/text.");
  out.push("");
  out.push("| Selector | Kind | Uses | OK rate | Verdict |");
  out.push("|---|---|---|---|---|");
  for (const [sel, agg] of rows) {
    const rate = agg.ok / agg.uses;
    let verdict = "—";
    if (agg.uses >= 3) verdict = rate >= 0.9 ? "✅ stable" : "⚠️ flaky";
    if (agg.kind === "coordinate") verdict += " (viewport-bound)";
    out.push(`| \`${sel}\` | ${agg.kind} | ${agg.uses} | ${pct(agg.ok, agg.uses)} | ${verdict} |`);
  }
  return out.join("\n");
}

function renderDecisionRules(lines: Line[]): string {
  if (lines.length === 0) return "_No line decisions recorded yet._";
  const byReason = countBy(lines, (l) => l.outcome_reason);
  const byOutcome = countBy(lines, (l) => l.outcome);
  const out: string[] = [];
  out.push("Outcome distribution across all recorded lines:");
  out.push("");
  out.push("| Outcome | Lines | Share |");
  out.push("|---|---|---|");
  for (const [o, n] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) {
    out.push(`| ${o} | ${n} | ${pct(n, lines.length)} |`);
  }
  out.push("");
  out.push("Reason distribution:");
  out.push("");
  out.push("| Reason | Lines | Share |");
  out.push("|---|---|---|");
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    out.push(`| ${r} | ${n} | ${pct(n, lines.length)} |`);
  }
  return out.join("\n");
}

function renderFailureModes(actions: Action[]): string {
  const bad = actions.filter((a) => a.result !== "ok");
  if (bad.length === 0) {
    return "_No failures recorded yet. Known modes (from prior sessions) are in PLAYWRIGHT_KB.md §1.7._";
  }
  const byResult = countBy(bad, (a) => a.result);
  const out: string[] = [];
  out.push("| Result | Count | Fallback |");
  out.push("|---|---|---|");
  for (const [r, n] of Object.entries(byResult).sort((a, b) => b[1] - a[1])) {
    out.push(`| ${r} | ${n} | ${FALLBACK_HINTS[r] ?? "—"} |`);
  }
  // surface the most common result_detail strings
  const details = countBy(
    bad.filter((a) => a.result_detail),
    (a) => a.result_detail!,
  );
  const topDetails = Object.entries(details).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topDetails.length) {
    out.push("");
    out.push("Most common failure details:");
    out.push("");
    for (const [d, n] of topDetails) out.push(`- (${n}×) ${d}`);
  }
  return out.join("\n");
}

function renderAccountQuirks(builds: Build[], lines: Line[]): string {
  const accounts = [...new Set(builds.map((b) => b.cultivera_account_label ?? "(unknown)"))].sort();
  if (accounts.length === 0) return "_No builds recorded yet._";
  const out: string[] = [];
  for (const acct of accounts) {
    const aBuilds = builds.filter((b) => (b.cultivera_account_label ?? "(unknown)") === acct);
    const aBuildIds = new Set(aBuilds.map((b) => b.id));
    const aLines = lines.filter((l) => aBuildIds.has(l.cart_build_id));

    const matchable = aBuilds.filter(
      (b) => b.cart_grand_total_cents != null && b.sheet_expected_total_cents != null,
    );
    const matched = matchable.filter(
      (b) => b.cart_grand_total_cents === b.sheet_expected_total_cents,
    ).length;

    const oos = aLines.filter(
      (l) => l.outcome === "skipped" && l.outcome_reason === "out_of_stock",
    );
    const oosByStrain = countBy(oos, (l) => `${l.source_brand ?? "?"} ${l.source_strain}`);
    const topOos = Object.entries(oosByStrain).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const partials = aLines.filter((l) => l.outcome === "partial").length;
    const subs = aLines.filter((l) => l.outcome === "substituted");

    const avgLines =
      aBuilds.length > 0
        ? Math.round(aBuilds.reduce((s, b) => s + (b.cart_line_count ?? 0), 0) / aBuilds.length)
        : 0;

    out.push(`### ${acct}`);
    out.push("");
    out.push(`- Builds recorded: **${aBuilds.length}**`);
    out.push(`- Avg cart line count: ${avgLines}`);
    out.push(`- Sheet-total match rate: ${pct(matched, matchable.length)} (${matched}/${matchable.length})`);
    out.push(`- Lines partial-filled: ${partials}`);
    out.push(`- Substitutions: ${subs.length}`);
    if (topOos.length) {
      out.push(`- Recurring out-of-stock items:`);
      for (const [strain, n] of topOos) out.push(`  - ${strain} (${n}×)`);
    }
    if (subs.length) {
      out.push(`- Substitution examples:`);
      for (const s of subs.slice(0, 5)) {
        out.push(`  - ${s.substituted_from_strain ?? "?"} → ${s.picked_product_name ?? "?"}`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env.local");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const builds = await fetchAll<Build>(
    sb,
    "cart_builds",
    "id, cultivera_account_label, source_account_label, driver, status, cart_line_count, cart_grand_total_cents, sheet_expected_total_cents, started_at",
  );
  const lines = await fetchAll<Line>(
    sb,
    "cart_build_lines",
    "cart_build_id, source_strain, source_brand, outcome, outcome_reason, picked_product_name, substituted_from_strain",
  );
  const actions = await fetchAll<Action>(
    sb,
    "cart_build_actions",
    "cart_build_id, action, selector_kind, selector, result, result_detail",
  );

  const completed = builds.filter((b) => b.status === "completed").length;
  const generatedAt = new Date().toISOString();

  const md = `# VMI Cart-Build Knowledge Base

> **Auto-generated — do not hand-edit.** Run \`npm run kb:regen\` to refresh.
> Generated ${generatedAt} from **${builds.length} build(s)** (${completed} completed),
> **${lines.length} line decision(s)**, **${actions.length} browser action(s)**.
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

${renderFlow(builds, actions)}

## Selectors: stable vs flaky

${renderSelectors(actions)}

## Decision rules that have held up

${renderDecisionRules(lines)}

## Known failure modes + fallbacks

${renderFailureModes(actions)}

## Per-account quirks

${renderAccountQuirks(builds, lines)}
`;

  const outPath = path.resolve(process.cwd(), "VMI_CART_KB.md");
  fs.writeFileSync(outPath, md, "utf8");
  console.log(
    `Wrote ${outPath} — ${builds.length} builds, ${lines.length} lines, ${actions.length} actions.`,
  );
}

main().catch((e) => {
  console.error("regen-cart-kb: unexpected error:", e);
  process.exit(1);
});
