-- Purpose: create the `streaks` table with RLS. Treated as 1:1 with the user
-- (unique user_id) — F8's logging streak is a single running counter per user,
-- not a list of historical streak periods. See DECISIONS.md.
-- PRD §7: current_count, longest_count, last_counted_date, freezes_used_this_week.

create table public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  longest_count integer not null default 0 check (longest_count >= 0),
  last_counted_date date,
  freezes_used_this_week integer not null default 0 check (freezes_used_this_week >= 0),
  created_at timestamptz not null default now(),

  unique (user_id)
);

alter table public.streaks enable row level security;

create policy "streaks_select_own"
  on public.streaks for select
  using (user_id = auth.uid());

create policy "streaks_insert_own"
  on public.streaks for insert
  with check (user_id = auth.uid());

create policy "streaks_update_own"
  on public.streaks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "streaks_delete_own"
  on public.streaks for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.streaks to authenticated;
