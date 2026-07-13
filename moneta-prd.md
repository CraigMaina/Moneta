# Moneta — Product Requirements Document

**Version:** 1.0 · **Date:** July 2026 · **Owner:** Maina · **Status:** Approved for build

---

## 1. Vision

Moneta is a mobile-first progressive web app that makes money management feel effortless and beautiful for the Kenyan market. Named for the temple of Juno Moneta — where Rome minted its coins and where the word "money" was born — the app turns M-PESA messages into a clear, warm picture of your finances and answers one question every morning: **what can I safely spend today?**

**Positioning:** the most beautiful money app in East Africa, built around the M-PESA message, with habit mechanics that make good money behavior stick.

**Tagline direction:** _"Named for the goddess of warning and remembrance."_ Juno Moneta warned Rome of danger and remembered its debts — exactly what Moneta does for your money.

## 2. Target users

**Primary — "Wanjiru, 27, Nairobi professional."** Salaried or gig income, transacts 5–15 times daily on M-PESA, has tried spreadsheets and abandoned them, saves informally (chama, M-Shwari) but has no visibility into daily spending. Wants to feel in control without accounting homework.

**Secondary — "Kev, 22, student/side-hustler."** Irregular income, heavy Fuliza user, needs the safe-to-spend number and streaks more than budgets.

## 3. Goals and non-goals

### v1 goals

1. Parse any common M-PESA SMS into a categorized transaction in under 5 seconds (paste or share).
2. Show a trustworthy safe-to-spend number on the home screen at all times.
3. Achieve an interface quality bar comparable to Airbnb: warm, confident, delightful.
4. Build daily-return habit loops: streaks, no-spend challenges, weekly review.
5. Work offline for reads and entry, syncing when connectivity returns.

### Non-goals (v1 parking lot)

- Bank API linking (Mono/Stitch) — v2.
- Native Android wrapper with SMS auto-read — v2.
- Shared/couple budgets, chama group features — v2.
- Envelope budgeting — v2 (architecture must not preclude it).
- Debt/lending tracker — v2.
- Monetization/premium tier — post-v1, but do not architect against it.
- AI chat ("ask your money anything") — v2; v1 AI is limited to parser fallback and auto-categorization.
- Multi-currency — v1 is KES only.

## 4. Core concepts and domain model

### 4.1 Accounts

Every transaction belongs to an account. v1 ships with three default accounts created at onboarding: **M-PESA**, **Cash**, **Bank**. Users can rename, add, or archive accounts. Each account has a running balance derived from transactions (never stored as a mutable field; computed via view or maintained by trigger).

### 4.2 Transactions

Three kinds: `income`, `expense`, `transfer`. A transfer moves money between two of the user's accounts and **must never count as income or expense** in any total, chart, or safe-to-spend calculation. An M-PESA agent withdrawal is a transfer from M-PESA to Cash; the withdrawal _fee_ is an expense (category: Fees).

Fields: amount (integer cents), kind, account, counter-account (transfers only), category, merchant/payee, note, occurred_at, source (`manual` | `sms_parse` | `statement_import`), raw_ref (M-PESA code, when parsed), created_at.

### 4.3 Categories

Kenya-tuned default set (user-editable, with icon + color per category):

Income: Salary, Business, Gig/Freelance, Gift/Received, Other income.
Expense: Food & Groceries, Eating Out, Transport (Matatu/Boda/Fuel), Rent & Utilities, Airtime & Data, Shopping, Health, Education, Family & Black Tax, Chama & Savings-out, Entertainment, Subscriptions, Fees & Fuliza charges, Giving/Tithe, Other.

Merchant→category memory: when the user corrects a category for a parsed merchant (e.g. NAIVAS → Food & Groceries), store the mapping and auto-apply it to all future parses of that merchant.

### 4.4 Savings goals

