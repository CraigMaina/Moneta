-- supabase/tests/database/rls.test.sql
-- pgTAP suite: RLS must be enabled (with select/insert/update/delete policies)
-- on every table in the public schema, plus a positive/negative cross-user
-- access check. Run via `npx supabase test db` (requires Docker — see
-- DECISIONS.md for exact invocation and status).
--
-- This assertion is intentionally dynamic (queries pg_tables/pg_policies
-- rather than naming each table) so a future migration that adds a table
-- without RLS fails this suite automatically.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------
-- 1. Every public table has row level security enabled.
-- ---------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity = false),
  0,
  'every table in the public schema has row level security enabled'
);

-- ---------------------------------------------------------------------
-- 2-5. Every public table has a policy for each of select/insert/update/delete.
-- ---------------------------------------------------------------------
select is(
  (
    select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename and p.cmd = 'SELECT'
      )
  ),
  0,
  'every public table has a SELECT policy'
);

select is(
  (
    select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename and p.cmd = 'INSERT'
      )
  ),
  0,
  'every public table has an INSERT policy'
);

select is(
  (
    select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename and p.cmd = 'UPDATE'
      )
  ),
  0,
  'every public table has an UPDATE policy'
);

select is(
  (
    select count(*)::int from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename and p.cmd = 'DELETE'
      )
  ),
  0,
  'every public table has a DELETE policy'
);

-- ---------------------------------------------------------------------
-- 6-15. Schema shape: every PRD §7 table exists.
-- ---------------------------------------------------------------------
select has_table('public', 'accounts', 'accounts table exists');
select has_table('public', 'categories', 'categories table exists');
select has_table('public', 'transactions', 'transactions table exists');
select has_table('public', 'merchant_rules', 'merchant_rules table exists');
select has_table('public', 'goals', 'goals table exists');
select has_table('public', 'goal_contributions', 'goal_contributions table exists');
select has_table('public', 'recurring_items', 'recurring_items table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'streaks', 'streaks table exists');
select has_table('public', 'challenges', 'challenges table exists');

-- ---------------------------------------------------------------------
-- 16. Derived balances view exists.
-- ---------------------------------------------------------------------
select has_view('public', 'account_balances', 'account_balances view exists');

-- ---------------------------------------------------------------------
-- 17-22. Positive/negative cross-user access test on `accounts`.
-- ---------------------------------------------------------------------

-- Two synthetic auth users (rolled back with the rest of this transaction).
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.moneta'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-b@test.moneta');

-- Seed one account per user as the table owner (bypasses RLS, as intended
-- for direct superuser setup — mirrors how a service-role/admin task would
-- write these rows outside of a user's own session).
insert into public.accounts (id, user_id, name, type) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Wallet', 'cash'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B Wallet', 'cash');

-- Simulate an authenticated request as user A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.accounts),
  1,
  'user A sees exactly one account row under RLS'
);

select is(
  (select name from public.accounts limit 1),
  'A Wallet',
  'user A sees only their own account'
);

select is(
  (select count(*)::int from public.accounts where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'user A cannot read user B''s account row'
);

select throws_ok(
  $$ insert into public.accounts (user_id, name, type)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sneaky', 'cash') $$,
  '42501',
  null,
  'user A cannot insert a row owned by user B (RLS WITH CHECK blocks it)'
);

-- Switch to user B; the same visibility rules must hold in reverse.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.accounts),
  1,
  'user B sees exactly one account row under RLS'
);

select is(
  (select name from public.accounts limit 1),
  'B Wallet',
  'user B sees only their own account'
);

reset role;

select * from finish();

rollback;
