# PROGRESS — Moneta

_Read this first at the start of every session. Append at the end of every session: done / in-flight / next._

## Current phase

**Phase 2 — Core money loop (build complete; awaiting live verification).** DONE: pure `safeToSpend.ts` calc (lead, 19 tests, 96.55% branch — exceeds the ≥95% bar); typed data hooks + `useSafeToSpend` seam (feature-engineer, money-path lead-reviewed); manual-entry sheet + Home assembly + Transactions list (design-engineer); email magic-link/OTP auth + `SessionGate` (lead); transfer-semantics seam verified by integration test (income→expense→withdrawal(transfer+fee): balances + safe-to-spend all correct, incl. an over-budget case); `handle_new_user` signup trigger (backend-engineer) — **pushed to cloud and verified: its pgTAP suite 5/5, RLS suite back to 25/25 against real Postgres**. **qa-reviewer Phase 2 gate: APPROVE WITH NITS, no blocking code findings**; lead fixed the actionable nits (coverage-branch doc correction, Home transfer-row redundant label/missing timestamp, over-budget transfer test). REMAINING (process gates, both need the user's session): live manual E2E of income→expense→transfer through the auth gate; 390×844 visual QA of Home/Add/Transactions/SignIn with real data. Phases 0 + 1 COMPLETE (qa APPROVE each). 201 tests green; ~26 commits.

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

## Phase 2 — `handle_new_user` signup trigger (backend-engineer)

**Scope:** `supabase/migrations/20260714090000_create_handle_new_user_trigger.sql` (new), `supabase/tests/database/new_user.test.sql` (new). No app code touched; `supabase/seed.sql` untouched per brief.

- Adds `public.handle_new_user()` (SECURITY DEFINER, `search_path = ''`, fully schema-qualified) fired by `on_auth_user_created after insert on auth.users`. For every new signup it seeds: a `profiles` row (`cycle_anchor_day=1`, `expected_income_cents=0`, `notification_prefs`/`consent_flags='{}'::jsonb`, `display_name` from `raw_user_meta_data->>'name'` if present), the 3 default accounts (M-PESA/Cash/Bank), and the full 20-row PRD §4.3 category set — verified programmatically byte-for-byte identical to `supabase/seed.sql`'s dev-user seed data. All inserts `on conflict ... do nothing` on the tables' existing unique constraints (`accounts`/`categories`: `(user_id, name)`; `profiles`: `(user_id)`), and every row is hardcoded to `user_id = new.id`.
- pgTAP test `new_user.test.sql` (plan 5, self-rolling-back): inserts a synthetic `auth.users` row and asserts exactly 1 profile, exactly 3 accounts, exactly 20 categories, plus spot-checks for `M-PESA` and `Food & Groceries`.
- `npm run check` reconfirmed green (179 tests, unaffected — this slice is pure SQL). **Not yet run against cloud** (Docker-free environment, per prior entries) — the lead needs to `supabase db push` this migration then run `SUPABASE_DB_URL=… node supabase/tests/run-pgtap.mjs supabase/tests/database/new_user.test.sql`. Full rationale in DECISIONS.md.

## Next

- **User action (security):** rotate the Supabase DB password AND revoke the `sbp_` personal access token (both entered the transcript) — dashboard → Database → reset password; Account → Access Tokens → revoke.
- **Phase 2 in progress:** safe-to-spend calc done (lead, `ce4de1f`). `.env` wired (anon key); `database.types.ts` generated from the live schema, client now `createClient<Database>` (`5aad211`; `npm run gen:types` regenerates). Data hooks + `useSafeToSpend` adapter done (feature-engineer, see below). **design-engineer landed the manual-entry sheet + Home, then the Transactions list screen** (see the two design-engineer sections below) — next: lead visually verifies both at 390×844 (incl. the transfer seam live), then qa gate.
- **Auth gap:** no sign-in UI yet — hooks assume a `supabase.auth` session (tests mock it; the new UI mocks the data-hook modules entirely, per its brief). Lead to wire a minimal/dev auth so the Phase 2 live E2E exit (income→expense→transfer totals) can run, and so the new Home/Add-sheet/Transactions UI has real data to render outside of tests.

## Phase 2 — Transactions list screen (design-engineer)

**Scope:** `src/routes/Transactions.tsx` (rewritten from its Phase 1 stub) + `Transactions.test.tsx`; new feature-local helpers in `src/features/transactions/`: `transactionGroups.ts` (+ test), `rowSwipe.ts` (+ test), `FilterChip.tsx`, `TransactionRow.tsx`, `RecategorizeSheet.tsx`; 3 new icons (`SearchIcon`, `TagIcon`, `TrashIcon`) appended to `src/components/ui/icons.tsx`; `src/components/ui/Toast.tsx` extended with an optional inline `action` (e.g. "Undo") + test. Wired entirely against the existing data-hook layer (`useAccounts`/`useCategories`/`useTransactions`/`useDeleteTransaction`/`useUpdateTransaction`/`useAddTransaction`) — none of those hook files were touched. Not committed, per brief — left for the lead to visually verify at 390×844.

- **Day grouping** (`transactionGroups.ts`, pure + unit-tested): `groupTransactionsByNairobiDay` buckets `useTransactions()`'s already-`occurred_at desc`-ordered rows by their Nairobi calendar day (`toNairobiDateString`, reused from the existing feature-engineer helper) with no re-sort needed; `relativeNairobiDayLabel` renders "Today"/"Yesterday"/a short "EEE d MMM" for anything older, all computed against Africa/Nairobi regardless of device timezone (a dedicated test proves a 22:30-UTC instant lands on the *next* Nairobi day, mirroring the existing `safeToSpend.ts` device-tz test pattern).
- **Search + filter chips**: a client-side merchant/note substring search (case-insensitive, clearable) combines with kind (All/Income/Expense/Transfer), account, and category `FilterChip` rows (a lighter, icon-optional sibling of `CategoryChip` — see DECISIONS.md). The category row hides itself entirely when the kind filter is "Transfer" (transfers have no category) via a derived value, not an effect — same pattern `AddTransactionSheet` already established.
- **Swipe actions** (`TransactionRow.tsx` + `rowSwipe.ts`): swipe left commits delete, swipe right commits recategorize (skipped for transfers) via a Framer Motion `drag="x"` gesture mirroring `Sheet.tsx`'s own drag-to-dismiss pattern exactly — a pure, exported, unit-tested threshold decision (`resolveRowSwipeAction`) rather than asserting on a simulated pointer gesture (jsdom has no real drag geometry; this is the same testing idiom `Sheet.test.tsx` already uses for `shouldDismissSheetDrag`). Every row also renders an always-visible "···" actions button (opens a small `Sheet` with Delete/Recategorize buttons) regardless of `prefers-reduced-motion` — this is simultaneously the gesture-free a11y/keyboard fallback *and* the row's primary discoverable affordance; when motion is reduced, `drag` is simply omitted and the button is the sole (fully sufficient) path.
- **Delete + Undo**: `useDeleteTransaction` fires immediately on commit; the toast shown carries a new `action: { label: 'Undo', onClick }` (a small, deliberate extension to the `Toast` primitive — see DECISIONS.md) that re-inserts the deleted row's own fields via `useAddTransaction` (a fresh id, since the DB has no soft-delete — an honest "undo" is a re-add, not a true restore), `safeParse`-guarded the same way `AddTransactionSheet` guards its own submit.
- **Recategorize**: `RecategorizeSheet.tsx` reuses the existing `CategoryChip`/`Sheet` primitives directly (no new picker UI) and calls `useUpdateTransaction({ id, patch: { category_id } })`.
- **Transfers render neutrally** (no +/− sign, `tone="default"`, i.e. the same ink-900 as an ordinary expense — CLAUDE.md gives coral no "danger"/tint meaning and transfers are never income or expense) — verified by a dedicated test asserting no leading sign and no `leaf-600` (income tint) class on the row's amount node.
- **States**: pulsing skeleton rows while loading; a calm "Couldn't load your transactions." + Retry on error; a teaching `EmptyState` ("No transactions yet" + "Add a transaction", opening the same `AddTransactionSheet` this screen now also mounts, wired to the shared `useUiStore` `activeSheet`) when there are no transactions at all; a *distinct* "No matches" + "Clear filters" empty variant when filters/search exclude everything (not conflated with the true-empty state). Account/category filter chip rows get their own inline skeleton/retry, non-blocking to the main list.
- **`TabBar` is now mounted on this screen too** (previously only `Home` did) — Transactions is a first-class, fully functional tab now, not a stub, so the thumb-zone Add FAB and tab navigation are reachable from here directly.
- Testing Library coverage (mocking the query/mutation hook modules): day-grouping renders the correct relative Nairobi headers including a device-tz-independent case (a 22:30-UTC-the-previous-day transaction correctly lands under "Today"); search combined with a kind filter chip narrows the list; deleting via the row's actions menu (the reduced-motion-safe equivalent of a committed swipe-left — jsdom can't simulate real drag pixels, so this is the actually-testable path, with the swipe-commit threshold itself covered separately and directly in `rowSwipe.test.ts`) calls `useDeleteTransaction` with the row's id and shows an "Undo" toast; a transfer row renders with no sign and no income tint; loading/error/true-empty/no-matches states all render distinctly, including the empty-state's Add button opening the sheet and the no-matches state's Clear-filters button restoring the list.
- **`npm run check` green**: 28 test files (up from 27), **200 tests** (up from ~192 before this slice — 8 new `Transactions.test.tsx` tests, ~14 new pure-logic tests across `transactionGroups.test.ts`/`rowSwipe.test.ts`, +1 `Toast.test.tsx` action test), typecheck and lint clean. `npm run build` also verified green (PWA manifest/SW still emit cleanly; the same pre-existing >500kB chunk-size warning, unrelated to this slice).

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

