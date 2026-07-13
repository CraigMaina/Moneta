-- Purpose: create the `profiles` table with RLS. 1:1 with the user — `user_id`
-- is unique and is effectively the table's key (a synthetic `id` is kept for
-- consistency with every other table's shape, per the task's uniform-columns rule).
-- PRD §7: display_name, cycle_anchor_day, expected_income_cents, notification_prefs
-- jsonb, pin_hash, consent_flags jsonb.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  cycle_anchor_day integer not null default 1 check (cycle_anchor_day between 1 and 28),
  expected_income_cents bigint not null default 0 check (expected_income_cents >= 0),
  notification_prefs jsonb not null default '{}'::jsonb,
  pin_hash text,
  consent_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (user_id)
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "profiles_delete_own"
  on public.profiles for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
