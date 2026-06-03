/**
 * Seed the nwcs_catalog table from a JSON file.
 *
 * Usage:
 *   npx tsx scripts/seed-catalog.ts path/to/catalog.json
 *
 * Expected JSON shape (array of items):
 *   [
 *     {
 *       "sku": "NWCS-0001",
 *       "name": "Marmas Gummies — 100mg Sativa",
 *       "product_family": "Marmas Gummies",
 *       "strain_type": "Sativa",
 *       "dosage": "100mg",
 *       "format": "Gummy",
 *       "active": true
 *     },
 *     ...
 *   ]
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY set.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = {
  sku: string;
  name: string;
  product_family?: string | null;
  strain_type?: string | null;
  dosage?: string | null;
  format?: string | null;
  active?: boolean;
};

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

async function main() {
  loadEnv();
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/seed-catalog.ts <path-to-json>");
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(abs, "utf8");
  const items = JSON.parse(raw) as Row[];
  if (!Array.isArray(items)) {
    console.error("Expected a JSON array of catalog items.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Report missing fields — substitution engine in Phase 2 depends on these.
  const missing = items
    .map((it, i) => {
      const gaps: string[] = [];
      if (!it.product_family) gaps.push("product_family");
      if (!it.strain_type) gaps.push("strain_type");
      return gaps.length
        ? `  row ${i} (${it.sku || "?"}): missing ${gaps.join(", ")}`
        : null;
    })
    .filter(Boolean);
  if (missing.length) {
    console.warn(
      `⚠️  ${missing.length} row(s) missing Phase-2-critical fields:`,
    );
    for (const m of missing.slice(0, 20)) console.warn(m);
    if (missing.length > 20) console.warn(`  …and ${missing.length - 20} more`);
  }

  const batchSize = 500;
  let total = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map((it) => ({
      sku: it.sku,
      name: it.name,
      product_family: it.product_family ?? null,
      strain_type: it.strain_type ?? null,
      dosage: it.dosage ?? null,
      format: it.format ?? null,
      active: it.active ?? true,
    }));
    const { error } = await supabase
      .from("nwcs_catalog")
      .upsert(batch, { onConflict: "sku" });
    if (error) {
      console.error(`Failed to upsert batch at ${i}:`, error.message);
      process.exit(1);
    }
    total += batch.length;
    console.log(`upserted ${total}/${items.length}`);
  }

  console.log(`✓ Seeded ${total} catalog items.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
