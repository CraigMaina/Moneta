-- Purpose: create the `recurring_items` table with RLS.
-- PRD §7 / F6: template fields for a recurring transaction, cadence (rrule text),
-- next_due_date, autopay. Feeds the fixed-bills term of safe-to-spend (PRD §4.5).

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  kind public.transaction_kind not null,
  amount_cents bigint not null check (amount_cents >= 0),
  merchant text,
  note text,
  cadence text not null,
  next_due_date date not null,
  autopay boolean not null default false,
  created_at timestamptz not null default now()
);

create index recurring_items_user_idx on public.recurring_items (user_id);
create index recurring_items_user_next_due_idx on public.recurring_items (user_id, next_due_date);

alter table public.recurring_items enable row level security;

create policy "recurring_items_select_own"
  on public.recurring_items for select
  using (user_id = auth.uid());

create policy "recurring_items_insert_own"
  on public.recurring_items for insert
  with check (user_id = auth.uid());

create policy "recurring_items_update_own"
  on public.recurring_items for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recurring_items_delete_own"
  on public.recurring_items for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.recurring_items to authenticated;