## Phase 2 — money-path seam committed + reactivity fix (lead)

- Reviewed the `useSafeToSpend` seam and committed the Phase 2 data-layer slice.
- **Fixed a user-reported bug:** the safe-to-spend hero didn't recompute after logging a transaction (balances updated, but the number needed a page refresh). Root cause: the hook froze `now` at mount, so a just-logged row (occurred_at after mount) was excluded twice — by `calcSafeToSpend`'s future-row filter and by the period query's `to: now` upper bound on refetch. Fix: fetch `to: periodEnd` and evaluate spend at an `evaluationNow` that refreshes on `transactionsQuery.dataUpdatedAt`. Commit `56a6690`.
- **Verified live** in the browser (logged-in session): logging a KES 666 expense moved the hero (2,797.38 → 5,538.16) and posted the expense row + M-PESA −666 with no refresh. `npm run check` green (201 tests / 28 files).
- Remaining Phase 2 gates: broader live manual E2E + 390×844 visual QA of populated screens (deferred; not blocking Phase 3 parser work, which is pure logic).

## Phase 3 — M-PESA parser core (parser-engineer)

**Scope:** `src/parser/` only — deterministic, offline, pure pattern-table parser. No DB/components/Edge Functions/`src/features/` touched (one 1-line `tsconfig.app.json` flag addition, see DECISIONS.md).

