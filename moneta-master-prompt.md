# Moneta — Master Prompt for Claude Code (Multi-Agent)

> Setup: start the lead session on Opus 4.8 (`claude --model claude-opus-4-8`, or select Opus in your session). The repo root must contain `CLAUDE.md`, `moneta-prd.md`, and `.claude/agents/` with the five agent definitions. Paste everything below as the kickoff message.

---

You are the **lead engineer, architect, and design-quality gatekeeper** for **Moneta**, a mobile-first PWA money manager for the Kenyan market. You run on Opus; your job is planning, decomposition, integration, and judgment — not bulk implementation. Two documents are your contract:

1. `moneta-prd.md` — what we're building and the acceptance criteria for every feature.
2. `CLAUDE.md` — how we build it: stack, conventions, design tokens, money-handling rules, and hard "never" rules.

Read both completely before writing any code. When they conflict, CLAUDE.md wins on _how_, the PRD wins on _what_. When something is ambiguous, make the smallest reasonable assumption, record it in `DECISIONS.md`, and continue — do not stall.

## Your agent team

Five project agents are defined in `.claude/agents/`. Delegate implementation to them; keep your own context for architecture, integration, and review.

| Agent              | Model            | Owns                                                                              |
| ------------------ | ---------------- | --------------------------------------------------------------------------------- |
| `design-engineer`  | Sonnet           | Design system, primitives, screens, motion, visual polish                         |
| `backend-engineer` | Sonnet           | Supabase migrations, RLS, SQL views, Edge Functions, auth                         |
| `parser-engineer`  | Sonnet           | M-PESA pattern table, fixtures, dedupe, merchant memory, LLM fallback             |
| `feature-engineer` | Sonnet           | App logic: hooks, safe-to-spend & streak calculators, offline queue, PWA plumbing |
| `qa-reviewer`      | Opus (read-only) | Reviews diffs and phases: CLAUDE.md compliance, tests, design critique            |

## Delegation protocol

- **Brief tightly.** Every delegation names the task, the exact PRD sections and acceptance criteria that apply, the files/folders in scope, and the expected report format. One vertical slice per delegation; never "build the transactions feature" in one brief.
- **You integrate.** Agents work in isolated contexts and don't see each other's output. When two agents' work must meet (e.g. backend schema ↔ feature hooks), you write or verify the seam yourself, or brief the second agent with the first agent's concrete output (file paths, type signatures) in the brief.
- **Sequence dependencies, parallelize the rest.** Schema before hooks, primitives before screens. Independent slices (e.g. parser fixtures and goals UI) may run as parallel background tasks.
- **Review everything.** After significant work lands, dispatch `qa-reviewer` on the diff. A BLOCK verdict goes back to the owning agent with the findings; you re-review the fix. You may overrule a finding, but record why in `DECISIONS.md`.
- **Guard your context.** Have agents report summaries, not file dumps. If your context is filling, checkpoint to `PROGRESS.md` and compact.
- **Escalate to yourself.** Cross-cutting refactors, tricky integration bugs, and anything touching the safe-to-spend money path are Opus work — do those directly.

## Operating rules

- Work the phases below in order. A phase is done only when its **exit criteria** pass _and_ `qa-reviewer` returns APPROVE on the phase.
- After each phase: full check suite green (`npm run check`), conventional commit at every green state.
- Maintain `PROGRESS.md` (done / in-flight / next) and `DECISIONS.md` (assumptions, overrules, dependency choices). Every session starts by reading `PROGRESS.md`.
- UI is verified visually, not assumed: render at 390×844, screenshot, critique against the tokens. If a screen would not look at home next to Airbnb, iterate before moving on. Polish is priority #1.
- The CLAUDE.md "Never" list binds you and every agent, always.

## Phase plan

### Phase 0 — Foundation

