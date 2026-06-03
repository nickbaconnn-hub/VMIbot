-- VMI Order Builder - Phase 1 schema
-- Run in the Supabase SQL editor (Dashboard > SQL > New query)

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- partners
-- ============================================================================
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  lookback_days int not null default 60,
  days_of_cover_target int not null default 21,
  notes text,
  archived bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at
before update on public.partners
for each row execute function public.set_updated_at();

-- ============================================================================
-- nwcs_catalog
-- ============================================================================
create table if not exists public.nwcs_catalog (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  product_family text,
  strain_type text,
  dosage text,
  format text,
  active bool not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_nwcs_catalog_updated_at on public.nwcs_catalog;
create trigger trg_nwcs_catalog_updated_at
before update on public.nwcs_catalog
for each row execute function public.set_updated_at();

create index if not exists idx_nwcs_catalog_name_trgm on public.nwcs_catalog using gin (name gin_trgm_ops);
create index if not exists idx_nwcs_catalog_active on public.nwcs_catalog (active);

-- ============================================================================
-- partner_sku_map
-- ============================================================================
create table if not exists public.partner_sku_map (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  partner_sku_name text not null,
  nwcs_catalog_id uuid not null references public.nwcs_catalog(id),
  confidence text not null default 'confirmed' check (confidence in ('confirmed','auto-suggested')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, partner_sku_name)
);

drop trigger if exists trg_partner_sku_map_updated_at on public.partner_sku_map;
create trigger trg_partner_sku_map_updated_at
before update on public.partner_sku_map
for each row execute function public.set_updated_at();

create index if not exists idx_partner_sku_map_partner on public.partner_sku_map (partner_id);
create index if not exists idx_partner_sku_map_catalog on public.partner_sku_map (nwcs_catalog_id);

-- ============================================================================
-- snapshots
-- ============================================================================
create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  source_file_name text,
  lookback_days_used int not null,
  raw_rows jsonb not null,
  row_count int not null,
  column_mapping jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_snapshots_updated_at on public.snapshots;
create trigger trg_snapshots_updated_at
before update on public.snapshots
for each row execute function public.set_updated_at();

create index if not exists idx_snapshots_partner_uploaded on public.snapshots (partner_id, uploaded_at desc);

-- ============================================================================
-- snapshot_rows
-- ============================================================================
create table if not exists public.snapshot_rows (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  partner_sku_name text not null,
  units_sold numeric not null,
  on_hand numeric,
  nwcs_catalog_id uuid references public.nwcs_catalog(id),
  mapping_status text not null default 'pending' check (mapping_status in ('pending','mapped','unmapped_ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_snapshot_rows_updated_at on public.snapshot_rows;
create trigger trg_snapshot_rows_updated_at
before update on public.snapshot_rows
for each row execute function public.set_updated_at();

create index if not exists idx_snapshot_rows_snapshot on public.snapshot_rows (snapshot_id);
create index if not exists idx_snapshot_rows_status on public.snapshot_rows (snapshot_id, mapping_status);
create index if not exists idx_snapshot_rows_sku on public.snapshot_rows (partner_sku_name);

-- ============================================================================
-- partner_column_mappings
-- Saved per-partner CSV column-to-field mapping so repeat uploads auto-detect
-- ============================================================================
create table if not exists public.partner_column_mappings (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  mapping jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_partner_column_mappings_updated_at on public.partner_column_mappings;
create trigger trg_partner_column_mappings_updated_at
before update on public.partner_column_mappings
for each row execute function public.set_updated_at();

-- ============================================================================
-- orders (stub for Phase 1)
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  snapshot_id uuid not null references public.snapshots(id),
  status text not null default 'draft' check (status in ('draft','approved','submitted','cancelled')),
  line_items jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create index if not exists idx_orders_partner on public.orders (partner_id);
create index if not exists idx_orders_snapshot on public.orders (snapshot_id);

-- ============================================================================
-- Row Level Security
-- All tables: authenticated users can read/write. App layer enforces ALLOWED_EMAILS.
-- ============================================================================
alter table public.partners enable row level security;
alter table public.nwcs_catalog enable row level security;
alter table public.partner_sku_map enable row level security;
alter table public.snapshots enable row level security;
alter table public.snapshot_rows enable row level security;
alter table public.partner_column_mappings enable row level security;
alter table public.orders enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'partners','nwcs_catalog','partner_sku_map','snapshots',
    'snapshot_rows','partner_column_mappings','orders'
  ]) loop
    execute format('drop policy if exists %I on public.%I', 'auth_all_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'auth_all_' || t, t
    );
  end loop;
end$$;
