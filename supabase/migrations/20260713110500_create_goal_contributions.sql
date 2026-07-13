-- Purpose: create the `goal_contributions` table with RLS.
-- PRD §7 / §4.4: goal_contributions — goal_id, transaction_id (nullable — a
-- contribution is either a transfer transaction into the goal, or a tracked
-- earmark with no linked transaction), amount_cents, occurred_at.

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index goal_contributions_user_idx on public.goal_contributions (user_id);
create index goal_contributions_goal_idx on public.goal_contributions (user_id, goal_id);
create index goal_contributions_transaction_idx on public.goal_contributions (transaction_id);

alter table public.goal_contributions enable row level security;

create policy "goal_contributions_select_own"
  on public.goal_contributions for select
  using (user_id = auth.uid());

create policy "goal_contributions_insert_own"
  on public.goal_contributions for insert
  with check (user_id = auth.uid());

create policy "goal_contributions_update_own"
  on public.goal_contributions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "goal_contributions_delete_own"
  on public.goal_contributions for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.goal_contributions to authenticated;