Name, emoji/photo, target amount, target date (optional), linked account (optional), contributions (a contribution is a transaction of kind `transfer` into the goal, or a tracked earmark). Display: progress ring, amount remaining, projected completion date based on trailing contribution rate, and a "one small skip" equivalence line ("skip one lunch out = 2 days closer").

### 4.5 Safe-to-spend (the hero number)

```
safe_to_spend_today =
  ( expected_income_this_period
  − fixed_bills_this_period
  − planned_goal_contributions_this_period
  − variable_spend_so_far_this_period )
  ÷ days_remaining_in_period (inclusive of today)
```

- Period defaults to calendar month; user can set a custom cycle anchor (e.g. salary lands on the 25th).
- `expected_income` = user-declared typical income, replaced by actuals as income transactions land (whichever is greater is used, so a bonus raises the number).
- Fixed bills come from the recurring-transactions list.
- If the number is negative, do not show a red scary zero-state; show "You're KES X over this month" with the single most impactful suggestion.
- The number never lies: transfers, refunds, and reversals must be excluded/handled correctly.

## 5. Features and acceptance criteria

### F1 — Onboarding (90 seconds to value)

Flow: welcome → sign in → three inputs (typical monthly income, fixed monthly bills as quick-add rows, one savings goal) → "paste your last M-PESA message" moment → home screen with a live safe-to-spend number.

Acceptance:

- A new user reaches a populated home screen in ≤ 90 seconds and ≤ 8 taps plus typing.
- The paste-parse wow moment animates the raw SMS transforming into a transaction card.
- Every step is skippable; skipped inputs produce sensible defaults and a home-screen prompt to complete them.

### F2 — M-PESA paste-to-parse

User pastes an M-PESA SMS into the Add sheet (or shares it via the OS share sheet — see F3). The parser extracts amount, direction, counterparty, M-PESA ref code, timestamp, fees, and balance, proposes a category, and shows an editable confirmation card. One tap saves.

Parsing strategy:

1. **Deterministic pattern table** (runs on-device, works offline) covering the known format families: money received; sent to person; PayBill payment (with account number); Buy Goods/Till payment; Pochi la Biashara; agent withdrawal; agent deposit; airtime purchase; Fuliza drawdown and repayment; M-Shwari/KCB M-PESA transfers; reversal messages.
2. **LLM fallback** (Supabase Edge Function → Anthropic API) for messages that match no pattern, returning strict JSON. Fallback results are flagged `parser_version: 'llm'` and the raw message is stored (hashed dedupe) so new deterministic patterns can be authored from real misses.
3. **Dedupe:** the M-PESA ref code is unique per transaction; re-pasting the same message must never create a duplicate.
4. Balance cross-check: when the SMS includes "New M-PESA balance," offer a one-tap "sync account balance" reconciliation if it differs from Moneta's computed balance.

Acceptance:

- ≥ 98% field-level accuracy on the seeded corpus of real message samples (build a fixture corpus of ≥ 60 messages across all families; formats drift, so the pattern table is versioned and data-driven, not hardcoded regex scattered in components).
- Paste → saved transaction in ≤ 5 seconds and ≤ 2 taps for a correctly parsed message.
- Withdrawal messages create a transfer plus a fee expense, not a single expense.
- Offline paste works for pattern-table matches; LLM-fallback messages queue and resolve on reconnect.

### F3 — Web Share Target

The installed PWA registers as an Android share target (`share_target` in the manifest). Sharing an SMS from the Messages app opens Moneta's Add sheet pre-filled with the shared text and runs the parser immediately.

Acceptance: share from Messages → confirmation card visible in ≤ 3 seconds on a mid-range Android device.

### F4 — Manual entry (the 3-second keypad)

Floating center tab opens a full-screen sheet: oversized amount keypad first, then a single horizontal category picker (most-used first), account chip (defaults to last used), optional note. Expense is the default kind; income and transfer are one tap away.

