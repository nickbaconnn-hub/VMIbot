/**
 * track-cart — lightweight observability for VMI cart builds.
 *
 * Records what ACTUALLY happened during a cart build (real selectors, real
 * results, real reasons) into Supabase, so future builds can learn from the
 * gap between plan and reality. Writes to cart_builds / cart_build_lines /
 * cart_build_actions (migration 0003).
 *
 * Usage (call from a shell so the calls are visible in the transcript):
 *
 *   # 1. Start a build — prints the build_id (bare uuid on stdout)
 *   BUILD=$(npx tsx scripts/track-cart.ts start \
 *     --partner-name="DANKS Renton" \
 *     --source-type=headset_xlsx \
 *     --source-filename="Inventory Details (40).xlsx" \
 *     --source-account="DANKS" --cultivera-account="DANKS" \
 *     --driver=chrome_mcp --viewport=1456x829)
 *
 *   # 2. Log a per-line decision — prints the line_id
 *   LINE=$(npx tsx scripts/track-cart.ts line "$BUILD" \
 *     --line-index=12 --strain="Grape Wave" --brand=Legends --format=28g \
 *     --target-qty=10 --outcome=skipped --reason=out_of_stock \
 *     --detail="FL-LEG 28g shows Out of Stock badge")
 *
 *   # 3. Log a browser action (usually via the wrapper in track-action.sh)
 *   npx tsx scripts/track-cart.ts action "$BUILD" --line-id="$LINE" \
 *     --action=triple_click --selector-kind=coordinate --selector="(1358,206)" \
 *     --result=ok --duration-ms=85
 *
 *   # 4. End the build
 *   npx tsx scripts/track-cart.ts end "$BUILD" --status=completed \
 *     --line-count=83 --list-total=10731.65 --grand-total=8356.15 \
 *     --sheet-total=8356.15
 *
 * Dollar flags (--unit-price, --list-total, …) accept dollars and are stored
 * as integer cents. Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// env + client (mirrors scripts/seed-catalog.ts)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  }
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
type Args = { _: string[]; flags: Record<string, string> };

function parseArgs(argv: string[]): Args {
  const _: string[] = [];
  const flags: Record<string, string> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq === -1) flags[a.slice(2)] = "true";
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

function fail(msg: string): never {
  console.error(`track-cart: ${msg}`);
  process.exit(1);
}

function req(flags: Record<string, string>, name: string): string {
  const v = flags[name];
  if (v === undefined || v === "") fail(`missing required --${name}`);
  return v;
}

function opt(flags: Record<string, string>, name: string): string | null {
  const v = flags[name];
  return v === undefined || v === "" ? null : v;
}

function intOpt(flags: Record<string, string>, name: string): number | null {
  const v = opt(flags, name);
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`--${name} must be a number, got "${v}"`);
  return Math.trunc(n);
}

/** Dollars → integer cents. "$10,256.70" → 1025670. */
function centsOpt(flags: Record<string, string>, name: string): number | null {
  const v = opt(flags, name);
  if (v === null) return null;
  const cleaned = v.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) fail(`--${name} must be a dollar amount, got "${v}"`);
  return Math.round(n * 100);
}

