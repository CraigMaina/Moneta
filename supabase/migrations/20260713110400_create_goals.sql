-- Purpose: create the `goals` table with RLS.
-- PRD §7: goals — name, emoji, photo_url, target_cents, target_date, achieved_at.
-- Note: PRD §4.4 prose also mentions an optional "linked account" for a goal, but
-- PRD §7's formal field list (mirrored here) omits it — see DECISIONS.md.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text,
  photo_url text,
  target_cents bigint not null check (target_cents >= 0),
  target_date date,
  achieved_at timestamptz,
  created_at timestamptz not null default now()
);

create index goals_user_idx on public.goals (user_id);

alter table public.goals enable row level security;

create policy "goals_select_own"
  on public.goals for select
  using (user_id = auth.uid());

create policy "goals_insert_own"
  on public.goals for insert
  with check (user_id = auth.uid());

create policy "goals_update_own"
  on public.goals for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "goals_delete_own"
  on public.goals for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.goals to authenticated;
