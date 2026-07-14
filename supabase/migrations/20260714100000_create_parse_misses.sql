-- Purpose: create the `parse_misses` table — logs every M-PESA SMS the
-- deterministic on-device parser (src/parser/) could not match, whether or
-- not the Edge Function LLM fallback (`parse-sms`) then successfully
-- extracted it. This is the "author new deterministic patterns from real
-- misses" pipeline (PRD §F2 point 2, CLAUDE.md Parser rules: "LLM fallback
-- ... the raw message is stored (hashed dedupe) so new deterministic
-- patterns can be authored from real misses").
--
-- RLS + a per-user dedupe key on (user_id, raw_sms_hash), mirroring
-- transactions.mpesa_ref's per-user partial-unique-index dedupe convention
-- (CLAUDE.md Database rules) — re-pasting/re-sharing the same unparseable
-- message must never pile up duplicate rows.

create table public.parse_misses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw_sms text not null,
  -- SHA-256 hex digest of the normalized raw SMS text (trimmed, internal
  -- whitespace collapsed) — the per-user dedupe key. Computed by the
  -- parse-sms Edge Function (see supabase/functions/parse-sms/index.ts);
  -- the client never computes or trusts this value itself.
  raw_sms_hash text not null,
  llm_succeeded boolean not null default false,
  parser_version text,
  -- Flip to true once a deterministic pattern-table entry covers this shape
  -- (a manual/offline bookkeeping flag for whoever authors patterns.json
  -- updates from this log — no app code flips it automatically in v1).
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index parse_misses_user_created_idx on public.parse_misses (user_id, created_at desc);

-- Per-user dedupe backbone. raw_sms_hash is NOT NULL on this table (unlike
-- transactions.mpesa_ref, which is nullable for manual entries with no SMS
-- behind them), so a plain unique index would behave identically to a
-- partial one here — kept as a partial index anyway (`where raw_sms_hash is
-- not null`) so it reads the same way as the mpesa_ref convention at a
-- glance and stays correct if raw_sms_hash is ever loosened to nullable.
-- See DECISIONS.md.
create unique index parse_misses_user_hash_uniq
  on public.parse_misses (user_id, raw_sms_hash)
  where raw_sms_hash is not null;

alter table public.parse_misses enable row level security;

create policy "parse_misses_select_own"
  on public.parse_misses for select
  using (user_id = auth.uid());

create policy "parse_misses_insert_own"
  on public.parse_misses for insert
  with check (user_id = auth.uid());

create policy "parse_misses_update_own"
  on public.parse_misses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "parse_misses_delete_own"
  on public.parse_misses for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.parse_misses to authenticated;
