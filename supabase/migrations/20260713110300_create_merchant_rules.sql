-- Purpose: create the `merchant_rules` table (merchant → category memory) with RLS.
-- PRD §4.3 / §7: when a user corrects a parsed merchant's category, remember it and
-- auto-apply to all future parses of that merchant.

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_normalized text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- One rule per normalized merchant per user — the "learning table" is a
  -- single mapping, not a history; new corrections overwrite (app does
  -- upsert on this key).
  unique (user_id, merchant_normalized)
);

create index merchant_rules_user_idx on public.merchant_rules (user_id);
create index merchant_rules_category_idx on public.merchant_rules (user_id, category_id);

alter table public.merchant_rules enable row level security;

create policy "merchant_rules_select_own"
  on public.merchant_rules for select
  using (user_id = auth.uid());

create policy "merchant_rules_insert_own"
  on public.merchant_rules for insert
  with check (user_id = auth.uid());

create policy "merchant_rules_update_own"
  on public.merchant_rules for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "merchant_rules_delete_own"
  on public.merchant_rules for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.merchant_rules to authenticated;
