# DECISIONS — Moneta

_Assumptions made under ambiguity, dependency choices (with rationale), and any overruled review findings. Newest first._

## Format

Each entry: date · decision · rationale · scope/impact.

---

## 2026-07-13 — Phase 0 schema, RLS, derived balances, seed (backend-engineer)

**Scope:** `supabase/migrations/20260713110000`…`20260713111000` (11 files), `supabase/seed.sql`, `supabase/tests/database/rls.test.sql`, `package.json` (`test:db` script).

- **Enums over free-text CHECKs for closed value sets.** `account_type`, `category_kind`, `transaction_kind`, `transaction_source` are Postgres `create type ... as enum`, not `text` + `CHECK (x in (...))`. Rationale: stronger DB-level guarantee (typo in an insert fails at parse time, not silently), self-documenting in `\d table`, and `supabase gen types typescript` turns enums into clean TS union types for free. Trade-off (documented, accepted): adding a new value later requires `ALTER TYPE ... ADD VALUE` in a new migration rather than just relaxing a CHECK — acceptable since this value set is genuinely closed (PRD §7 enumerates it exactly).

- **Fee-modeling decision for `account_balances` (the one the lead flagged to verify).** PRD §4.2 is explicit: "An M-PESA agent withdrawal is a transfer from M-PESA to Cash; the withdrawal fee is an expense (category: Fees)." That means a withdrawal-with-fee SMS must produce **two transaction rows** at the application/parser layer — one `transfer` (M-PESA → Cash, full withdrawal amount) and one `expense` (the fee, its own `amount_cents`). Given that, `transactions.fee_cents` (a column PRD §7 lists on the transaction itself) is **not** authoritative money-movement data — it's provenance: what the source SMS/statement literally reported as its fee line, kept for parser debugging, reconciliation display, and the "Fees & Fuliza spotlight" (F10) to cross-check against the actual fee expense row. Consequently `account_balances` **only** ever touches `amount_cents` (via `kind`), and **never subtracts `fee_cents`** — doing so would double-count a fee that's already leaving the account through its own expense transaction. This is called out with an inline comment in `20260713111000_create_account_balances_view.sql` and must be respected by the parser (F2) and statement importer (F5): they must emit a separate fee expense row, not rely on `fee_cents` to move money.

- **`account_balances` view uses `security_invoker = true` (PG15+)**, not a `SECURITY DEFINER` function or a materialized view. Rationale: CLAUDE.md requires balances to be *derived, never stored* (a materialized view is a stored/cached balance and would need invalidation logic — rejected), and `security_invoker` means the view runs with the querying session's own RLS-restricted privileges rather than the view owner's, so it "just works" under RLS without a bespoke policy mechanism (views can't have their own RLS policies — this is the standard idiom for RLS-safe views on Postgres 15+, and the local project's `db.migrations.major_version = 17` supports it).

- **Explicit `grant select, insert, update, delete ... to authenticated` on every table (and `grant select` on the view), in the same migration as the table.** `supabase/config.toml`'s `[api]` section notes the *new* Supabase default does **not** auto-expose newly created `public` schema objects to the Data API roles (`anon`/`authenticated`/`service_role`) without explicit grants — this is a change from older Supabase versions. Without these grants, RLS policies would be moot: the querying role wouldn't even have table-level privilege to attempt the row, and API calls would fail with a permissions error unrelated to RLS. RLS policies remain the row-level gate; these grants are the necessary table-level prerequisite.

- **`accounts` and `categories` each get a `unique (user_id, name)` constraint** (not required verbatim by PRD §7, which only lists the columns). Rationale: (1) gives `supabase/seed.sql` a stable `ON CONFLICT` target so the seed is idempotent-friendly as the task requires, and (2) prevents a user from silently ending up with two "Cash" accounts or two "Food & Groceries" categories, which would corrupt the mental model the safe-to-spend and insights screens depend on. `categories` uniqueness is on `(user_id, name)` only (not `name, kind`) since the PRD's default category set has no cross-kind name collisions and simpler is safer here.

- **`merchant_rules` gets `unique (user_id, merchant_normalized)`.** PRD §4.3 describes it as "the learning table" — one mapping per merchant per user, overwritten on correction, not a history of past guesses. The app should `upsert` on this key.