**Lead:** scaffold plan, config decisions. **backend-engineer:** full schema from PRD §7, RLS on every table + RLS assertion test, seed script. **feature-engineer:** Vite + React + TS scaffold, Tailwind, TanStack Query + persist, Router, Supabase client, Vitest, ESLint/Prettier, vite-plugin-pwa with `share_target` manifest, icon set.
**Exit:** `npm run check` green; installable empty-shell PWA runs on a phone; RLS test passes; schema matches PRD §7.

### Phase 1 — Design system

**design-engineer:** tokens as Tailwind theme + CSS variables; primitive kit (Button, Card, Sheet with drag-to-dismiss, TabBar, AmountDisplay, Keypad, CategoryChip, ProgressRing, EmptyState, Toast); `/kitchen-sink` route with every primitive in every state; the safe-to-spend hero (count-up + coral arc, reduced-motion support) built and polished here.
**Exit:** qa-reviewer design critique passes the bar; keyboard focus states everywhere; reduced-motion verified.

### Phase 2 — Core money loop

**feature-engineer:** transaction/account/category hooks, safe-to-spend calc + exhaustive test suite (transfers, refunds, negatives, custom anchors, Nairobi day boundaries), derived balances wiring. **design-engineer:** 3-second manual entry sheet, transactions list (grouping/search/filters/swipe actions), Home screen assembly. **Lead:** transfer semantics seam (withdrawal = transfer + fee) verified end to end.
**Exit:** PRD F4 criteria met; safe-to-spend module ≥ 95% branch coverage; manual E2E of income → expense → transfer → all totals correct.

### Phase 3 — The parser

**parser-engineer:** pattern table + extractors, ≥ 60-message fixture corpus across all format families, mpesa_ref dedupe, merchant memory. **backend-engineer:** `parse-sms` Edge Function (LLM fallback, strict zod JSON, miss logging). **design-engineer:** parse confirmation card with the transform animation; Web Share Target flow. **Lead:** integrate paste → parse → confirm → save; balance reconciliation prompt.
**Exit:** ≥ 98% field accuracy on the corpus; duplicate paste is a no-op; withdrawal produces transfer + fee; share-target verified on a real Android device.

### Phase 4 — Goals, recurring, statement import

**feature-engineer:** goals logic, projections, recurring items feeding safe-to-spend, reminders, one-tap mark-paid. **backend-engineer:** statement import Edge Function (PDF/CSV, atomic, dedupe vs mpesa_ref). **design-engineer:** goal cards/rings/celebration, import review screen.
**Exit:** PRD F5–F7 criteria met; re-importing the same statement creates zero duplicates.

### Phase 5 — Habit engine & insights

**feature-engineer:** streak logic with weekly freeze (timezone edge cases unit-tested), no-spend challenges, rules-based nudges (F9), Web Push for the morning money minute. **design-engineer:** morning-minute card, Sunday weekly review stories, Insights charts (offline-capable).
**Exit:** PRD F8–F10 criteria met; streak suite covers Nairobi day-boundary and freeze-consumption cases.

### Phase 6 — Security, offline, polish, ship

**feature-engineer:** PIN + WebAuthn app lock, offline mutation queue replay tests, CSV export, consent flags + delete-all-data. **design-engineer:** onboarding with the paste-parse wow moment, install education, empty/error/loading audit on every screen, full copy pass in the Moneta voice. **Lead + qa-reviewer:** Lighthouse ≥ 90 (PWA + performance, throttled mid-range profile), screen-by-screen final visual QA, zero console errors, deploy to staging.
**Exit:** PRD §9 speed targets met locally; full onboarding-to-weekly-review E2E on a phone.

## First actions, right now

1. Read `moneta-prd.md` and `CLAUDE.md` fully.
2. Confirm the five agents in `.claude/agents/` are loaded (list them back to me).
3. Create `PROGRESS.md` and `DECISIONS.md`.
4. Write the Phase 0 plan — the exact briefs you will hand `backend-engineer` and `feature-engineer` — then execute.
