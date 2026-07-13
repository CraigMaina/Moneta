-- Purpose: create the `categories` table with RLS.
-- PRD §7: categories — name, kind (income|expense), icon, color, sort_order, archived_at.

create type public.category_kind as enum ('income', 'expense');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  icon text,
  color text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),

  -- One category name per user, regardless of kind (PRD's default set has
  -- no collisions across kinds — "Other income" vs "Other" — so this stays
  -- simple rather than scoping uniqueness to (user_id, name, kind)).
  unique (user_id, name)
);

create index categories_user_id_idx on public.categories (user_id);
create index categories_user_kind_idx on public.categories (user_id, kind);

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories for select
  using (user_id = auth.uid());

create policy "categories_insert_own"
  on public.categories for insert
  with check (user_id = auth.uid());

create policy "categories_update_own"
  on public.categories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "categories_delete_own"
  on public.categories for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.categories to authenticated;