**Files added:**
- `src/parser/types.ts` — `parsedMpesaMessageSchema` (zod) + `ParsedMpesaMessage` type, the contract two other agents (backend Edge Function LLM fallback, design confirmation card) build against. Includes a large doc comment specifying exactly how the integrator turns one parsed message into 1–2 transaction rows for every family (the withdrawal/deposit/Fuliza/reversal hard cases).
- `src/parser/money.ts` (+ test) — `parseMoneyToCents`: integer-cents-only money parsing ("Ksh1,450.50"/"KES 1,450"/"1,234" → cents), never float math.
- `src/parser/timestamp.ts` (+ test) — `parseMpesaTimestamp`: M-PESA "D/M/YY at H:MM AM/PM" → correct Africa/Nairobi ISO instant via `TZDate`, rejecting calendrically-impossible dates.
- `src/parser/merchant.ts` (+ test) — `normalizeMerchant` (canonical merchant-memory key) + `resolveMerchantCategory` (pure rule matcher; no Supabase).
- `src/parser/patterns.json` — versioned (`"pattern-2026.07"`), 15 ordered regex entries covering all 12 PRD §F2 families (reversal/Fuliza/M-Shwari-KCB/withdrawal/deposit ordered before the generic paybill/buy-goods/pochi/sent-to-person/received patterns they'd otherwise be shadowed by).
- `src/parser/patternTable.ts` (+ test) — loads + zod-validates `patterns.json` at import time, compiles each entry to a `RegExp`.
- `src/parser/index.ts` (+ test) — `parseMpesaMessage(text): ParseResult`, tries each pattern in order, validates the assembled candidate through the schema, never guesses (schema failure → `unmatched`, same as no match).
- `src/parser/semantics.test.ts` — dedicated tests for the money-critical semantics: withdrawal = transfer + separate fee (never a single expense), deposit = transfer with no fee, Fuliza drawdown is never `income`, reversal carries `reversalOfRef` and is never booked as plain income/expense, and dedupe idempotency (re-parsing the same SMS is deterministic/no-op-safe).
- `src/parser/__fixtures__/` — 68 fixtures (61 matched across all 12 families + 7 deliberate `unmatched` edge cases: empty string, OTP message, statement-ready notice, impossible calendar date, truncated SMS, noise, balance-inquiry response), each pairing a raw SMS with its fully-expected parse result.
- `src/parser/corpus.test.ts` — field-level accuracy gate; scores every one of 15 fields + match-status per fixture (not pass/fail per message) and prints the exact percentage.

**Result: 100.00% field accuracy (983/983 fields) across the 68-fixture corpus** — well above the 98% PRD §F2 target. `npm run test:parser` (7 files, 47 tests) and `npm run check` (35 files, 248 tests total) both green.

**Families covered (all 12 from PRD §F2):** received, sent_to_person, paybill, buy_goods, pochi_la_biashara, withdrawal, deposit, airtime, fuliza_drawdown, fuliza_repayment, mshwari_kcb_transfer (in+out, and KCB variant), reversal.

**Integration contract for the next agent who wires this to the DB (`src/features/transactions/` or similar):**
- 1 row for: `received`, `sent_to_person`, `paybill`, `buy_goods`, `pochi_la_biashara`, `airtime` (plus a 2nd fee-expense row if `feeCents > 0`).
- 1 transfer row for: `deposit`, `fuliza_drawdown`, `fuliza_repayment`, `mshwari_kcb_transfer` (direction from `transferDirection`; account type from `counterAccountHint`).
- 2 rows for `withdrawal` (and `fuliza_drawdown` when it carries an access fee): a transfer row (`amountCents`) + a "Fees & Fuliza charges" expense row (`feeCents`) — use `` `${mpesaRef}-FEE` `` as the fee row's own `mpesa_ref` so both rows dedupe independently against the DB's per-user-unique index.
- `reversal`: look up the existing transaction by `mpesa_ref === reversalOfRef` and negate it (delete, or an offsetting entry) — never insert the reversal itself as a new income/expense row. Full detail in the `types.ts` doc comment (family-by-family, ~80 lines).

**Assumptions recorded in DECISIONS.md:** `resolveJsonModule` tsconfig addition; `merchant` field is display-clean, not normalized (call `normalizeMerchant` separately for `merchant_rules` lookups); Fuliza/M-Shwari-KCB bucketed under `counterAccountHint: 'bank'` (v1 has no dedicated loan/savings account type); reversal's `kind: 'transfer'` is a safety marker only, exempted from the hint/direction invariant; withdrawal/Fuliza fee rows need a distinct `mpesa_ref` suffix convention; Pochi la Biashara vs. plain send-to-person is a real, only-partially-solvable ambiguity on the paying customer's own SMS (documented fallback: unmarked Pochi payments parse as `sent_to_person`, still a correct expense, just uncategorized).

**Message shapes NOT handled deterministically (LLM-fallback / stored-miss candidates):**
1. Pochi la Biashara payments that don't carry an explicit "POCHI LA BIASHARA"-style marker in the recipient name (falls through to `sent_to_person`, which is safe but not precisely tagged).
2. Any format drift Safaricom introduces beyond the shapes modeled here (e.g. different sentence ordering, added promotional text mid-message, non-Kenyan-format dates) — by design, these fail closed to `unmatched` rather than guessing, per CLAUDE.md/PRD's "never a guess" rule; that's exactly the traffic the LLM fallback + stored-raw-message-for-pattern-authoring pipeline (owned by the backend/Edge Function agent) is meant to catch.
3. Multi-instrument messages that bundle a payment AND a Fuliza drawdown notice into a single SMS (some real Safaricom formats do this) — this parser treats Fuliza drawdown as its own distinct message shape; a combined message would currently go `unmatched` rather than being decomposed into two events.

**Not committed** — left for the lead to review the money-path/contract pieces and commit, per brief instructions.

## Phase 3 — `parse-sms` Edge Function + `parse_misses` miss-log (backend-engineer)

**Scope:** `supabase/` only (migration + Edge Function + pgTAP), plus one `eslint.config.js` override block. Did not touch `src/parser/` or `src/features/`, per brief.

**Files added:**
- `supabase/migrations/20260714100000_create_parse_misses.sql` — the miss-logging table: `id`, `user_id` (FK → `auth.users`, cascade), `raw_sms`, `raw_sms_hash`, `llm_succeeded` (default `false`), `parser_version`, `resolved` (default `false`), `created_at`. RLS enabled with the standard 4 `user_id = auth.uid()` policies + grants (same pattern as every other table). Partial unique index `(user_id, raw_sms_hash)` — the dedupe backbone, mirroring `transactions.mpesa_ref`.
- `supabase/tests/database/parse_misses.test.sql` (new, 7 pgTAP assertions) + `supabase/tests/database/rls.test.sql` (extended: `plan(25)` → `plan(26)`, added `has_table` for `parse_misses`).
- `supabase/functions/parse-sms/deno.json` — per-function import map (`zod`, `@supabase/supabase-js` → their `npm:` specifiers), the modern Supabase convention; lets `schema.ts`/`prompt.ts` use plain bare-specifier imports resolvable by both Deno and Vitest/Node.
- `supabase/functions/parse-sms/schema.ts` — the `ParsedMpesaMessage` contract hand-mirrored from `src/parser/types.ts` (field-for-field, including the `superRefine` cross-field invariants), plus `interpretToolUse(toolUse, rawSms)` — the pure, unit-tested core that turns an Anthropic tool call into either `{status:'matched', data}` or `{status:'manual', raw}`. Explicit "MUST stay in sync with src/parser/types.ts" header comment.
- `supabase/functions/parse-sms/prompt.ts` — the system prompt (money rules, category/family enums, Africa/Nairobi `+03:00` timestamp instruction, "never guess") and the two forced Anthropic tools (`extract_mpesa_transaction` / `not_mpesa_message`).
- `supabase/functions/parse-sms/index.ts` — the Deno HTTP handler: verifies the caller's JWT (via an anon-key client with the caller's own `Authorization` header forwarded + `auth.getUser()` — never the service-role key), zod-validates `{text: string}`, calls the Anthropic Messages API with forced tool-use, runs the result through `interpretToolUse`, upserts `parse_misses` (deduped on `user_id,raw_sms_hash`), and returns `{status:'matched', data}` / `{status:'manual', raw}` / a typed `{error:{code,message}}` envelope. CORS + OPTIONS handled.
- `supabase/functions/parse-sms/schema.test.ts` — 8 Vitest tests against `interpretToolUse` (valid extraction → matched; valid transfer → matched with null category; cross-field-invariant violation → manual; basic field-validation failure → manual; missing-required-fields tool input → manual; `not_mpesa_message` sentinel → manual; no tool call at all → manual; unrecognized tool name → manual). No network/secrets/Deno globals — runs under plain `npm run test`.

