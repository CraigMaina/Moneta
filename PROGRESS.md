# PROGRESS — Moneta

_Read this first at the start of every session. Append at the end of every session: done / in-flight / next._

## Current phase

**Phase 2 — Core money loop (in progress, ~80%).** DONE: pure `safeToSpend.ts` calc (lead, 19 tests); typed data hooks + `useSafeToSpend` seam (feature-engineer, money-path lead-reviewed); manual-entry sheet + Home assembly (design-engineer); email magic-link/OTP auth + `SessionGate` (lead); transfer-semantics seam verified by integration test (lead — income→expense→withdrawal(transfer+fee) balances + safe-to-spend all correct). REMAINING: transactions-list screen (grouping/search/filters/swipe — design-engineer Brief D); live manual E2E (needs the user to sign in via email); formal ≥95% branch-coverage number for the safe-to-spend module; qa-reviewer Phase 2 gate. Phases 0 + 1 COMPLETE (qa APPROVE each). 179 tests green; ~19 commits.

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

- **DB verified against Supabase cloud** (project `passrudtrwgqmimtldtt`, eu-central-1). `supabase db push` applied all 11 migrations cleanly to real Postgres. The pgTAP RLS suite **passes 25/25** via the new Docker-free runner (`npm run test:rls`, since `supabase test db` needs Docker). See DECISIONS.md.

## In-flight

- Nothing blocking. Phase 0 is functionally complete; only the physical-device install remains (optional gate).

## Next

- **User action (security):** rotate the Supabase DB password AND revoke the `sbp_` personal access token (both entered the transcript) — dashboard → Database → reset password; Account → Access Tokens → revoke.
- **Phase 2 in progress:** safe-to-spend calc done (lead, `ce4de1f`). `.env` wired (anon key); `database.types.ts` generated from the live schema, client now `createClient<Database>` (`5aad211`; `npm run gen:types` regenerates). Data hooks + `useSafeToSpend` adapter done (feature-engineer, see below). **design-engineer just landed the manual-entry sheet + Home** (see new section below) — next: lead verifies the transfer seam live + visual QA at 390×844, then qa gate.
- **Auth gap:** no sign-in UI yet — hooks assume a `supabase.auth` session (tests mock it; the new UI mocks the data-hook modules entirely, per its brief). Lead to wire a minimal/dev auth so the Phase 2 live E2E exit (income→expense→transfer totals) can run, and so the new Home/Add-sheet UI has real data to render outside of tests.

## Phase 2 — manual-entry sheet + Home assembly (design-engineer)

**Scope:** `src/features/transactions/AddTransactionSheet.tsx` (+ test), `src/features/transactions/iconMaps.tsx`, `src/routes/Home.tsx` (rewritten from its Phase 0 placeholder) + `Home.test.tsx`, two new icons (`CashIcon`, `BankIcon`) appended to `src/components/ui/icons.tsx`. Wired entirely against the existing data-hook layer (`useAccounts`/`useCategories`/`useTransactions`/`useAccountBalances`/`useAddTransaction`/`useSafeToSpend`) — none of those files were touched. Not committed, per brief — left for the lead to visually verify at 390×844 and verify the transfer seam live.

