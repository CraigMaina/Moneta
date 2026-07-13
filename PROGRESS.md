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

- `qa-reviewer` returned **APPROVE WITH NITS** on Phase 0 (no blocking findings). Verified green: `npm run check`, schema-matches-§7 (all 10 tables + view walked field-by-field), RLS present + correct on all tables by inspection, money rules honored end-to-end, PWA build (manifest incl. `share_target` + SW). Left unverifiable pending Docker/device: the pgTAP RLS *execution* and on-device install.
- **Lead post-review polish** (all green, committed): tightened `transactions.amount_cents` to `> 0`; strengthened the RLS pgTAP suite (22 → 25) with a no-open-policy assertion + `transactions` cross-user denial; deduped PWA precache (34 → 33); hardened `supabase.ts` to throw on bad env in PROD. Details in DECISIONS.md.

## In-flight

- **DB verification via Supabase cloud** (user chose this over local Docker — DECISIONS.md). User is creating a cloud project + linking the CLI. Once linked: `supabase db push` applies migrations to real Postgres and `supabase test db --db-url …` runs the strengthened pgTAP RLS suite. This closes the last verifiable Phase 0 exit box.

## Next

- On user confirming CLI is linked: verify `db push` succeeds and the pgTAP RLS suite (25 assertions) passes against the cloud DB; then generate `src/lib/database.types.ts` from the live schema and wire it into the Supabase client types.
- Then declare Phase 0 done and open **Phase 1 — Design system** (design-engineer: tokens as Tailwind theme + CSS vars already scaffolded → primitive kit + `/kitchen-sink` + safe-to-spend hero).

## Phase exit checklist (Phase 0)

- [x] `npm run check` green
- [x] Installable empty-shell PWA builds with manifest (incl. `share_target`) + service worker (`npm run build` verified locally; not yet installed on a physical device)
- [x] Schema matches PRD §7 — all 10 tables + `account_balances` view, migrations in `supabase/migrations/` (confirmed by qa-reviewer)
- [x] qa-reviewer returns APPROVE (APPROVE WITH NITS; nits actioned or deferred-with-record)
- [ ] RLS assertion test passes — suite strengthened to 25 assertions but **unexecuted**; closing via the Supabase cloud `db push` + `test db` path (in-flight)
- [ ] Empty-shell PWA installed + running on a physical phone (build verified; on-device pending)

## Known incident (see DECISIONS.md for full detail)

- An unscoped `npx prettier --write .` during Phase 0 formatting touched `moneta-prd.md`, `moneta-master-prompt.md`, `.claude/agents/*.md`, and `CLAUDE.md`. `CLAUDE.md` was restored exactly (verified line-for-line against the verbatim copy read earlier in-session). The other four were not byte-verifiable against a pre-edit copy; spot checks show whitespace/emphasis-marker-only changes, no wording changes. `.prettierignore` and the `format` script are now scoped to prevent recurrence. Recommend a human diff/skim of those four files.
