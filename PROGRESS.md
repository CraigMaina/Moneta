# PROGRESS — Moneta

_Read this first at the start of every session. Append at the end of every session: done / in-flight / next._

## Current phase

**Phase 1 — Design system: COMPLETE.** qa APPROVE WITH NITS; the one required nit (Toast keyboard dismiss) fixed + tested, hero KES mark de-emphasized, contrast deviations recorded. Phase 0 — Foundation also complete (RLS 25/25 on cloud, qa APPROVE; only optional physical-device install pending). **Next: Phase 2 — Core money loop.**

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

- **User action:** rotate the Supabase DB password (it entered the transcript during verification) — dashboard → Database → reset password.
- Generate `src/lib/database.types.ts` when convenient (needs Docker or a Supabase access token via `gen types --project-id`) — deferred, feeds Phase 2.
- Decide: kick off **Phase 1 — Design system** (design-engineer: primitive kit + `/kitchen-sink` + safe-to-spend hero; tokens already scaffolded). Can start now.

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
