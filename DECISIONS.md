# DECISIONS — Moneta

_Assumptions made under ambiguity, dependency choices (with rationale), and any overruled review findings. Newest first._

## Format

Each entry: date · decision · rationale · scope/impact.

---

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
