-- VMI Cart Builder — tracking & observability
-- Captures every cart build (manual or automated) for audit, replay, and
-- pattern extraction. Non-destructive: only CREATE statements, no changes
-- to existing tables.

-- ============================================================================
-- cart_builds — one row per build session
-- ============================================================================
create table if not exists public.cart_builds (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  snapshot_id uuid references public.snapshots(id),
  source_type text not null check (source_type in (
    'headset_xlsx', 'nwcs_order_form_xlsx', 'manual_chat'
  )),
  source_filename text,
  source_account_label text,
  cultivera_account_label text,
  cultivera_account_url text,
  driver text not null check (driver in (
    'chrome_mcp', 'playwright', 'manual_human'
  )),
  viewport_width int,
  viewport_height int,
  agent_session_id text,
  status text not null default 'in_progress' check (status in (
    'in_progress', 'completed', 'aborted', 'failed'
  )),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  cart_line_count int,
  cart_list_total_cents int,
  cart_grand_total_cents int,
  sheet_expected_total_cents int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cart_builds_partner_started
  on public.cart_builds (partner_id, started_at desc);
create index if not exists idx_cart_builds_status
  on public.cart_builds (status);

alter table public.cart_builds enable row level security;
drop policy if exists auth_all_cart_builds on public.cart_builds;
create policy auth_all_cart_builds on public.cart_builds
  for all to authenticated using (true) with check (true);

-- ============================================================================
-- cart_build_lines — one row per source-sheet line considered
-- ============================================================================
create table if not exists public.cart_build_lines (
  id uuid primary key default gen_random_uuid(),
  cart_build_id uuid not null references public.cart_builds(id) on delete cascade,
  source_line_index int,
  source_strain text not null,
  source_brand text,
  source_format text,
  source_unit_price_cents int,
  target_qty int,
  mso int,
  outcome text not null check (outcome in (
    'filled', 'partial', 'substituted', 'skipped', 'not_found'
  )),
  outcome_reason text not null check (outcome_reason in (
    'matched_clean', 'partial_inventory', 'out_of_stock', 'no_substitute',
    'product_not_found', 'mso_under_threshold', 'substituted_4field_match',
    'brand_substitute_fallback', 'other'
  )),
  outcome_reason_detail text,
  picked_product_name text,
  picked_unit_price_cents int,
  picked_qty int,
  picked_line_total_cents int generated always as (
    coalesce(picked_unit_price_cents, 0) * coalesce(picked_qty, 0)
  ) stored,
  substituted_from_strain text,
  substituted_from_brand text,
  searches_attempted jsonb not null default '[]'::jsonb,
  candidates_considered jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cart_build_lines_build
  on public.cart_build_lines (cart_build_id);
create index if not exists idx_cart_build_lines_outcome
  on public.cart_build_lines (outcome);
create index if not exists idx_cart_build_lines_strain
  on public.cart_build_lines (lower(source_strain));

alter table public.cart_build_lines enable row level security;
drop policy if exists auth_all_cart_build_lines on public.cart_build_lines;
create policy auth_all_cart_build_lines on public.cart_build_lines
  for all to authenticated using (true) with check (true);

-- ============================================================================
-- cart_build_actions — every browser interaction
-- ============================================================================
create table if not exists public.cart_build_actions (
  id uuid primary key default gen_random_uuid(),
  cart_build_id uuid not null references public.cart_builds(id) on delete cascade,
  cart_build_line_id uuid references public.cart_build_lines(id) on delete cascade,
  step_index int not null,
  action text not null,
  selector_kind text check (selector_kind in (
    'role', 'text', 'css', 'coordinate', 'ref', 'none'
  )),
  selector text,
  target_description text,
  input_value text,
  result text not null check (result in (
    'ok', 'retry', 'fail', 'unexpected_modal', 'silent_drop'
  )),
  result_detail text,
  attempt int not null default 1,
  duration_ms int,
  mcp_tool text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cart_build_actions_build_step
  on public.cart_build_actions (cart_build_id, step_index);
create index if not exists idx_cart_build_actions_selector_result
  on public.cart_build_actions (selector, result);
create index if not exists idx_cart_build_actions_action_result
  on public.cart_build_actions (action, result);

alter table public.cart_build_actions enable row level security;
drop policy if exists auth_all_cart_build_actions on public.cart_build_actions;
create policy auth_all_cart_build_actions on public.cart_build_actions
  for all to authenticated using (true) with check (true);

-- ============================================================================
-- updated_at trigger for cart_builds (others are append-only)
-- ============================================================================
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cart_builds_updated_at on public.cart_builds;
create trigger trg_cart_builds_updated_at
  before update on public.cart_builds
  for each row execute function public.set_updated_at();