Acceptance: a habitual user logs a cash expense in ≤ 3 seconds / ≤ 4 taps. The keypad is thumb-reachable one-handed on a 6.1" screen.

### F5 — Statement import (backfill)

Upload an M-PESA statement PDF (or bank CSV). Server-side Edge Function parses rows, dedupes against existing ref codes, bulk-categorizes via the merchant-memory table plus heuristics, and presents an import review screen (count by category, uncategorized bucket) before committing.

Acceptance: a 6-month M-PESA statement imports with zero duplicates against previously pasted messages; import is atomic (all-or-nothing per file); uncategorized rows are batch-editable.

### F6 — Recurring transactions & bill reminders

User marks any transaction "repeats" (monthly/weekly/custom). Recurring items feed the fixed-bills term of safe-to-spend and generate reminder nudges 2 days before due. A due bill shows a one-tap "mark paid" that creates the transaction.

### F7 — Savings goals

As specified in 4.4. Contributing is a first-class quick action from the goal card and from the Add sheet.

Acceptance: progress ring animates on contribution; projected date recalculates from a trailing 30-day contribution rate; completed goals get a celebration moment (confetti restraint: once, tasteful, respects reduced-motion).

### F8 — Habit engine

- **Logging streak:** a day counts if the user logs ≥ 1 transaction or opens the app and confirms "no spend today." Streak freeze: one free missed day per week is auto-forgiven (habit research: brittle streaks cause abandonment).
- **No-spend challenges:** user-initiated ("3 no-spend days this week"); a no-spend day is confirmed, not inferred.
- **Morning money minute:** a single daily card — yesterday's total, today's safe-to-spend, one insight line. Deliverable via push notification (Web Push) at a user-chosen time.
- **Sunday weekly review:** swipeable full-screen story cards (Wrapped-style): total in/out, top category, biggest single expense, streak status, goal progress, one suggested tweak for next week.

Acceptance: every habit surface is dismissible and configurable; nothing shames the user (tone rules in the design system apply: warn, remember, never scold).

### F9 — Nudges & insights (rule-based, v1)

Rules engine, not ML: 80%-of-category-pace warning ("It's the 14th and you've used 80% of Eating Out"), unusual-spend flag (single expense > 2.5× category median), Fuliza usage summary ("Fuliza fees cost you KES 340 this month"), subscription detector (same merchant, same amount, ~30-day cadence → suggest marking recurring).

### F10 — Insights screen

Monthly cash-flow bar (in vs out), category donut with drill-down to transaction list, spending trend sparkline (3 months), Fees & Fuliza spotlight. All charts render from local data and work offline.

### F11 — Security & privacy

- App lock: 4-digit PIN required after 2 minutes backgrounded; WebAuthn platform biometrics (fingerprint) as fast unlock where available.
- Supabase Row Level Security on every table: `user_id = auth.uid()`, no exceptions, enforced by migration tests.
- Raw SMS text stored only with user consent toggle (on by default, clearly explained); one-tap "delete all my data" (GDPR/Kenya DPA 2019-aligned; full account deletion including auth record).
- No third-party analytics SDKs in v1; privacy-respecting product analytics (self-hosted or aggregate-only) may be added later.

### F12 — Offline & sync

- TanStack Query with persisted cache (IndexedDB) for reads; an outbound mutation queue for writes created offline, replayed in order on reconnect.
- Conflict policy: last-write-wins per field is acceptable for v1 (single-user data); dedupe by M-PESA ref prevents the dangerous class of conflicts.
- The UI never blocks on network: optimistic updates everywhere, subtle "syncing" indicator, never a spinner wall.

### F13 — Data export

CSV export of transactions (all fields, RFC 4180), triggered from Settings, generated client-side. Trust feature: users must always feel they can leave.

### F14 — PWA installability

Manifest + service worker: installable prompt after the user's 3rd session (not on first visit), custom install education screen, app icon set, splash, standalone display, Africa/Nairobi-correct dates regardless of device drift.