- **`AddTransactionSheet`** — the 3-second manual-entry flow (PRD F4): `Sheet` → `Keypad` → an Expense/Income/Transfer segmented control → category chips (hidden for transfers) → account chip(s) (a "From"/"To" pair for transfers, filtered so the same account can never appear in both) → an optional note `<input>` → a sticky-in-thumb-zone "Log it" `Button`. Every list (categories, accounts) has its own loading skeleton, inline retry-on-error, and empty-teaches state. A mutation failure shows a non-shaming toast and keeps the sheet open (per brief); success shows "Logged"/"Logged income"/"Logged transfer" and closes. No `<form>` anywhere — buttons + handlers only.
- **Home (`src/routes/Home.tsx`)** — assembled around the `SafeToSpendHero` (fed by `useSafeToSpend()`, with a calm pulsing-skeleton loading state and a calm "Couldn't work out today's number" + Try again retry state, never a scary error), a horizontal-scroll account-balances row (`useAccountBalances()`), and a "Recent" list (`useTransactions({ limit: 8 })`) whose rows render income (`tone="income"`, `+KES`), expense (`tone="expense"` via a negated cents value so `formatKES` supplies the `-`, matching the existing kitchen-sink convention), and transfers (neutral, no sign, labeled "Transfer") distinctly — transfers are never counted as income/expense anywhere, inherited structurally from `calcSafeToSpend`. Empty state teaches ("No transactions yet" + "Add a transaction" button). `TabBar`'s Add button and the empty-state's button both open `AddTransactionSheet` via `useUiStore`'s existing `activeSheet`/`openSheet`/`closeSheet` (`activeSheet === 'add'` drives the sheet's `open` prop).
- **Not added to `/kitchen-sink`** — deliberate; see DECISIONS.md. Both are live-hook compositions needing a real session, unlike every existing kitchen-sink entry (self-contained primitives). Visual QA should hit `/` directly.
- Testing Library coverage (mocking the query/mutation hook modules, no network/session touched): add-expense happy path (amount → category → Log it → `mutate` called with correct integer-cents `AddTransactionInput`), transfer correctness (switching to Transfer hides category, forces a distinct counter-account, builds `kind:'transfer'`/`category_id: null`), a mutation-failure toast that keeps the sheet open, a disabled-until-amount-entered check, an inline category-load-retry check; Home renders the hero from a mocked `useSafeToSpend`, shows a calm retry on hero error, shows the empty state when there are no transactions, and both Add entry points (TabBar + empty-state button) open the sheet.
- **`npm run check` green** (24 files → 23 test files total incl. the 2 new ones, **171 tests**, up from 161). `npm run build` also verified green (PWA manifest/SW still emit cleanly; one pre-existing >500kB chunk-size warning, unrelated to this slice).
- Notable build-out detour (full rationale in DECISIONS.md): the first draft used several `useEffect`s to reset the sheet's fields on open and to keep derived selections (default account, transfer eligibility, valid category/counter-account) in sync — every one tripped ESLint's `react-hooks/set-state-in-effect`. Rewritten so the sheet's form only mounts while `open` is true (fresh `useState` initializers, no reset effect) and every "keep valid" concern is a plain value derived at render time, never written back into state.

## Phase 1 — Design system (in progress)

- **Brief A (design-engineer)** landed the core primitive kit: `Button`, `Card`, `Sheet`, `TabBar`, `Toast`/`useToast`, `EmptyState`, `icons.tsx`, `src/lib/cn.ts`, and `/kitchen-sink`. Not modified in Brief B except to add new sections.
- **Brief B (design-engineer)** landed the money primitives + the signature safe-to-spend hero, all in `src/components/ui/`:
  - `AmountDisplay` — the canonical money renderer (`hero`/`title`/`body` sizes, `default`/`income`/`expense`/`warning` tones, `signed` prefix), always through `formatKES`, always `tabular-nums`.
  - `Keypad` — the oversized numeric entry pad (PRD F4). Pure, exhaustively-tested cents math: `applyKeypadKey`, `keypadStateToCents`, `centsToKeypadState`, `formatKeypadBuffer`. Never a float touches the money path — digit groups are parsed with `parseInt`, never `parseFloat`.
  - `CategoryChip` — selectable pill (icon + label), 44px floor, horizontal-scroller ready. 6 new category glyphs added to `icons.tsx` (`GroceriesIcon`, `EatingOutIcon`, `TransportIcon`, `AirtimeIcon`, `ShoppingIcon`, `EntertainmentIcon`, `OtherIcon`, `BackspaceIcon`) — a representative subset of PRD §4.3's category set, not exhaustive (Rent & Utilities reuses the existing `HomeIcon`). Full category icon set deferred to the categories feature.
  - `ProgressRing` — SVG progress ring (0-1, clamped via pure `clampProgress`), spring-animated fill, `prefers-reduced-motion`-aware. Basis for the hero arc and future goal rings.
  - `SafeToSpendHero` — THE signature element. Count-up numeral (0.8s tween, a documented moment-of-meaning exception to the ≤350ms motion ceiling), breathing coral arc, calm amber "You're KES X over this month" negative-state copy (never a scary red zero), fully static under `prefers-reduced-motion`.
  - All five wired into `/kitchen-sink` with every state (sizes/tones, live keypad + running `formatKES` value, chip scroller, ring at 0/25/60/100%, hero in healthy/near-zero/negative states).
