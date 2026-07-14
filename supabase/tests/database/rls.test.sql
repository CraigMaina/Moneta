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

select plan(26);

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
-- 6. No permissive-open policy. Every policy must scope by auth.uid();
--    a policy whose USING (qual) and WITH CHECK are both free of auth.uid()
--    (e.g. a `USING (true)` regression) is a silent full-table leak that the
--    "a policy exists" checks above would NOT catch. Assert zero such policies.
-- ---------------------------------------------------------------------
select is(
  (
    select count(*)::int from pg_policies p
    where p.schemaname = 'public'
      and coalesce(p.qual, '') not like '%auth.uid()%'
      and coalesce(p.with_check, '') not like '%auth.uid()%'
  ),
  0,
  'every public policy scopes access by auth.uid() (no permissive-open policy)'
);

-- ---------------------------------------------------------------------
-- 7-17. Schema shape: every PRD §7 table exists, plus parse_misses (Phase 3
-- LLM-fallback miss log — not a PRD §7 table, but must ship under the same
-- "RLS on every public table" guarantee this suite enforces dynamically).
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
select has_table('public', 'parse_misses', 'parse_misses table exists');

-- ---------------------------------------------------------------------
-- 18. Derived balances view exists.
-- ---------------------------------------------------------------------
select has_view('public', 'account_balances', 'account_balances view exists');

-- ---------------------------------------------------------------------
-- 19-24. Positive/negative cross-user access test on `accounts`.
-- ---------------------------------------------------------------------

-- Two synthetic auth users (rolled back with the rest of this transaction).
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.moneta'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-b@test.moneta');

-- Seed one named account per user as the table owner (bypasses RLS, as
-- intended for direct superuser setup). NOTE: inserting the auth.users rows
-- above also fired handle_new_user, which auto-seeds each user 3 default
-- accounts + categories — so these are NOT the users' only accounts. The
-- assertions below therefore test the RLS *property* (each user sees their own
-- named account and never the other's), not exact row counts.
insert into public.accounts (id, user_id, name, type) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A Wallet', 'cash'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B Wallet', 'cash');

-- One transaction owned by user B, on B's account — the highest-risk table.
insert into public.transactions (id, user_id, account_id, kind, amount_cents) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'expense', 1000);

-- Simulate an authenticated request as user A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.accounts where name = 'A Wallet'),
  1,
  'user A sees their own account'
);

select is(
  (select count(*)::int from public.accounts where name = 'B Wallet'),
  0,
  'user A cannot see user B''s account (by name)'
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

-- Same guarantees on the transactions ledger (the money table).
select is(
  (select count(*)::int from public.transactions),
  0,
  'user A cannot read user B''s transactions'
);

select throws_ok(
  $$ insert into public.transactions (user_id, account_id, kind, amount_cents)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'dddddddd-dddd-dddd-dddd-dddddddddddd', 'expense', 500) $$,
  '42501',
  null,
  'user A cannot insert a transaction owned by user B (RLS WITH CHECK blocks it)'
);

-- Switch to user B; the same visibility rules must hold in reverse.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.accounts where name = 'B Wallet'),
  1,
  'user B sees their own account'
);

select is(
  (select count(*)::int from public.accounts where name = 'A Wallet'),
  0,
  'user B cannot see user A''s account (by name)'
);

reset role;

select * from finish();

rollback;