- **`transactions` money-integrity CHECK constraints beyond the literal PRD §7 field list:** `(kind = 'transfer' and counter_account_id is not null and counter_account_id <> account_id) or (kind <> 'transfer' and counter_account_id is null)`, and `kind <> 'transfer' or category_id is null`. Rationale: CLAUDE.md calls transfer/expense/income correctness "the most-tested code in the app" (PRD §10 risks) — pushing the invariant that transfers always have a distinct counter-account and never a category down into the schema means a bug in application code *cannot* silently corrupt a transaction into an ambiguous state; it fails loudly at insert/update time instead of producing a wrong safe-to-spend number.

- **`amount_cents >= 0` (not `> 0`) per the task's literal instruction**, even though CLAUDE.md's Money rule says "amounts are always positive." Zero-amount transactions are an edge case with no clear use (a KES 0 expense), but `>= 0` was specified explicitly in the task brief for this CHECK, so it's implemented literally rather than tightened to `> 0` unilaterally. Flagging for lead review: consider a follow-up migration to `> 0` if zero-amount rows turn out to be undesirable noise (e.g. in the parser corpus).

- **`profiles` and `streaks` are 1:1 with the user** (`unique (user_id)`), matching the task's explicit note for `profiles` and extending the same reasoning to `streaks` by inference: F8's logging streak is a single running counter per user (`current_count`/`longest_count`/`last_counted_date`/`freezes_used_this_week`), not a history of past streak periods — PRD §7 doesn't say this explicitly, so it's recorded here as an assumption.

- **`challenges` is NOT 1:1** — a user can run many challenges over time (F8: "no-spend challenges: user-initiated"), so it only gets `unique (user_id, type, week_start)` to stop the same weekly challenge being accidentally created twice.

- **`accounts.id`/`counter_account_id` on `transactions` and `recurring_items` use `on delete restrict`, not `cascade`.** Rationale: an account with transaction history must not silently vanish (and take its financial history with it) if someone deletes the account row — the product-level path for retiring an account is `archived_at`, not deletion. `category_id` uses `on delete set null` instead, since losing a category classification (falling back to "uncategorized") is recoverable and non-destructive, unlike losing transaction history.

- **Goals table omits a "linked account" field.** PRD §4.4 prose mentions "linked account (optional)" for a goal, but PRD §7's formal data-model field list for `goals` (which the task instructions reproduce verbatim) does not include it. Followed the explicit §7/task field list as the source of truth for schema shape; flagging the prose/data-model gap here rather than guessing a column name/shape unilaterally. A follow-up migration can add `linked_account_id` when F7 is actually built, once the intended UX (does a contribution *require* a linked account, or is it always a free-floating earmark/transfer?) is settled.

- **`supabase/seed.sql` creates a fixed synthetic dev user** (`id = '11111111-1111-1111-1111-111111111111'`, `email = 'dev@moneta.local'`) directly in `auth.users`, then seeds that user's 3 default accounts + PRD §4.3's full default category set, all via `ON CONFLICT ... DO NOTHING` for idempotency. This only ever runs on `supabase db reset` (local dev), never against a linked remote/production project, per Supabase's standard `seed.sql` semantics — it does not ship real user data anywhere. Category `icon`/`color` values seeded are placeholder string identifiers (e.g. `'shopping-basket'`, hex draws from the CLAUDE.md token palette) — cosmetic, not money-rule-governed, and expected to be revisited by the design-engineer once the icon system exists.

- **RLS assertion test is a dynamic pgTAP suite** (`supabase/tests/database/rls.test.sql`) that queries `pg_tables`/`pg_policies` rather than naming each table, so a future migration that adds a table without RLS (or without all 4 policies) fails the suite automatically without the test file needing an update. It also seeds two synthetic `auth.users` rows and simulates authenticated sessions via `set local role authenticated` + `set_config('request.jwt.claim.sub', ...)` (the mechanism `auth.uid()` reads) to positively/negatively assert cross-user row visibility and a blocked cross-user insert — entirely inside a `begin/rollback` transaction, so it leaves no residue in whatever database it runs against.

- **`test:db` is a separate npm script (`supabase test db`), never folded into `npm run check`.** `npm run check` must stay green without Docker per the task brief; `test:db` requires a local Postgres (via Docker) and is documented as a separate, Docker-gated step.

