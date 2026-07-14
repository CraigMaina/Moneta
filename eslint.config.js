import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'supabase/.temp']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // CLAUDE.md: "no `any`; strict TypeScript stays strict."
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.config.{ts,js}', 'src/test/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Deno Edge Functions (supabase/functions/**) run on a different
    // runtime than the Vite/Node app: `Deno`/`Deno.serve`/`Deno.env` are
    // Deno-only globals, and bare-specifier imports (`zod`,
    // `@supabase/supabase-js`) resolve via each function's own `deno.json`
    // import map rather than node_modules. Adding the Deno global set here
    // (on top of the existing browser/node sets, which already cover
    // `fetch`/`crypto`/`console`/etc) keeps `no-undef`-style checks correct
    // for this folder without weakening any other rule.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.denoBuiltin },
    },
  },
])
