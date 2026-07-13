# PROGRESS — Moneta

_Read this first at the start of every session. Append at the end of every session: done / in-flight / next._

## Current phase

**Phase 0 — Foundation** (in progress)

## Done

- Read `moneta-prd.md` and `CLAUDE.md` in full.
- Confirmed the five project agents load from `.claude/agents/` (design-engineer, backend-engineer, parser-engineer, feature-engineer, qa-reviewer).
- Created `PROGRESS.md` and `DECISIONS.md`.

- `feature-engineer` completed the Phase 0 scaffold: Vite + React 18 + TS strict, Tailwind v4 (CSS-first tokens), TanStack Query persisted to IndexedDB (idb-keyval), Zustand UI-store stub, React Router (`/` Home placeholder, `/add` share-target landing placeholder), Supabase client singleton (`src/lib/supabase.ts`, zod-validated env), vite-plugin-pwa with a manifest incl. `share_target`, ESLint + Prettier, Vitest + RTL with one smoke test, empty feature-folder skeleton, `supabase/config.toml` via `supabase init`.
- `npm run check` (typecheck + lint + test) and `npm run build` (PWA build with service worker + manifest) are both green locally.

- `backend-engineer` completed the Phase 0 schema: 11 migrations under `supabase/migrations/` covering all 10 PRD §7 tables (`accounts`, `categories`, `transactions`, `merchant_rules`, `goals`, `goal_contributions`, `recurring_items`, `profiles`, `streaks`, `challenges`) + the `account_balances` derived-balance view, each table with RLS enabled and select/insert/update/delete policies (`user_id = auth.uid()`) in the same migration that creates it, plus explicit Data-API grants (Supabase's newer default no longer auto-exposes new tables). `transactions.mpesa_ref` has its per-user partial unique index (dedupe backbone). `supabase/seed.sql` seeds a fixed dev user + 3 default accounts + the full PRD §4.3 category set, idempotently. A dynamic pgTAP RLS suite (`supabase/tests/database/rls.test.sql`, 22 assertions) asserts RLS is enabled + fully policied on every public table and does a real cross-user access test; wired as `npm run test:db`, kept separate from `npm run check`.
- `npm run check` reconfirmed green after the schema work (Docker-less, as required).

## In-flight

- Nothing in-flight; Phase 0 schema ready for `qa-reviewer` pass. `db reset`/`test:db` still need to be executed once Docker is available (see below).

## Next

- Dispatch `qa-reviewer` for the Phase 0 schema (migrations + RLS + seed + pgTAP suite).
- In a Docker-capable environment: run `npx supabase db reset` (applies all 11 migrations + seed.sql) then `npm run test:db` (pgTAP RLS suite) to get first real execution evidence for this schema — currently unexecuted, see DECISIONS.md.
- Fill in `.env` from `.env.example` with real Supabase project values before any Supabase-backed feature work.
- Generate `src/lib/database.types.ts` via `npx supabase gen types typescript --local` once Docker/local db is available (skipped this round — no live db to introspect).

## Phase exit checklist (Phase 0)

- [x] `npm run check` green
- [x] Installable empty-shell PWA builds with manifest (incl. `share_target`) + service worker (`npm run build` verified locally; not yet installed on a physical device)
- [x] Schema matches PRD §7 (backend-engineer) — all 10 tables + `account_balances` view, migrations in `supabase/migrations/`
- [ ] RLS assertion test passes — suite written (`supabase/tests/database/rls.test.sql`, 22 assertions) but **unexecuted**; Docker unavailable in this environment (`docker` not on PATH, `supabase db reset`/`test db` both fail at the connection step). Must be run in a Docker-capable environment before this box is checked.
- [ ] qa-reviewer returns APPROVE

## Known incident (see DECISIONS.md for full detail)

- An unscoped `npx prettier --write .` during Phase 0 formatting touched `moneta-prd.md`, `moneta-master-prompt.md`, `.claude/agents/*.md`, and `CLAUDE.md`. `CLAUDE.md` was restored exactly (verified line-for-line against the verbatim copy read earlier in-session). The other four were not byte-verifiable against a pre-edit copy; spot checks show whitespace/emphasis-marker-only changes, no wording changes. `.prettierignore` and the `format` script are now scoped to prevent recurrence. Recommend a human diff/skim of those four files.
