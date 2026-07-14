// supabase/functions/parse-sms/index.ts
//
// Deno Edge Function: the LLM fallback for M-PESA SMS messages the
// on-device deterministic parser (src/parser/) couldn't match (PRD §F2
// point 2). Called by the client only on a parser MISS.
//
// Flow: verify the caller's Supabase JWT (never trust a user_id in the
// body) -> call the Anthropic API to extract the same ParsedMpesaMessage
// contract as the deterministic parser (mirrored in ./schema.ts) -> validate
// the model's output strictly with zod, including the cross-field
// invariants -> log the attempt to `parse_misses` (deduped per-user by a
// hash of the raw SMS) -> return either a fully-validated match or a
// manual-entry signal. Never returns unvalidated model output.
//
// Deploy:   supabase functions deploy parse-sms
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request:  POST { text: string }  (Authorization: Bearer <user JWT>)
// Response: 200 { status: 'matched', data: ParsedMpesaMessage }
//        or 200 { status: 'manual', raw: string }
//        or 4xx/5xx { error: { code: string, message: string } }

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { interpretToolUse, type AnthropicToolUse, type ParseSmsOutcome } from './schema.ts'
import { ANTHROPIC_MODEL, ANTHROPIC_TOOLS, SYSTEM_PROMPT } from './prompt.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status)
}

const requestSchema = z.object({
  text: z.string().trim().min(1, 'text is required').max(2000, 'text is too long'),
})

/** Trim + collapse internal whitespace so re-pasted/re-shared copies of the same SMS hash identically. */
function normalizeSmsText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

async function hashSmsText(normalized: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type AnthropicMessageResponse = {
  content?: Array<{ type: string; name?: string; input?: unknown }>
}

/** Calls the Anthropic Messages API and returns the forced tool call (or null if the model unexpectedly returned none). */
async function callAnthropic(apiKey: string, rawSms: string): Promise<AnthropicToolUse | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawSms }],
      tools: ANTHROPIC_TOOLS,
      tool_choice: { type: 'any' },
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API responded ${res.status}`)
  }

  const data = (await res.json()) as AnthropicMessageResponse
  const toolUse = data.content?.find((block) => block.type === 'tool_use')
  if (!toolUse || typeof toolUse.name !== 'string') return null
  return { name: toolUse.name, input: toolUse.input }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.')
  }

  // ---- Auth: derive user_id from the caller's own JWT, never the body. ----
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return errorResponse(401, 'unauthorized', 'Missing Authorization header.')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(500, 'server_error', 'parse-sms is not configured.')
  }

  // A client scoped to the CALLER's own JWT (not the service-role key) so
  // every DB read/write below runs under that user's own RLS policies —
  // this function never needs the service-role key at all.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return errorResponse(401, 'unauthorized', 'Invalid or expired session.')
  }
  const userId = userData.user.id

  // ---- Input validation ----
  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    return errorResponse(400, 'invalid_request', 'Request body must be JSON.')
  }

  const parsedBody = requestSchema.safeParse(bodyJson)
  if (!parsedBody.success) {
    return errorResponse(
      400,
      'invalid_request',
      parsedBody.error.issues[0]?.message ?? 'Invalid request body.',
    )
  }

  const normalized = normalizeSmsText(parsedBody.data.text)
  const rawSmsHash = await hashSmsText(normalized)

  // ---- LLM call + strict validation ----
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return errorResponse(500, 'server_error', 'parse-sms is not configured.')
  }

  let outcome: ParseSmsOutcome
  try {
    const toolUse = await callAnthropic(apiKey, normalized)
    outcome = interpretToolUse(toolUse, normalized)
  } catch (err) {
    // Anthropic call failed (network/rate-limit/malformed response/etc) —
    // fail closed to manual entry, same contract as a validation failure,
    // rather than surface an error the client has no useful way to act on.
    // Never leak the underlying error/stack to the client.
    console.error('parse-sms: Anthropic call failed', err instanceof Error ? err.message : err)
    outcome = { status: 'manual', raw: normalized }
  }

  // ---- Dedupe log: upsert on (user_id, raw_sms_hash) so re-sending the ----
  // ---- same miss never piles up rows. Best-effort: never block the ----
  // ---- user's result on a logging failure. ----
  const { error: upsertError } = await supabase.from('parse_misses').upsert(
    {
      user_id: userId,
      raw_sms: normalized,
      raw_sms_hash: rawSmsHash,
      llm_succeeded: outcome.status === 'matched',
      parser_version: 'llm',
    },
    { onConflict: 'user_id,raw_sms_hash' },
  )
  if (upsertError) {
    console.error('parse-sms: parse_misses upsert failed', upsertError.message)
  }

  if (outcome.status === 'matched') {
    return json({ status: 'matched', data: outcome.data })
  }
  return json({ status: 'manual', raw: outcome.raw })
})
