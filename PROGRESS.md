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

## In-flight

- Nothing in-flight; Phase 0 scaffold ready for `backend-engineer`'s schema/RLS work and `qa-reviewer` pass.

## Next

- Delegate Phase 0 schema + RLS + seed to `backend-engineer` (PRD §7) — note: Docker/local Supabase stack was not available in the scaffolding environment, so migrations are untested against a running local Postgres; `backend-engineer` should verify `npx supabase start`/`db push` in an environment with Docker.
- Dispatch `qa-reviewer` once schema lands.
- Fill in `.env` from `.env.example` with real Supabase project values before any Supabase-backed feature work.

## Phase exit checklist (Phase 0)

- [x] `npm run check` green
- [x] Installable empty-shell PWA builds with manifest (incl. `share_target`) + service worker (`npm run build` verified locally; not yet installed on a physical device)
- [ ] RLS assertion test passes (backend-engineer)
- [ ] Schema matches PRD §7 (backend-engineer)
- [ ] qa-reviewer returns APPROVE

## Known incident (see DECISIONS.md for full detail)

- An unscoped `npx prettier --write .` during Phase 0 formatting touched `moneta-prd.md`, `moneta-master-prompt.md`, `.claude/agents/*.md`, and `CLAUDE.md`. `CLAUDE.md` was restored exactly (verified line-for-line against the verbatim copy read earlier in-session). The other four were not byte-verifiable against a pre-edit copy; spot checks show whitespace/emphasis-marker-only changes, no wording changes. `.prettierignore` and the `format` script are now scoped to prevent recurrence. Recommend a human diff/skim of those four files.
