import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * Supabase client singleton. All Supabase access in the app goes through
 * typed query/mutation hooks that import this client — never inline
 * `createClient` calls in components (see CLAUDE.md Code conventions).
 */

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
})

const parsedEnv = envSchema.safeParse(import.meta.env)

if (!parsedEnv.success) {
  const message =
    '[supabase] Missing or invalid environment variables. Copy .env.example to .env and fill in your project values.'
  // A production build must never ship a client pointed at the placeholder
  // host — fail hard. In dev, warn and fall back so first checkout still boots.
  if (import.meta.env.PROD) {
    throw new Error(`${message} ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}`)
  }
  console.error(message, parsedEnv.error.flatten().fieldErrors)
}

// Fall back to a syntactically valid placeholder so `createClient` doesn't
// throw at import time when env vars are absent (e.g. first checkout before
// `.env` is configured); the console.error above is the real signal.
const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = parsedEnv.success
  ? parsedEnv.data
  : { VITE_SUPABASE_URL: 'https://placeholder.supabase.co', VITE_SUPABASE_ANON_KEY: 'placeholder' }

export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
