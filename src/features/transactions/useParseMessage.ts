import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { parseMpesaMessage, parsedMpesaMessageSchema, type ParsedMpesaMessage } from '../../parser'

/**
 * Paste → parse orchestration (PRD §F2). Deterministic on-device parser FIRST
 * (offline, instant, free); only on a miss does it call the `parse-sms` Edge
 * Function (LLM fallback). Every non-match — including an offline/unavailable
 * Edge Function or any validation failure — folds to a single `manual` outcome
 * so the caller has one fallback path: prefill manual entry, never a guess
 * (CLAUDE.md parser rules).
 *
 * Note: true offline *queueing* of LLM-fallback messages (resolve on
 * reconnect, PRD §F2) is deferred to the Phase 6 offline mutation queue; today
 * an offline miss falls straight to manual entry.
 */

export type ParseSource = 'deterministic' | 'llm'

export type ParseOutcome =
  | { status: 'matched'; data: ParsedMpesaMessage; source: ParseSource }
  | { status: 'manual'; raw: string }

async function parseViaEdge(text: string): Promise<ParseOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke('parse-sms', { body: { text } })
    if (error) return { status: 'manual', raw: text }
    const body = data as { status?: string; data?: unknown } | null
    if (body?.status === 'matched') {
      // Re-validate at our own boundary (zod at every boundary, CLAUDE.md) —
      // the Edge Function already validates, but we never trust its output blind.
      const validated = parsedMpesaMessageSchema.safeParse(body.data)
      if (validated.success) return { status: 'matched', data: validated.data, source: 'llm' }
    }
    return { status: 'manual', raw: text }
  } catch {
    // Offline / network error / function unavailable — fall back to manual entry.
    return { status: 'manual', raw: text }
  }
}

export function useParseMessage() {
  return useMutation<ParseOutcome, Error, string>({
    mutationFn: async (text): Promise<ParseOutcome> => {
      const trimmed = text.trim()
      const deterministic = parseMpesaMessage(trimmed)
      if (deterministic.status === 'matched') {
        return { status: 'matched', data: deterministic.data, source: 'deterministic' }
      }
      return parseViaEdge(trimmed)
    },
  })
}