## 6. Screens inventory

Bottom tab bar (5): **Home · Transactions · [+] Add · Goals · Insights**. Settings via avatar on Home.

1. Home — hero safe-to-spend number, streak chip, account balance cards (horizontal scroll), morning-minute card, recent transactions.
2. Transactions — infinite list grouped by day, search, filter chips (account/category/kind), swipe actions (edit/delete/re-categorize).
3. Add sheet — keypad-first manual entry; paste-parse zone; segmented control for expense/income/transfer.
4. Parse confirmation card — extracted fields, editable, category suggestion with confidence styling.
5. Goals — goal cards with rings; goal detail with contribution history and projection.
6. Insights — charts per F10.
7. Weekly review — full-screen swipeable stories.
8. Onboarding — per F1.
9. Settings — profile, accounts, categories, recurring items, notifications, app lock, data export/delete, about.
10. Lock screen — PIN pad / biometric.

## 7. Data model (Postgres / Supabase)

All tables: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users`, `created_at timestamptz default now()`. RLS: `user_id = auth.uid()` for all operations on every table.

- `accounts` — name, type (`mpesa|cash|bank|other`), icon, archived_at.
- `categories` — name, kind (`income|expense`), icon, color, sort_order, archived_at.
- `transactions` — account_id, counter_account_id (nullable, transfers), category_id (nullable for transfers), kind, amount_cents (bigint, always positive; kind carries direction), merchant, note, occurred_at, source, mpesa_ref (unique per user, nullable), fee_cents, raw_sms (nullable), parser_version.
- `merchant_rules` — merchant_normalized, category_id (the learning table).
- `goals` — name, emoji, photo_url, target_cents, target_date, achieved_at.
- `goal_contributions` — goal_id, transaction_id (nullable), amount_cents, occurred_at.
- `recurring_items` — template fields, cadence (rrule string), next_due_date, autopay boolean.
- `profiles` — display_name, cycle_anchor_day, expected_income_cents, notification_prefs jsonb, pin_hash, consent_flags jsonb.
- `streaks` — current_count, longest_count, last_counted_date, freezes_used_this_week.
- `challenges` — type, target, progress, week_start.

Derived balances: a `account_balances` view summing transactions; never trust a stored balance field.

## 8. Design system summary

Full tokens live in CLAUDE.md. Essence: warm coral primary in the Airbnb Rausch family on warm off-white neutrals; one characterful display face with oversized **tabular numerals** for money; card-based layout with soft shadows instead of borders; spring-physics motion (Framer Motion) used sparingly at moments of meaning (number changes, goal progress, parse transformation); teaching empty states; voice that warns and remembers, never scolds.

The **signature element** is the safe-to-spend hero: a huge animated numeral that counts to its value on load and breathes subtly with a coral progress arc showing the day's spend against it. Everything else on Home stays quiet so this one moment carries the brand.

## 9. Success metrics (v1)

- Activation: % of signups reaching a populated home screen (target ≥ 70%).
- Parse quality: field accuracy on live-flagged corrections (target ≥ 98%).
- Habit: D7 retention ≥ 35%; median logging days/week ≥ 4 among retained users.
- Speed: p75 paste→saved ≤ 5s; manual entry ≤ 3s; Lighthouse PWA + performance ≥ 90 on mid-range Android.

## 10. Risks

- **M-PESA format drift** — mitigated by data-driven pattern table + LLM fallback + stored misses.
- **iOS share-target absence** — iOS PWAs can't register as share targets; paste flow is the iOS path. Acceptable: market is Android-dominant.
- **Safe-to-spend trust** — one wrong number destroys credibility; transfers/fees/refunds correctness is the most-tested code in the app.
- **Web Push on iOS** — supported only for installed PWAs on recent iOS; degrade gracefully to in-app cards.
