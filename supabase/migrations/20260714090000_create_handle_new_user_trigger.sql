-- Purpose: seed a usable app for every real signup — a `profiles` row, the 3
-- default accounts (PRD §4.1), and the full Kenya-tuned category set
-- (PRD §4.3) — so a new user lands on a populated home screen without
-- onboarding having to create this scaffolding itself. This generalizes
-- exactly what `supabase/seed.sql` does for the fixed local dev user to every
-- `auth.users` row created via Supabase Auth (email/Google).
--
-- SECURITY DEFINER + `search_path = ''` (with every reference fully schema-
-- qualified): the trigger fires on `auth.users` insert, before the new
-- user's session/JWT exists, so there is no `auth.uid()` to satisfy the
-- ordinary RLS policies on `public.profiles`/`public.accounts`/
-- `public.categories`. Running as the function's owner (the migration role,
-- which owns these tables and is not subject to their own RLS policies)
-- is what lets this insert succeed at all. Locking `search_path` to empty
-- and qualifying every table/type reference defends against a classic
-- SECURITY DEFINER search_path hijack (a malicious/misconfigured
-- `search_path` pointing an unqualified name at an attacker-controlled
-- object of the same name). Every inserted row's `user_id` is hardcoded to
-- `new.id` — the row being inserted into `auth.users` itself — so this can
-- never seed data under any other user's id.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Profile row (PRD §7 profiles). Defaults mirror the fallbacks
  --    `useSafeToSpend` already assumes when no profile row exists yet
  --    (cycle starts on the 1st, zero declared income until onboarding sets
  --    it) and the column defaults in
  --    20260713110700_create_profiles.sql — set explicitly here so the
  --    seeded row's values are self-evident from this migration alone.
  insert into public.profiles (
    user_id, display_name, cycle_anchor_day, expected_income_cents,
    notification_prefs, consent_flags
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    1,
    0,
    '{}'::jsonb,
    '{}'::jsonb
  )
  on conflict (user_id) do nothing;

  -- 2. Default accounts (PRD §4.1: M-PESA, Cash, Bank created at onboarding)
  --    — same names/types/icons as supabase/seed.sql.
  insert into public.accounts (user_id, name, type, icon)
  values
    (new.id, 'M-PESA', 'mpesa', 'smartphone'),
    (new.id, 'Cash', 'cash', 'banknote'),
    (new.id, 'Bank', 'bank', 'landmark')
  on conflict (user_id, name) do nothing;

  -- 3. Default category set (PRD §4.3) — same names/kinds/icons/colors/
  --    sort_order as supabase/seed.sql.
  insert into public.categories (user_id, name, kind, icon, color, sort_order)
  values
    -- Income
    (new.id, 'Salary', 'income', 'wallet', '#1F8A5D', 1),
    (new.id, 'Business', 'income', 'briefcase', '#1F8A5D', 2),
    (new.id, 'Gig/Freelance', 'income', 'laptop', '#1F8A5D', 3),
    (new.id, 'Gift/Received', 'income', 'gift', '#1F8A5D', 4),
    (new.id, 'Other income', 'income', 'plus-circle', '#1F8A5D', 5),

    -- Expense
    (new.id, 'Food & Groceries', 'expense', 'shopping-basket', '#E8474B', 1),
    (new.id, 'Eating Out', 'expense', 'utensils', '#F65D5E', 2),
    (new.id, 'Transport', 'expense', 'bus', '#C77A1E', 3),
    (new.id, 'Rent & Utilities', 'expense', 'home', '#6B6467', 4),
    (new.id, 'Airtime & Data', 'expense', 'signal', '#E8474B', 5),
    (new.id, 'Shopping', 'expense', 'shopping-bag', '#F65D5E', 6),
    (new.id, 'Health', 'expense', 'heart-pulse', '#C77A1E', 7),
    (new.id, 'Education', 'expense', 'graduation-cap', '#6B6467', 8),
    (new.id, 'Family & Black Tax', 'expense', 'users', '#E8474B', 9),
    (new.id, 'Chama & Savings-out', 'expense', 'piggy-bank', '#F65D5E', 10),
    (new.id, 'Entertainment', 'expense', 'film', '#C77A1E', 11),
    (new.id, 'Subscriptions', 'expense', 'repeat', '#6B6467', 12),
    (new.id, 'Fees & Fuliza charges', 'expense', 'alert-triangle', '#E8474B', 13),
    (new.id, 'Giving/Tithe', 'expense', 'hand-heart', '#F65D5E', 14),
    (new.id, 'Other', 'expense', 'more-horizontal', '#6B6467', 15)
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