- **Docker unavailable in this environment — `supabase db reset` and `supabase test db` could not be executed.** `docker` is not on `PATH` (`docker version` → command not found), and `npx supabase db reset` / `npx supabase test db` both fail at the connection step (`Docker Desktop is a prerequisite for local development...` / `PgClient: Failed to connect`). All 11 migrations, the seed script, and the pgTAP suite were written and manually cross-checked (FK targets, policy/grant counts, enum/CHECK consistency — see backend-engineer's report for the exact verification commands run) but are **unexecuted** against a real Postgres. This is the same blocker PROGRESS.md already flagged after the Phase 0 scaffold; re-confirmed here rather than resolved. Whoever picks this up next in a Docker-capable environment should run `npx supabase db reset` (applies migrations + seed) then `npm run test:db` (pgTAP RLS suite) before trusting this schema in anger.

## 2026-07-13 — Phase 0 kickoff

- **Package manager: npm.** CLAUDE.md commands are written as `npm run …`; no lockfile present yet, so we standardize on npm.
- **Toolchain versions:** React 18 + TypeScript strict + Vite, per CLAUDE.md fixed stack. No substitutions.
- **Monorepo shape:** single Vite app at repo root with `supabase/` alongside `src/`. No workspace tooling in v1.

## 2026-07-13 — Phase 0 scaffold (feature-engineer)

**Dependencies added, with rationale:**

Runtime:
- `react` `react-dom` ^18.3.1 — fixed stack (CLAUDE.md); pinned to the 18.x line explicitly since the current npm `latest` tag is React 19.
- `react-router-dom` ^7.18.1 — fixed stack ("React Router").
- `@tanstack/react-query` ^5.101.2 — fixed stack, all server state.
- `@tanstack/react-query-persist-client` ^5.101.2 — `PersistQueryClientProvider`, the React wiring for `persistQueryClient` called out in CLAUDE.md.
- `@tanstack/query-async-storage-persister` ^5.101.2 — async-storage-shaped persister so the cache can persist to IndexedDB (localStorage is forbidden for financial data).
- `idb-keyval` ^6.3.0 — small IndexedDB key-value wrapper used as the storage backend for the persister above.
- `zustand` ^5.0.14 — fixed stack, UI-only state.
- `@supabase/supabase-js` ^2.110.2 — fixed stack (Postgres/RLS/Auth/Edge Functions client).
- `date-fns` ^4.4.0 + `@date-fns/tz` ^1.5.0 — required by CLAUDE.md for all date logic (Africa/Nairobi zone helpers; no raw `Date` math across day boundaries).
- `zod` ^4.4.3 — required at every boundary (parser output, Edge Function payloads, import rows, env parsing).
- `framer-motion` ^12.42.2 — fixed stack, motion system.
- `@fontsource/plus-jakarta-sans` ^5.2.8, `@fontsource/bricolage-grotesque` ^5.2.10 — self-hosted design-system typefaces (see font choice note below).

Dev/tooling:
- `vite` ^8.1.1, `@vitejs/plugin-react` ^6.0.3 — fixed stack build tool (via `create-vite`'s react-ts template).
- `typescript` ~6.0.2 — pinned to stay inside `typescript-eslint`'s supported peer range (`>=4.8.4 <6.1.0`); npm's `latest` tag (7.0.2) is ahead of what the lint tooling supports today.
- `typescript-eslint` ^8.62.0, `eslint` ^10.6.0, `@eslint/js` ^10.0.1, `eslint-plugin-react-hooks` ^7.1.1, `eslint-plugin-react-refresh` ^0.5.3, `globals` ^17.7.0 — scaffolded lint stack (create-vite react-ts + eslint template).
- `eslint-config-prettier` ^10.1.8 — turns off ESLint stylistic rules that conflict with Prettier, so the two tools don't fight.
- `prettier` ^3.9.5 — CLAUDE.md code-style tool, referenced implicitly by "strict TypeScript stays strict" conventions; not in the fixed stack list but standard for this toolchain and needed to keep `npm run check`-adjacent formatting consistent.
- `tailwindcss` ^4.3.2, `@tailwindcss/vite` ^4.3.2 — fixed stack (Tailwind CSS), using the v4 CSS-first config (`@theme` in `src/index.css`) and the official Vite plugin instead of a `tailwind.config.js` + PostCS pipeline.
- `vite-plugin-pwa` ^1.3.0 — fixed stack, Workbox-based PWA/manifest/service-worker generation.
- `vitest` ^4.1.10, `jsdom` ^29.1.1, `@testing-library/react` ^16.3.2, `@testing-library/jest-dom` ^6.9.1, `@testing-library/user-event` ^14.6.1 — fixed stack test tooling.
- `fake-indexeddb` ^6.2.5 — polyfills `indexedDB` under jsdom so components wrapped in the IndexedDB-persisted `PersistQueryClientProvider` (or future hooks using `idb-keyval`) can be rendered in Vitest/RTL tests without crashing; used only in `src/test/setup.ts`.
- `@types/node`, `@types/react` (^18.3.31, pinned to the 18.x line to match the `react` version), `@types/react-dom` (^18.3.7) — type declarations for the above.

**Font hosting:** self-hosted via `@fontsource/*` packages (imported in `src/index.css`), not a Google Fonts `<link>`. Keeps the PWA fully offline-capable (F2/parser and safe-to-spend must work offline) and avoids a third-party network dependency for the design system's core typography.

**Tailwind v4:** used the CSS-first `@theme` block in `src/index.css` (mapped 1:1 onto the `:root` custom properties that are the CLAUDE.md source of truth) plus `@tailwindcss/vite`, instead of a `tailwind.config.js`. This is the current idiomatic Tailwind v4 setup; CLAUDE.md doesn't pin a Tailwind major version.

**Zustand store location:** CLAUDE.md doesn't specify a path for the UI store; placed the stub at `src/store/uiStore.ts` (not under `src/lib/`, which CLAUDE.md reserves for *pure* logic with no framework dependency, and not under a `src/features/` folder since it's cross-cutting UI chrome state, not owned by one feature).

**Routes location:** added `src/routes/{Home,Add}.tsx` for the two Phase 0 shell routes. Neither is a named feature folder in CLAUDE.md's `src/features/{...}` list — Home is app shell, and `/add` is currently just the Web Share Target landing placeholder (real Add-sheet logic is a later phase, likely owned by the `transactions` or `parser` feature folder).

**Web Share Target (F3) scope:** the manifest declares `share_target` (`POST`, `action: /add`, `enctype: application/x-www-form-urlencoded`, params `title`/`text`/`url`) per the task brief. Actually reading a POST body in an installed SPA requires a service worker `fetch` handler that intercepts the POST and redirects to a GET URL with query params before the client router ever sees it — implementing that (and the parse pipeline it feeds) is explicitly out of scope for the empty-shell phase and is deferred to whichever phase implements F2/F3. `src/routes/Add.tsx` already reads `?text=` from `useSearchParams` so it composes cleanly with that future service-worker redirect.

**PWA icons:** the task asked for a placeholder maskable icon set; no image-generation tool (ImageMagick, Python+Pillow, etc.) was available in this environment, so `public/icons/icon-{192,512,maskable-512}.png` were generated with a small one-off Node script that hand-assembles PNG chunks via the built-in `zlib` module (coral-600 field, paper-0 circle mark, 10% safe-zone inset on the maskable variant). The script itself was not committed (scratchpad-only); regenerate/replace with real brand assets before shipping.

**Incident — repo-wide `prettier --write .`:** while validating formatting, `npx prettier --write .` was run without scoping it, which reformatted (whitespace/emphasis-style only, per inspection — no textual content change observed) `moneta-prd.md`, `moneta-master-prompt.md`, `.claude/agents/*.md`, and `CLAUDE.md`. `CLAUDE.md` was restored to its exact original text (it was fully captured verbatim earlier in the same session and diffed line-for-line, including the token hex casing, after restoring). The other four files could not be restored byte-for-byte because their pre-edit content wasn't captured verbatim in-session; spot-checks (e.g. `moneta-prd.md` F1–F2, `feature-engineer.md`) show only blank-line/emphasis-marker normalization with no wording changes. `.prettierignore` now excludes all root `*.md` docs and `.claude/`, and the `format`/`format:check` npm scripts were scoped to `src/**` + `*.config.*` so this cannot recur. Flagging for human review since full byte-fidelity on the four non-CLAUDE.md docs isn't guaranteed.
