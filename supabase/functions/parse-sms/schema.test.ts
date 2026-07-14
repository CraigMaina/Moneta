// supabase/functions/parse-sms/schema.test.ts
//
// Unit tests for the parse-sms Edge Function's pure validation/mapping core
// (schema.ts's `interpretModelJson`). No Deno globals, no network, no
// secrets — this is exactly the logic index.ts calls after receiving the
// Gemini structured-JSON response, with that response mocked at the JSON-text
// boundary per the brief.

import { describe, expect, it } from 'vitest'
import { interpretModelJson, LLM_PARSER_VERSION, LLM_PATTERN_ID } from './schema.ts'

const RAW_SMS =
  'ABC1D2E3F4 Confirmed. You have received Ksh500.00 from JANE DOE 0712345678 on 13/7/26 at 2:15 PM. New M-PESA balance is Ksh1,200.00.'

/** Wrap a transaction (or null) in the Gemini envelope and stringify, as the model would return it. */
function envelope(parseable: boolean, transaction: unknown): string {
  return JSON.stringify({ parseable, transaction })
}

const validIncome = {
  amountCents: 50000,
  kind: 'income',
  feeCents: 0,
  merchant: 'JANE DOE',
  accountReference: null,
  mpesaRef: 'ABC1D2E3F4',
  occurredAt: '2026-07-13T14:15:00+03:00',
  newBalanceCents: 120000,
  category: 'Gift/Received',
  family: 'received',
  counterAccountHint: null,
  transferDirection: null,
  reversalOfRef: null,
}

describe('interpretModelJson', () => {
  it('a valid extraction resolves to matched, with rawText/patternId/parserVersion filled in', () => {
    const outcome = interpretModelJson(envelope(true, validIncome), RAW_SMS)

    expect(outcome.status).toBe('matched')
    if (outcome.status !== 'matched') throw new Error('expected a matched outcome')
    expect(outcome.data.amountCents).toBe(50000)
    expect(outcome.data.kind).toBe('income')
    expect(outcome.data.mpesaRef).toBe('ABC1D2E3F4')
    expect(outcome.data.rawText).toBe(RAW_SMS)
    expect(outcome.data.patternId).toBe(LLM_PATTERN_ID)
    expect(outcome.data.parserVersion).toBe(LLM_PARSER_VERSION)
  })

  it('a valid transfer (withdrawal) extraction resolves to matched with a null category', () => {
    const outcome = interpretModelJson(
      envelope(true, {
        amountCents: 500000,
        kind: 'transfer',
        feeCents: 2900,
        merchant: 'Agent Store 001',
        accountReference: null,
        mpesaRef: 'XYZ987WQ12',
        occurredAt: '2026-07-13T09:00:00+03:00',
        newBalanceCents: 5000,
        category: null,
        family: 'withdrawal',
        counterAccountHint: 'cash',
        transferDirection: 'mpesa_to_counter',
        reversalOfRef: null,
      }),
      RAW_SMS,
    )

    expect(outcome.status).toBe('matched')
    if (outcome.status !== 'matched') throw new Error('expected a matched outcome')
    expect(outcome.data.kind).toBe('transfer')
    expect(outcome.data.feeCents).toBe(2900)
    expect(outcome.data.category).toBeNull()
  })

  it('an extraction that violates a cross-field invariant (a transfer carrying a category) is rejected, never a guess', () => {
    const outcome = interpretModelJson(
      envelope(true, {
        amountCents: 100000,
        kind: 'transfer',
        feeCents: 2900,
        merchant: 'Agent 123',
        accountReference: null,
        mpesaRef: 'BADREF001',
        occurredAt: '2026-07-13T09:00:00+03:00',
        newBalanceCents: 5000,
        category: 'Shopping', // invalid: transfers must not have a category
        family: 'withdrawal',
        counterAccountHint: 'cash',
        transferDirection: 'mpesa_to_counter',
        reversalOfRef: null,
      }),
      RAW_SMS,
    )
    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('a transaction that fails basic field validation (negative amount) resolves to manual', () => {
    const outcome = interpretModelJson(envelope(true, { ...validIncome, amountCents: -100 }), RAW_SMS)
    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('a transaction missing required fields resolves to manual', () => {
    const outcome = interpretModelJson(envelope(true, { amountCents: 100 }), RAW_SMS)
    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('parseable:false (the model says it is not an M-PESA message) resolves to manual', () => {
    const otp = 'Your OTP is 482913. Do not share it.'
    expect(interpretModelJson(envelope(false, null), otp)).toEqual({ status: 'manual', raw: otp })
  })

  it('parseable:true but a null transaction resolves to manual (defensive)', () => {
    expect(interpretModelJson(envelope(true, null), RAW_SMS)).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('null json text (e.g. the Gemini call returned no candidate) resolves to manual', () => {
    expect(interpretModelJson(null, RAW_SMS)).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('malformed JSON text resolves to manual, never throws', () => {
    expect(interpretModelJson('{not valid json', RAW_SMS)).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('a JSON payload with the wrong envelope shape resolves to manual', () => {
    expect(interpretModelJson(JSON.stringify({ foo: 'bar' }), RAW_SMS)).toEqual({ status: 'manual', raw: RAW_SMS })
  })
})