/** Comma-separated → string[]. */
function listOpt(flags: Record<string, string>, name: string): string[] {
  const v = opt(flags, name);
  if (v === null) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

/** JSON string → parsed value, or [] on absence. */
function jsonOpt(flags: Record<string, string>, name: string): unknown {
  const v = opt(flags, name);
  if (v === null) return [];
  try {
    return JSON.parse(v);
  } catch {
    fail(`--${name} must be valid JSON, got "${v}"`);
  }
}

// ---------------------------------------------------------------------------
// enum guards (match the CHECK constraints in migration 0003)
// ---------------------------------------------------------------------------
const SOURCE_TYPES = ["headset_xlsx", "nwcs_order_form_xlsx", "manual_chat"];
const DRIVERS = ["chrome_mcp", "playwright", "manual_human"];
const BUILD_STATUSES = ["in_progress", "completed", "aborted", "failed"];
const OUTCOMES = ["filled", "partial", "substituted", "skipped", "not_found"];
const OUTCOME_REASONS = [
  "matched_clean", "partial_inventory", "out_of_stock", "no_substitute",
  "product_not_found", "mso_under_threshold", "substituted_4field_match",
  "brand_substitute_fallback", "other",
];
const RESULTS = ["ok", "retry", "fail", "unexpected_modal", "silent_drop"];
const SELECTOR_KINDS = ["role", "text", "css", "coordinate", "ref", "none"];

function oneOf(value: string, allowed: string[], flag: string): string {
  if (!allowed.includes(value)) {
    fail(`--${flag} must be one of: ${allowed.join(", ")} (got "${value}")`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// partner resolution
// ---------------------------------------------------------------------------
async function resolvePartnerId(
  sb: SupabaseClient,
  flags: Record<string, string>,
): Promise<string> {
  const byId = opt(flags, "partner-id");
  if (byId) return byId;

  const name = opt(flags, "partner-name");
  if (!name) fail("provide --partner-id or --partner-name");

  const { data: found, error: findErr } = await sb
    .from("partners")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (findErr) fail(`partner lookup failed: ${findErr.message}`);
  if (found) return found.id as string;

  // Create it — keeps the CLI frictionless for accounts that aren't yet
  // formal partners (most of them today).
  const { data: created, error: createErr } = await sb
    .from("partners")
    .insert({ name, location: opt(flags, "partner-location") })
    .select("id")
    .single();
  if (createErr || !created) {
    fail(`could not create partner "${name}": ${createErr?.message ?? "unknown"}`);
  }
  console.error(`track-cart: created partner "${name}" (${created!.id})`);
  return created!.id as string;
}

// ---------------------------------------------------------------------------
// verbs
// ---------------------------------------------------------------------------
async function cmdStart(sb: SupabaseClient, args: Args) {
  const f = args.flags;
  const partner_id = await resolvePartnerId(sb, f);

  let viewport_width: number | null = null;
  let viewport_height: number | null = null;
  const vp = opt(f, "viewport");
  if (vp) {
    const m = vp.match(/^(\d+)x(\d+)$/i);
    if (!m) fail(`--viewport must look like 1456x829, got "${vp}"`);
    viewport_width = Number(m[1]);
    viewport_height = Number(m[2]);
  }

  const row = {
    partner_id,
    snapshot_id: opt(f, "snapshot-id"),
    source_type: oneOf(req(f, "source-type"), SOURCE_TYPES, "source-type"),
    source_filename: opt(f, "source-filename"),
    source_account_label: opt(f, "source-account"),
    cultivera_account_label: opt(f, "cultivera-account"),
    cultivera_account_url: opt(f, "cultivera-url"),
    driver: oneOf(opt(f, "driver") ?? "chrome_mcp", DRIVERS, "driver"),
    viewport_width,
    viewport_height,
    agent_session_id: opt(f, "session-id"),
    notes: opt(f, "notes"),
  };

  const { data, error } = await sb
    .from("cart_builds")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) fail(`start failed: ${error?.message ?? "no row"}`);
  // bare uuid to stdout so callers can `BUILD=$(… start …)`
  console.log(data!.id);
}

async function cmdLine(sb: SupabaseClient, args: Args) {
  const f = args.flags;
  const build_id = args._[0] ?? opt(f, "build-id");
  if (!build_id) fail("line requires a build_id (positional or --build-id)");

  const row = {
    cart_build_id: build_id,
    source_line_index: intOpt(f, "line-index"),
    source_strain: req(f, "strain"),
    source_brand: opt(f, "brand"),
    source_format: opt(f, "format"),
    source_unit_price_cents: centsOpt(f, "unit-price"),
    target_qty: intOpt(f, "target-qty"),
    mso: intOpt(f, "mso"),
    outcome: oneOf(req(f, "outcome"), OUTCOMES, "outcome"),
    outcome_reason: oneOf(req(f, "reason"), OUTCOME_REASONS, "reason"),
    outcome_reason_detail: opt(f, "detail"),
    picked_product_name: opt(f, "picked-name"),
    picked_unit_price_cents: centsOpt(f, "picked-price"),
    picked_qty: intOpt(f, "picked-qty"),
    substituted_from_strain: opt(f, "sub-from-strain"),
    substituted_from_brand: opt(f, "sub-from-brand"),
    searches_attempted: listOpt(f, "searches"),
    candidates_considered: jsonOpt(f, "candidates"),
  };

  const { data, error } = await sb
    .from("cart_build_lines")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) fail(`line failed: ${error?.message ?? "no row"}`);
  console.log(data!.id);
}

async function nextStepIndex(sb: SupabaseClient, build_id: string): Promise<number> {
  const { data, error } = await sb
    .from("cart_build_actions")
    .select("step_index")
    .eq("cart_build_id", build_id)
    .order("step_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(`could not compute step index: ${error.message}`);
  return data ? (data.step_index as number) + 1 : 0;
}

async function cmdAction(sb: SupabaseClient, args: Args) {
  const f = args.flags;
  const build_id = args._[0] ?? opt(f, "build-id");
  if (!build_id) fail("action requires a build_id (positional or --build-id)");

  const step_index =
    intOpt(f, "step") ?? (await nextStepIndex(sb, build_id));
  const selectorKind = opt(f, "selector-kind");

  const row = {
    cart_build_id: build_id,
    cart_build_line_id: opt(f, "line-id"),
    step_index,
    action: req(f, "action"),
    selector_kind: selectorKind
      ? oneOf(selectorKind, SELECTOR_KINDS, "selector-kind")
      : null,
    selector: opt(f, "selector"),
    target_description: opt(f, "target"),
    input_value: opt(f, "input"),
    result: oneOf(req(f, "result"), RESULTS, "result"),
    result_detail: opt(f, "result-detail"),
    attempt: intOpt(f, "attempt") ?? 1,
    duration_ms: intOpt(f, "duration-ms"),
    mcp_tool: opt(f, "mcp-tool"),
  };

  const { data, error } = await sb
    .from("cart_build_actions")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) fail(`action failed: ${error?.message ?? "no row"}`);
  console.log(data!.id);
}

type BatchAction = {
  action: string;
  result: string;
  line_id?: string;
  step?: number;
  selector_kind?: string;
  selector?: string;
  target?: string;
  input?: string;
  result_detail?: string;
  attempt?: number;
  duration_ms?: number;
  mcp_tool?: string;
};

/**
 * Bulk-insert many actions in one round trip. Reads a JSON array from stdin
 * (or --file=path). Each element: { action, result, line_id?, selector_kind?,
 * selector?, target?, input?, result_detail?, attempt?, duration_ms?,
 * mcp_tool?, step? }. step_index auto-assigned from the current max when omitted.
 */
async function cmdActions(sb: SupabaseClient, args: Args) {
  const f = args.flags;
  const build_id = args._[0] ?? opt(f, "build-id");
  if (!build_id) fail("actions requires a build_id (positional or --build-id)");

  const file = opt(f, "file");
  const raw = file
    ? fs.readFileSync(path.resolve(process.cwd(), file), "utf8")
    : fs.readFileSync(0, "utf8"); // stdin
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("actions: stdin/--file must be a JSON array");
  }
  if (!Array.isArray(parsed)) fail("actions: expected a JSON array");
  const items = parsed as BatchAction[];
  if (items.length === 0) {
    console.log("0 actions");
    return;
  }

  let step = await nextStepIndex(sb, build_id);
  const rows = items.map((a) => {
    if (!a.action) fail("actions: every element needs an 'action'");
    if (!a.result) fail("actions: every element needs a 'result'");
    return {
      cart_build_id: build_id,
      cart_build_line_id: a.line_id ?? null,
      step_index: a.step ?? step++,
      action: a.action,
      selector_kind: a.selector_kind
        ? oneOf(a.selector_kind, SELECTOR_KINDS, "selector_kind")
        : null,
      selector: a.selector ?? null,
      target_description: a.target ?? null,
      input_value: a.input ?? null,
      result: oneOf(a.result, RESULTS, "result"),
      result_detail: a.result_detail ?? null,
      attempt: a.attempt ?? 1,
      duration_ms: a.duration_ms ?? null,
      mcp_tool: a.mcp_tool ?? null,
    };
  });

  const { error } = await sb.from("cart_build_actions").insert(rows);
  if (error) fail(`actions failed: ${error.message}`);
  console.log(`${rows.length} actions`);
}

async function cmdEnd(sb: SupabaseClient, args: Args) {
  const f = args.flags;
  const build_id = args._[0] ?? opt(f, "build-id");
  if (!build_id) fail("end requires a build_id (positional or --build-id)");

  const patch: Record<string, unknown> = {
    status: oneOf(opt(f, "status") ?? "completed", BUILD_STATUSES, "status"),
    ended_at: new Date().toISOString(),
    cart_line_count: intOpt(f, "line-count"),
    cart_list_total_cents: centsOpt(f, "list-total"),
    cart_grand_total_cents: centsOpt(f, "grand-total"),
    sheet_expected_total_cents: centsOpt(f, "sheet-total"),
  };
  const notes = opt(f, "notes");
  if (notes) patch.notes = notes;
  // Drop nulls so we don't overwrite values set elsewhere.
  for (const k of Object.keys(patch)) {
    if (patch[k] === null) delete patch[k];
  }

  const { data, error } = await sb
    .from("cart_builds")
    .update(patch)
    .eq("id", build_id)
    .select(
      "id, status, cart_line_count, cart_grand_total_cents, sheet_expected_total_cents",
    )
    .single();
  if (error || !data) fail(`end failed: ${error?.message ?? "no row"}`);

  const grand = data!.cart_grand_total_cents as number | null;
  const sheet = data!.sheet_expected_total_cents as number | null;
  const match =
    grand != null && sheet != null
      ? grand === sheet
        ? "  ✓ matches sheet"
        : `  ✗ MISMATCH vs sheet ${fmt(sheet)}`
      : "";
  console.log(
    `build ${data!.id} → ${data!.status}, ${data!.cart_line_count ?? "?"} lines, ` +
      `grand total ${grand != null ? fmt(grand) : "?"}${match}`,
  );
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  loadEnv();
  const [, , verb, ...rest] = process.argv;
  const args = parseArgs(rest);
  const sb = client();

  switch (verb) {
    case "start":
      return cmdStart(sb, args);
    case "line":
      return cmdLine(sb, args);
    case "action":
      return cmdAction(sb, args);
    case "actions":
      return cmdActions(sb, args);
    case "end":
      return cmdEnd(sb, args);
    default:
      fail(
        `unknown verb "${verb ?? ""}". Use: start | line | action | actions | end. ` +
          `See the header of scripts/track-cart.ts for examples.`,
      );
  }
}

main().catch((e) => {
  console.error("track-cart: unexpected error:", e);
  process.exit(1);
});
