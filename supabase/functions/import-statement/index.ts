// supabase/functions/import-statement/index.ts
//
// Deno Edge Function: server-side M-PESA statement parsing (PRD §F5). The v1
// client parses on-device (`src/features/import/statementParser.ts`) for an
// offline, zero-round-trip flow; this function is the deploy-ready server path
// for heavier inputs (e.g. large statements, or a future PDF-text extraction
// step) and returns the SAME candidate contract the client reviews. The parsing
// logic is intentionally a mirror of the on-device parser — one format, two
// runtimes — kept in sync via the shared fixture in
// `src/features/import/__fixtures__/`.
//
// Deploy:   supabase functions deploy import-statement
//
// Request:  POST { text: string }   (Authorization: Bearer <user JWT>)
// Response: 200 { candidates: StatementCandidate[], skippedZero, skippedStatus }
//        or 4xx/5xx { error: { code, message } }

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

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
  text: z.string().trim().min(1, 'text is required').max(200_000, 'text is too long'),
})

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000 // Africa/Nairobi is a fixed UTC+3 (no DST)

const LINE_RE =
  /^([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s+(Completed|Failed|Pending|Reversed)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/

function parseAmountToCents(value: string): number {
  const cleaned = value.replace(/,/g, '')
  const [whole = '0', frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(`${frac}00`.slice(0, 2))
}

function toIso(date: string, time: string): string {
  // Interpret the wall-clock as UTC then subtract the fixed Nairobi offset.
  const asUtc = Date.parse(`${date}T${time}.000Z`)
  return new Date(asUtc - NAIROBI_OFFSET_MS).toISOString()
}

function extractMerchant(details: string): string | null {
  let text = details
    .replace(/^Customer Transfer(?: of Funds Charge| to)?\s*/i, '')
    .replace(/^Pay Bill(?: Online)?(?: to| Charge)?\s*/i, '')
    .replace(/^Merchant Payment(?: to| Charge)?\s*/i, '')
    .replace(/^Funds received from\s*/i, '')
    .replace(/^Buy Bundles.*$/i, 'Airtime & bundles')
    .replace(/^Airtime Purchase.*$/i, 'Airtime')
    .replace(/\b(?:254\d{9}|0[17]\d{8})\b\s*-?\s*/g, '')
    .replace(/\s+Acc\.?\s.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  text = text.replace(/^[-–]\s*/, '').trim()
  return text.length > 0 ? text : null
}

interface StatementCandidate {
  mpesaRef: string
  occurredAt: string
  kind: 'income' | 'expense'
  amountCents: number
  merchant: string | null
  note: string
}

function parseStatement(text: string) {
  const candidates: StatementCandidate[] = []
  let skippedZero = 0
  let skippedStatus = 0

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = LINE_RE.exec(line)
    if (!match) continue

    const [, ref, date, time, details, status, paidIn, withdrawn] = match
    if (status !== 'Completed') {
      skippedStatus += 1
      continue
    }

    const paidInCents = parseAmountToCents(paidIn ?? '0')
    const withdrawnCents = parseAmountToCents(withdrawn ?? '0')
    if (paidInCents === 0 && withdrawnCents === 0) {
      skippedZero += 1
      continue
    }

    candidates.push({
      mpesaRef: ref ?? '',
      occurredAt: toIso(date ?? '', time ?? ''),
      kind: paidInCents > 0 ? 'income' : 'expense',
      amountCents: paidInCents > 0 ? paidInCents : withdrawnCents,
      merchant: extractMerchant((details ?? '').trim()),
      note: (details ?? '').trim(),
    })
  }

  return { candidates, skippedZero, skippedStatus }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.')
  }

  // Auth: verify the caller's own JWT; the function never trusts a body user_id
  // and never needs the service-role key.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return errorResponse(401, 'unauthorized', 'Missing Authorization header.')
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(500, 'server_error', 'import-statement is not configured.')
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    return errorResponse(401, 'unauthorized', 'Invalid or expired session.')
  }

  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    return errorResponse(400, 'invalid_request', 'Request body must be JSON.')
  }
  const parsedBody = requestSchema.safeParse(bodyJson)
  if (!parsedBody.success) {
    return errorResponse(400, 'invalid_request', parsedBody.error.issues[0]?.message ?? 'Invalid request body.')
  }

  // Parse only — never writes. The client reviews the candidates and does the
  // deduped import under the user's own RLS, exactly as the on-device path does.
  return json(parseStatement(parsedBody.data.text))
})
