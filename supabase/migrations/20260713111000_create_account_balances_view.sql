-- Purpose: `account_balances` — the only source of truth for an account's balance.
-- CLAUDE.md Money rules / Database rules: balances are derived, never stored.
--
-- Fee-modeling decision (see DECISIONS.md for the full write-up): PRD §4.2 models
-- an M-PESA withdrawal fee as its OWN expense transaction, not as a deduction
-- alongside the parent transfer/expense. `transactions.fee_cents` therefore holds
-- what the source SMS/statement reported (for parser provenance / reconciliation
-- display) and is NOT subtracted here — doing so would double-count money that a
-- separate fee expense transaction already removes from the account.
--
-- kind handling:
--   income   -> + amount_cents on account_id
--   expense  -> - amount_cents on account_id
--   transfer -> - amount_cents on account_id, + amount_cents on counter_account_id

create view public.account_balances
with (security_invoker = true) as
select
  a.user_id,
  a.id as account_id,
  a.name as account_name,
  coalesce(
    sum(
      case
        when t.kind = 'income' and t.account_id = a.id then t.amount_cents
        when t.kind = 'expense' and t.account_id = a.id then -t.amount_cents
        when t.kind = 'transfer' and t.account_id = a.id then -t.amount_cents
        when t.kind = 'transfer' and t.counter_account_id = a.id then t.amount_cents
        else 0
      end
    ),
    0
  )::bigint as balance_cents
from public.accounts a
left join public.transactions t
  on t.user_id = a.user_id
  and (t.account_id = a.id or t.counter_account_id = a.id)
group by a.user_id, a.id, a.name;

-- security_invoker makes the view run with the querying user's own privileges
-- and RLS policies (PG15+), so a plain RLS grant is enough — there is no
-- separate policy syntax for views.
grant select on public.account_balances to authenticated;