**Request/response contract:**
- `POST` (Authorization: `Bearer <user JWT>`) `{ text: string }` (1–2000 chars)
- `200 { status: 'matched', data: ParsedMpesaMessage }` — `data.parserVersion === 'llm'`, `data.patternId === 'llm-fallback'`, every other field identical in shape to `src/parser/types.ts`'s `ParsedMpesaMessage` (verified directly against the lead's `parsedToInserts.ts`, which consumes exactly this shape).
- `200 { status: 'manual', raw: string }` — parseable:false / any validation failure / any Anthropic-call failure. Client should prefill manual entry with `raw`.
- `401 unauthorized` (missing/invalid JWT) · `400 invalid_request` (bad body) · `405 method_not_allowed` · `500 server_error` (missing `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`ANTHROPIC_API_KEY` secrets) — all `{ error: { code, message } }`, never a stack trace or the API key.

**Model:** `claude-haiku-4-5-20251001` (bounded fallback-only traffic; brief's own recommendation).

**Deploy + secrets (for the lead/user to run — this environment has no Supabase login/Docker):**
```bash
supabase functions deploy parse-sms
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
(`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-provided to every Edge Function by the platform — no manual secret needed for those; this function never uses the service-role key at all.)

**DB verification (for the lead — no `SUPABASE_DB_URL` available in this environment):**
```bash
supabase db push
SUPABASE_DB_URL=… node supabase/tests/run-pgtap.mjs supabase/tests/database/rls.test.sql
SUPABASE_DB_URL=… node supabase/tests/run-pgtap.mjs supabase/tests/database/parse_misses.test.sql
```

**Test evidence:** `npm run lint` clean project-wide. `npx vitest run supabase/functions/parse-sms/schema.test.ts` → **8/8 green**. Full `npm run test` → 39/40 files, 336/337 tests green — the 1 failing file (`src/features/parser/ParseConfirmationCard.test.tsx`) and the `npm run typecheck` errors (`src/features/parser/parseConfirmationLogic.test.ts`) are both untracked, in-progress files from a concurrent agent's session, not touched or introduced by this slice (confirmed via `git status` — `??`, and by running this slice's own test file in isolation). `npm run test:rls` was **not** runnable here (no `SUPABASE_DB_URL`) — confirmed it fails cleanly with its documented message rather than crashing; needs the lead to run against cloud per the commands above.

**Assumptions recorded in DECISIONS.md:** the (functionally-no-op-today) partial-vs-plain unique index choice on `raw_sms_hash`; `resolved` has no automatic-flip mechanism yet; no service-role key used anywhere in this function; forced-tool-use over free-text-JSON-parsing for the Anthropic call; an Anthropic infra failure folds into the same `manual` 200 response as a validation failure (never a 5xx the client can't act on); the `deno.json` import-map trick that makes `schema.ts`/`prompt.ts` importable unmodified by both Deno and Vitest; the new `eslint.config.js` Deno-globals override; `rls.test.sql`'s extension.

**Not committed** — left for the lead to review and commit, per brief instructions.

## Phase 3 — M-PESA parser (paste → parse → confirm → save)

**Committed (all green, `npm run check` = 45 files / 357 tests, verified deterministic across 3 full runs):**
- `1671a34` parser core — 12 format families, data-driven `patterns.json`, pure offline extractors (float-free money, Nairobi-zone timestamps, merchant normalizer), 68-fixture corpus @ 100% field accuracy, fails closed to `unmatched`.
- `0500332` `parsedToTransactions` mapper — 1-or-2 rows per message (withdrawal → transfer + fee, deposit, Fuliza directions, reversal), 54 tests incl. a balance-delta cross-check.
- `2e5e4ba` `useSaveParsedTransactions` — batch save with `mpesa_ref` dedupe; full re-paste is a no-op (`duplicated: true`).
- `7aeca08` `parse-sms` Edge Function (LLM fallback) + `parse_misses` table — JWT-derived user via anon-key client (no service-role key), fails closed to `manual`, deduped miss log; RLS + pgTAP.
- `943a968` design UI — `ParseConfirmationCard`, `ParseTransform` (wow-moment animation + reduced-motion path), `PasteToParse`.
- `915325e` `useParseMessage` (deterministic → Edge fallback) + merchant-memory hooks; **fixed a cross-file `matchMedia`/reduced-motion test flake** via a stable default in `src/test/setup.ts`.
- `5bd232b` `PasteToParseFlow` + `buildParsedRows` wired into the Add sheet behind a "Type it / Paste M-PESA" toggle; merchant memory seeds + records category corrections; re-paste toasts "Already logged".

**Deferred (surfaced, not faked — remaining Phase 3 work):**
- Reversal auto-matching mutation (currently the card confirm toasts + closes for `family === 'reversal'`).
- Balance-reconciliation `onSyncBalance` (the `newBalanceCents` affordance exists in the card; the sync mutation isn't wired).
- Web Share Target service-worker POST→GET redirect so a shared SMS opens the Add sheet in paste mode with `initialSharedText` (the sheet prop + auto-parse are ready; the SW `fetch` handler is not).
- Edge Function deploy + secret: `supabase functions deploy parse-sms`; `supabase secrets set ANTHROPIC_API_KEY=...`. `parse_misses` migration + `npm run test:rls` need running against the cloud DB.

**Verification status:**
- Live wow-moment walkthrough (paste → transform → confirm → save at 390×844) NOT yet done — browser automation hit repeated input-dispatch timeouts this session (app renders clean, zero console errors; not an app defect). Needs a manual pass.
- qa-reviewer Phase 3 gate: PENDING (run after the deferred items land, or scope the gate to what's committed).
