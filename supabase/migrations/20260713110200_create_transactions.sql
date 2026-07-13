-- Purpose: create the `transactions` table — the core money-movement ledger — with RLS,
-- money-integrity CHECK constraints, and the mpesa_ref dedupe index.
-- PRD §7 / §4.2: amount_cents is always positive; direction lives in `kind`.
-- CLAUDE.md Money rules: never floats, never signed amounts, transfers excluded from
-- income/expense totals (enforced here at the schema level, not just in app code).

create type public.transaction_kind as enum ('income', 'expense', 'transfer');
create type public.transaction_source as enum ('manual', 'sms_parse', 'statement_import');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  counter_account_id uuid references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  kind public.transaction_kind not null,
  amount_cents bigint not null check (amount_cents >= 0),
  merchant text,
  note text,
  occurred_at timestamptz not null default now(),
  source public.transaction_source not null default 'manual',
  mpesa_ref text,
  fee_cents bigint check (fee_cents is null or fee_cents >= 0),
  raw_sms text,
  parser_version text,
  created_at timestamptz not null default now(),

  -- A transfer must have a counter-account (and cannot transfer to itself);
  -- a non-transfer must not have one. See DECISIONS.md for the fee-modeling
  -- decision (fee_cents is informational only; fees are booked as their own
  -- expense transaction, so account_balances never subtracts fee_cents).
  check (
    (kind = 'transfer' and counter_account_id is not null and counter_account_id <> account_id)
    or (kind <> 'transfer' and counter_account_id is null)
  ),

  -- Transfers are never categorized (PRD §7: category_id "nullable for transfers").
  check (kind <> 'transfer' or category_id is null)
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);
create index transactions_user_account_idx on public.transactions (user_id, account_id);
create index transactions_user_counter_account_idx on public.transactions (user_id, counter_account_id);
create index transactions_user_category_idx on public.transactions (user_id, category_id);

-- Dedupe backbone (CLAUDE.md Database rules): re-pasting the same M-PESA SMS
-- must never create a duplicate. Partial so multiple manual/no-ref rows are unaffected.
create unique index transactions_user_mpesa_ref_uniq
  on public.transactions (user_id, mpesa_ref)
  where mpesa_ref is not null;

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (user_id = auth.uid());

create policy "transactions_update_own"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transactions_delete_own"
  on public.transactions for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.transactions to authenticated;
