-- supabase/tests/database/parse_misses.test.sql
-- pgTAP suite: `parse_misses` — the LLM-fallback miss-logging table for
-- src/parser/'s deterministic-parser misses (PRD §F2 point 2). Verifies the
-- table shape, column defaults, the per-user dedupe unique index, and RLS
-- cross-user isolation — mirroring the existing rls.test.sql /
-- new_user.test.sql patterns. Run via
-- `SUPABASE_DB_URL=… node supabase/tests/run-pgtap.mjs
-- supabase/tests/database/parse_misses.test.sql` (Docker-free runner — see
-- DECISIONS.md).
--
-- Self-contained: everything happens inside begin/rollback, so nothing here
-- leaves residue in whatever database it runs against.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public', 'parse_misses', 'parse_misses table exists');

-- Two synthetic auth users (rolled back with the rest of this transaction).
-- Inserting them also fires handle_new_user (seeds each their own default
-- accounts/categories/profile) — irrelevant here, parse_misses isn't
-- touched by that trigger.
insert into auth.users (id, email) values
  ('cccccccc-1111-4111-8111-cccccccccccc', 'miss-user-a@test.moneta'),
  ('dddddddd-2222-4222-8222-dddddddddddd', 'miss-user-b@test.moneta');

-- Insert as the table owner (bypasses RLS, as intended for direct setup) to
-- check column defaults independent of the RLS layer.
insert into public.parse_misses (id, user_id, raw_sms, raw_sms_hash)
values (
  'eeeeeeee-3333-4333-8333-eeeeeeeeeeee',
  'cccccccc-1111-4111-8111-cccccccccccc',
  'Some unparseable M-PESA text',
  'hash-one'
);

select is(
  (select llm_succeeded from public.parse_misses where id = 'eeeeeeee-3333-4333-8333-eeeeeeeeeeee'),
  false,
  'llm_succeeded defaults to false'
);

select is(
  (select resolved from public.parse_misses where id = 'eeeeeeee-3333-4333-8333-eeeeeeeeeeee'),
  false,
  'resolved defaults to false'
);

-- Dedupe: the same (user_id, raw_sms_hash) pair cannot be inserted twice —
-- this is the per-user dedupe backbone the Edge Function's upsert relies on.
select throws_ok(
  $$ insert into public.parse_misses (user_id, raw_sms, raw_sms_hash)
     values ('cccccccc-1111-4111-8111-cccccccccccc', 'Same message, re-pasted', 'hash-one') $$,
  '23505',
  null,
  'a duplicate (user_id, raw_sms_hash) pair is rejected (the per-user dedupe backbone)'
);

-- A row for user B (owner-level insert, bypasses RLS as intended for setup).
insert into public.parse_misses (id, user_id, raw_sms, raw_sms_hash)
values (
  'ffffffff-4444-4444-8444-ffffffffffff',
  'dddddddd-2222-4222-8222-dddddddddddd',
  'A different unparseable text',
  'hash-two'
);

-- Simulate an authenticated request as user A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-1111-4111-8111-cccccccccccc', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'cccccccc-1111-4111-8111-cccccccccccc', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*)::int from public.parse_misses where raw_sms_hash = 'hash-one'),
  1,
  'user A sees their own parse_misses row'
);

select is(
  (select count(*)::int from public.parse_misses where raw_sms_hash = 'hash-two'),
  0,
  'user A cannot see user B''s parse_misses row'
);

select throws_ok(
  $$ insert into public.parse_misses (user_id, raw_sms, raw_sms_hash)
     values ('dddddddd-2222-4222-8222-dddddddddddd', 'Sneaky', 'hash-three') $$,
  '42501',
  null,
  'user A cannot insert a parse_misses row owned by user B (RLS WITH CHECK blocks it)'
);

reset role;

select * from finish();

rollback;