- `npm run check` (typecheck + lint + test, now **87 tests** across 13 files) and `npm run build` are both green.
- **Lead visual QA at 390×844** (Chrome): verified all primitive states, the Sheet interaction (open, drag handle, X, Escape-closes-with-focus-restore, scrim), and all three hero states (healthy coral arc "KES 1,400"; near-zero; over-budget = calm amber ring "You're KES 340 over this month", no red). After the KES-mark fix, re-verified the numeral now carries the hero.
- **qa-reviewer: APPROVE WITH NITS** (no blocking findings). Lead fixes landed: Toast keyboard dismiss (+test), hero KES de-emphasis, TabBar upward `--shadow-bar`, two contrast deviations recorded in DECISIONS.md. Remaining test-gap follow-ups (deferred, low-risk): Sheet focus-trap Tab-cycling test, ProgressRing reduced-motion assertion, Keypad `valueCents` mount-seed test.

### Phase 1 exit checklist
- [x] Primitive kit built (Button, Card, Sheet, TabBar, Toast, EmptyState, AmountDisplay, Keypad, CategoryChip, ProgressRing) + `/kitchen-sink` with every state
- [x] Safe-to-spend hero built + polished (count-up, coral arc, reduced-motion, calm negative state)
- [x] Keyboard focus states on every interactive element (Toast dismiss closed the last gap)
- [x] Reduced-motion honored + verified (Sheet, Toast, ProgressRing, Hero)
- [x] qa-reviewer design critique passes the bar (APPROVE WITH NITS; required nit resolved)
- [x] `npm run check` green (87 tests)

## Phase exit checklist (Phase 0)

- [x] `npm run check` green
- [x] Installable empty-shell PWA builds with manifest (incl. `share_target`) + service worker (`npm run build` verified; not yet installed on a physical device)
- [x] Schema matches PRD §7 — all 10 tables + `account_balances` view (confirmed by qa-reviewer)
- [x] qa-reviewer returns APPROVE (APPROVE WITH NITS; nits actioned or deferred-with-record)
- [x] RLS assertion test passes — **25/25 against cloud Postgres** via `npm run test:rls`
- [ ] Empty-shell PWA installed + running on a physical phone (build verified; on-device install pending — optional, needs your phone)

## Known incident (see DECISIONS.md for full detail)

- An unscoped `npx prettier --write .` during Phase 0 formatting touched `moneta-prd.md`, `moneta-master-prompt.md`, `.claude/agents/*.md`, and `CLAUDE.md`. `CLAUDE.md` was restored exactly (verified line-for-line against the verbatim copy read earlier in-session). The other four were not byte-verifiable against a pre-edit copy; spot checks show whitespace/emphasis-marker-only changes, no wording changes. `.prettierignore` and the `format` script are now scoped to prevent recurrence. Recommend a human diff/skim of those four files.

## Phase 2 — Core money loop: typed data layer (feature-engineer)

**Scope:** `src/features/transactions/` — queries, mutations, boundary zod schemas, the `useSafeToSpend` money-path seam, and their colocated tests. No UI/screens (per brief; the design-engineer builds screens next against these hook signatures). No files outside `src/features/transactions/` and `src/test/supabaseTestHelpers.ts` were touched.

**Files added:**
- `src/features/transactions/types.ts` — `Account`/`Category`/`Profile`/`RecurringItem`/`Transaction`/`TransactionInsert`/`TransactionUpdate`/`AccountBalance`/`TransactionKind`/`TransactionSource`, all derived from `database.types.ts` (no hand-written row shapes).
- `src/features/transactions/queryKeys.ts` — key factories, every key namespaced by `userId`.
- `src/features/transactions/nairobiDate.ts` (+ test) — `toNairobiDateString(date)`, a `yyyy-MM-dd` Nairobi-zone formatter for comparing instants against the plain-`date` `recurring_items.next_due_date` column.
- `src/features/transactions/hooks/useAuthUserId.ts` (+ test) — reads `supabase.auth.getSession()`/`onAuthStateChange`; every hook below is `enabled` only once this resolves to a real id.
- `src/features/transactions/queries.ts` (+ test) — `useAccounts()`, `useCategories()`, `useTransactions(options?: { from?, to?, limit? })` (ordered `occurred_at desc`), `useAccountBalances()` (reads the `account_balances` view), `useProfile()` (single row via `maybeSingle`), `useUpcomingRecurringBills({ from, to })` (raw `recurring_items` rows, `kind='expense'`, `next_due_date` in range).
- `src/features/transactions/schemas.ts` (+ test) — `addTransactionSchema`/`updateTransactionSchema` (zod), mirroring the DB CHECK constraints (positive integer `amount_cents`, transfer ⇔ `counter_account_id` set and ≠ `account_id`, transfer ⇒ `category_id` null).
- `src/features/transactions/balanceDelta.ts` (+ test) — pure `transactionBalanceDeltas`/`applyBalanceDeltas`/`negateDeltas`, mirroring the `account_balances` SQL view's math exactly (never touches `fee_cents`) so optimistic-cache patches can't drift from server truth.
- `src/features/transactions/mutations.ts` (+ test) — `useAddTransaction()`, `useUpdateTransaction()` (`{ id, patch }`), `useDeleteTransaction()` (`id: string`); all optimistic (patch both the transaction list AND `account_balances`) with `onError` rollback via cache snapshots, `onSettled` invalidation. `user_id` is always injected from the session, never trusted from caller input.
- `src/features/transactions/useSafeToSpend.ts` (+ test) — THE money-path seam. Composes `useProfile` + `useTransactions` (bounded to `[periodStart, now]`) + `useUpcomingRecurringBills` (bounded to `[now, periodEnd]`, summed) into `calcSafeToSpend`'s input and returns its result unmodified.
- `src/test/supabaseTestHelpers.ts` — shared, framework-agnostic fake for supabase-js's chainable query builder (`chainable`, `ok`, `fail`, `fakeAuthSession`), used across all the above tests so none touch a live Supabase project/session.

