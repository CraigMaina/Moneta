-- Purpose: create the `budgets` table with RLS.
-- PRD/feature: per-category spending caps. A budget is stored as a MONTHLY cap
-- (integer cents); the weekly view is derived at the display edge (cap × 12/52),
-- never stored, so there is a single source of truth. One budget per category
-- (unique per user+category). Only spending categories are ever budgeted, but
-- that's enforced in the app layer — the DB just references categories.

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  -- Monthly cap in integer cents (money rule 1). Must be positive; removing a
  -- budget is a DELETE, not a zero.
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index budgets_user_idx on public.budgets (user_id);

alter table public.budgets enable row level security;

create policy "budgets_select_own"
  on public.budgets for select
  using (user_id = auth.uid());

create policy "budgets_insert_own"
  on public.budgets for insert
  with check (user_id = auth.uid());

create policy "budgets_update_own"
  on public.budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budgets_delete_own"
  on public.budgets for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.budgets to authenticated;
