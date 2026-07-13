-- supabase/seed.sql
-- Runs automatically after migrations on `supabase db reset` (local dev only —
-- never applied to a remote/production project). Seeds one fixed dev user plus
-- the three default accounts and the Kenya-tuned default categories (PRD §4.3).
--
-- Idempotent-friendly: every insert targets a unique constraint created in the
-- migrations (accounts: (user_id, name); categories: (user_id, name)) and uses
-- ON CONFLICT DO NOTHING, so re-running this file against a non-empty db does
-- not error or duplicate rows.

-- Fixed local-dev user id/email — not a real auth identity, just an owner row
-- for seeded data to hang off of (auth.users FK). Real users are created via
-- Supabase Auth at signup; this row only exists so `db reset` produces a
-- populated dev database to develop against.
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'dev@moneta.local')
on conflict (id) do nothing;

do $$
declare
  seed_user uuid := '11111111-1111-1111-1111-111111111111';
begin

  -- Default accounts (PRD §4.1: M-PESA, Cash, Bank created at onboarding).
  insert into public.accounts (user_id, name, type, icon)
  values
    (seed_user, 'M-PESA', 'mpesa', 'smartphone'),
    (seed_user, 'Cash', 'cash', 'banknote'),
    (seed_user, 'Bank', 'bank', 'landmark')
  on conflict (user_id, name) do nothing;

  -- Default categories (PRD §4.3). icon/color are placeholder identifiers
  -- pending the design-engineer's icon system; name/kind/sort_order are the
  -- PRD-mandated fields.
  insert into public.categories (user_id, name, kind, icon, color, sort_order)
  values
    -- Income
    (seed_user, 'Salary', 'income', 'wallet', '#1F8A5D', 1),
    (seed_user, 'Business', 'income', 'briefcase', '#1F8A5D', 2),
    (seed_user, 'Gig/Freelance', 'income', 'laptop', '#1F8A5D', 3),
    (seed_user, 'Gift/Received', 'income', 'gift', '#1F8A5D', 4),
    (seed_user, 'Other income', 'income', 'plus-circle', '#1F8A5D', 5),

    -- Expense
    (seed_user, 'Food & Groceries', 'expense', 'shopping-basket', '#E8474B', 1),
    (seed_user, 'Eating Out', 'expense', 'utensils', '#F65D5E', 2),
    (seed_user, 'Transport', 'expense', 'bus', '#C77A1E', 3),
    (seed_user, 'Rent & Utilities', 'expense', 'home', '#6B6467', 4),
    (seed_user, 'Airtime & Data', 'expense', 'signal', '#E8474B', 5),
    (seed_user, 'Shopping', 'expense', 'shopping-bag', '#F65D5E', 6),
    (seed_user, 'Health', 'expense', 'heart-pulse', '#C77A1E', 7),
    (seed_user, 'Education', 'expense', 'graduation-cap', '#6B6467', 8),
    (seed_user, 'Family & Black Tax', 'expense', 'users', '#E8474B', 9),
    (seed_user, 'Chama & Savings-out', 'expense', 'piggy-bank', '#F65D5E', 10),
    (seed_user, 'Entertainment', 'expense', 'film', '#C77A1E', 11),
    (seed_user, 'Subscriptions', 'expense', 'repeat', '#6B6467', 12),
    (seed_user, 'Fees & Fuliza charges', 'expense', 'alert-triangle', '#E8474B', 13),
    (seed_user, 'Giving/Tithe', 'expense', 'hand-heart', '#F65D5E', 14),
    (seed_user, 'Other', 'expense', 'more-horizontal', '#6B6467', 15)
  on conflict (user_id, name) do nothing;

end $$;
