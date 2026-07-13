-- supabase/tests/database/new_user.test.sql
-- pgTAP suite: `public.handle_new_user()` (fired by the `on_auth_user_created`
-- trigger on `auth.users`) seeds a usable app for a brand-new signup — a
-- profile row, the 3 default accounts, and the full PRD §4.3 category set —
-- mirroring supabase/seed.sql's dev-user seed for every real user. Run via
-- `SUPABASE_DB_URL=… node supabase/tests/run-pgtap.mjs
-- supabase/tests/database/new_user.test.sql` (Docker-free runner — see
-- DECISIONS.md).
--
-- Self-contained and non-persistent: everything happens inside
-- begin/rollback, so inserting a synthetic `auth.users` row here never
-- leaves residue in whatever database this runs against.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Trigger the seed by inserting a brand-new auth user.
insert into auth.users (id, email)
values ('99999999-9999-9999-9999-999999999999', 'new-user-test@test.moneta');

-- 1. Exactly one profile row.
select is(
  (
    select count(*)::int from public.profiles
    where user_id = '99999999-9999-9999-9999-999999999999'
  ),
  1,
  'handle_new_user creates exactly one profiles row for a new signup'
);

-- 2. Exactly the 3 default accounts.
select is(
  (
    select count(*)::int from public.accounts
    where user_id = '99999999-9999-9999-9999-999999999999'
  ),
  3,
  'handle_new_user creates exactly the 3 default accounts (M-PESA, Cash, Bank)'
);

-- 3. The full PRD §4.3 category set (5 income + 15 expense = 20), matching
--    supabase/seed.sql's count exactly.
select is(
  (
    select count(*)::int from public.categories
    where user_id = '99999999-9999-9999-9999-999999999999'
  ),
  20,
  'handle_new_user creates the full PRD §4.3 category set (20 categories)'
);

-- 4. Spot-check a known category exists.
select is(
  (
    select count(*)::int from public.categories
    where user_id = '99999999-9999-9999-9999-999999999999'
      and name = 'Food & Groceries'
  ),
  1,
  'Food & Groceries category exists for the new user'
);

-- 5. Spot-check a known account exists.
select is(
  (
    select count(*)::int from public.accounts
    where user_id = '99999999-9999-9999-9999-999999999999'
      and name = 'M-PESA'
  ),
  1,
  'M-PESA account exists for the new user'
);

select * from finish();

rollback;
