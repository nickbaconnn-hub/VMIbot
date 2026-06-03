# VMI Order Builder

Internal NWCS tool for drafting Vendor-Managed Inventory orders for partner retailers.

**Phase 1 scope:** ingest Headset CSVs, translate partner SKU names to NWCS catalog SKUs, and resolve unmapped rows via a fuzzy-match queue. Order quantity calculation, substitution, and Cultivera integration come in later phases.

## Stack

- Next.js 16 (App Router, TypeScript) on port **5737**
- Supabase (Postgres + Auth)
- Tailwind v4 + shadcn/ui
- Fuse.js for fuzzy matching
- papaparse for CSV

## Getting started

```bash
cp .env.local.example .env.local
# fill in Supabase URL + keys and ALLOWED_EMAILS

npm install
npm run dev   # http://localhost:5737
```

## Database setup

1. Create a Supabase project (https://supabase.com/dashboard).
2. In the SQL editor, paste and run `supabase/migrations/0001_phase1_schema.sql`.
3. Enable magic-link email auth (default in new projects).

## Seeding the NWCS catalog

```bash
npm run seed:catalog path/to/catalog.json
```

Expected JSON: array of `{ sku, name, product_family, strain_type, dosage, format, active }`.

## Project layout

```
app/
  (auth)/login          magic-link login
  (app)/                sidebar shell (auth-gated)
    page.tsx            partners dashboard
    partners/new        create partner
    partners/[id]       overview + tabs
      upload            CSV upload + column mapper
      snapshots/[id]    snapshot review
        unmapped        fuzzy-match queue (core Phase 1)
      mappings          translation map editor
      settings          edit / archive partner
  auth/callback         Supabase OAuth callback
lib/
  supabase/             client, server, proxy helpers
  csv/                  parser + column mapper
  matching/             fuse.js wrapper
  cultivera/            STUB — Phase 3
supabase/migrations/    SQL schema
scripts/                seed-catalog, etc.
```

## Phase 1 success criteria

1. Create a partner.
2. Upload a Headset CSV.
3. Resolve every unmapped row via the unmapped queue.
4. View a fully-translated snapshot.
5. Repeat upload — previously-mapped SKUs auto-match; only new SKUs appear in the queue.