**`npm run check` green** (typecheck + lint + `vitest run`): 21 test files, 161 tests (up from 87 at the end of Phase 1; 55 new tests in this slice). `npm run build` also verified green.

**`useSafeToSpend` mapping (DB rows → `calcSafeToSpend` input) — the part the lead should review closely:**
- `profiles.expected_income_cents` → `expectedIncomeCents` (passed through unmodified — the calc itself does `max(declared, received-so-far)`, never pre-maxed by the hook). `profiles.cycle_anchor_day` → `cycleAnchorDay`. If no `profiles` row exists yet, the hook falls back to `0`/`1` rather than blocking indefinitely (see DECISIONS.md).
- `transactions` fetched bounded to `[periodStart, now]` (computed via `currentPeriod` from the profile's anchor) → mapped 1:1 to `CalcTxn[]` (`kind`/`amount_cents→amountCents`/`occurred_at→occurredAt`), unfiltered by kind — transfer-exclusion is `calcSafeToSpend`'s job, verified by a test transaction with a huge transfer amount that doesn't move the result.
- `recurring_items` fetched bounded to `next_due_date ∈ [today, periodEnd]` (as Nairobi calendar-date strings, `kind='expense'` only), summed client-side → `upcomingFixedBillsCents`. This is deliberately the not-yet-due remainder, not the full period's bills (matches the brief exactly and the existing DECISIONS.md semantics entry — avoids double-counting already-paid bills, which are already ordinary `expense` rows inside the transactions sum above).
- `plannedGoalContributionsCents` hardcoded to `0` (no goal-planning model exists yet) — overridable via `useSafeToSpend({ plannedGoalContributionsCents })` for whenever that model lands.
- Test coverage: a full composition test (income + expense + a huge transfer + one upcoming bill) asserting the hook's `data` deep-equals a direct `calcSafeToSpend(...)` call built from the same raw inputs; a custom-cycle-anchor variant; a negative/`isOver` variant driven by an upcoming bill exceeding the pool; a no-profile-row fallback variant; and a loading-state variant.

**Assumptions recorded in DECISIONS.md (see there for full rationale):** `useSafeToSpend`/`useProfile` placement in `transactions/` rather than a `settings/` feature; `recurring_items` filtered to `kind='expense'` for the bills sum (a recurring income/transfer template isn't a "bill"); missing-profile-row fallback to 0/day-1 rather than blocking; update-schema cross-field invariants only enforced when the patch itself carries the relevant fields together (DB CHECKs are the final guard for partial patches); a Docker-free, vi/supabase-free `chainable()` test fake standing in for the real `PostgrestFilterBuilder`.

**Live E2E note (per brief):** confirmed — there is still no sign-in UI. Every hook here reads `supabase.auth` and stays `enabled: false`/errors cleanly with no session; a minimal/dev auth wiring is needed before these hooks do anything against the live cloud project, exactly as the brief anticipated. All tests here mock `supabase` entirely (`src/test/supabaseTestHelpers.ts`) and need no network/session.

**Not committed** — left for the lead to review the money-path seam and commit, per brief instructions.
