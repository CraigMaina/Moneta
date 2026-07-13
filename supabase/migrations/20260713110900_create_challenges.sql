-- Purpose: create the `challenges` table with RLS.
-- PRD §7 / F8: type, target, progress, week_start — user-initiated no-spend-style
-- challenges. Unlike streaks, a user can have many challenges over time, so this
-- table is not 1:1; it's unique per (user, type, week_start) to prevent
-- accidentally re-creating the same weekly challenge twice.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  target integer not null check (target >= 0),
  progress integer not null default 0 check (progress >= 0),
  week_start date not null,
  created_at timestamptz not null default now(),

  unique (user_id, type, week_start)
);

create index challenges_user_idx on public.challenges (user_id);
create index challenges_user_week_idx on public.challenges (user_id, week_start);

alter table public.challenges enable row level security;

create policy "challenges_select_own"
  on public.challenges for select
  using (user_id = auth.uid());

create policy "challenges_insert_own"
  on public.challenges for insert
  with check (user_id = auth.uid());

create policy "challenges_update_own"
  on public.challenges for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "challenges_delete_own"
  on public.challenges for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.challenges to authenticated;
