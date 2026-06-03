-- VMI Order Builder - Phase 2 schema deltas
-- Adds Cultivera inventory snapshots and extends orders for draft builds.
-- Run in the Supabase SQL editor after 0001.

-- ============================================================================
-- cultivera_inventory_snapshots
-- Every Cultivera scrape stored as jsonb for audit + debugging. Retained forever.
-- ============================================================================
create table if not exists public.cultivera_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  scraped_at timestamptz not null default now(),
  scraped_by uuid references auth.users(id),
  inventory jsonb not null,      -- [{ sku, name, on_hand }, ...]
  row_count int not null,
  scrape_duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists idx_cultivera_inventory_snapshots_scraped_at
  on public.cultivera_inventory_snapshots (scraped_at desc);

alter table public.cultivera_inventory_snapshots enable row level security;

drop policy if exists auth_all_cultivera_inventory_snapshots
  on public.cultivera_inventory_snapshots;
create policy auth_all_cultivera_inventory_snapshots
  on public.cultivera_inventory_snapshots
  for all to authenticated using (true) with check (true);

-- ============================================================================
-- orders — extend Phase 1 stub
-- ============================================================================
alter table public.orders
  add column if not exists ai_notes text,
  add column if not exists cultivera_inventory_snapshot_id uuid
    references public.cultivera_inventory_snapshots(id),
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists build_duration_ms int;

create index if not exists idx_orders_cultivera_snapshot
  on public.orders (cultivera_inventory_snapshot_id);
