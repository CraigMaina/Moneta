-- Purpose: create the `accounts` table (M-PESA / Cash / Bank / Other) with RLS.
-- PRD §7: accounts — name, type (mpesa|cash|bank|other), icon, archived_at.

create type public.account_type as enum ('mpesa', 'cash', 'bank', 'other');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type public.account_type not null,
  icon text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),

  -- One account name per user (also gives seed.sql a stable ON CONFLICT target).
  unique (user_id, name)
);

create index accounts_user_id_idx on public.accounts (user_id);

alter table public.accounts enable row level security;

create policy "accounts_select_own"
  on public.accounts for select
  using (user_id = auth.uid());

create policy "accounts_insert_own"
  on public.accounts for insert
  with check (user_id = auth.uid());

create policy "accounts_update_own"
  on public.accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "accounts_delete_own"
  on public.accounts for delete
  using (user_id = auth.uid());

-- Supabase's newer default does NOT auto-expose new public objects to the
-- Data API roles; grant explicitly. RLS policies above still gate every row.
grant select, insert, update, delete on public.accounts to authenticated;
