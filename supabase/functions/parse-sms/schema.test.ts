// supabase/functions/parse-sms/schema.test.ts
//
// Unit tests for the parse-sms Edge Function's pure validation/mapping core
// (schema.ts's `interpretToolUse`). No Deno globals, no network, no
// secrets — this is exactly the logic index.ts calls after receiving the
// Anthropic tool-use response, with that response mocked at the `toolUse`
// boundary per the brief.

import { describe, expect, it } from 'vitest'
import {
  EXTRACT_TOOL_NAME,
  interpretToolUse,
  LLM_PARSER_VERSION,
  LLM_PATTERN_ID,
  NOT_MPESA_TOOL_NAME,
} from './schema.ts'

const RAW_SMS =
  'ABC1D2E3F4 Confirmed. You have received Ksh500.00 from JANE DOE 0712345678 on 13/7/26 at 2:15 PM. New M-PESA balance is Ksh1,200.00.'

describe('interpretToolUse', () => {
  it('a valid extraction tool call resolves to matched, with rawText/patternId/parserVersion filled in', () => {
    const outcome = interpretToolUse(
      {
        name: EXTRACT_TOOL_NAME,
        input: {
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
        },
      },
      RAW_SMS,
    )

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
    const outcome = interpretToolUse(
      {
        name: EXTRACT_TOOL_NAME,
        input: {
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
        },
      },
      RAW_SMS,
    )

    expect(outcome.status).toBe('matched')
    if (outcome.status !== 'matched') throw new Error('expected a matched outcome')
    expect(outcome.data.kind).toBe('transfer')
    expect(outcome.data.feeCents).toBe(2900)
    expect(outcome.data.category).toBeNull()
  })

  it('an extraction that violates a cross-field invariant (a transfer carrying a category) is rejected, never returned as a guess', () => {
    const outcome = interpretToolUse(
      {
        name: EXTRACT_TOOL_NAME,
        input: {
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
        },
      },
      RAW_SMS,
    )

    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('a tool call whose input fails basic field validation (negative amount) resolves to manual', () => {
    const outcome = interpretToolUse(
      {
        name: EXTRACT_TOOL_NAME,
        input: {
          amountCents: -100,
          kind: 'expense',
          feeCents: 0,
          merchant: null,
          accountReference: null,
          mpesaRef: 'BAD1',
          occurredAt: '2026-07-13T09:00:00+03:00',
          newBalanceCents: null,
          category: null,
          family: 'sent_to_person',
          counterAccountHint: null,
          transferDirection: null,
          reversalOfRef: null,
        },
      },
      RAW_SMS,
    )

    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('a tool call whose input is missing required fields resolves to manual', () => {
    const outcome = interpretToolUse(
      { name: EXTRACT_TOOL_NAME, input: { amountCents: 100 } },
      RAW_SMS,
    )
    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('the model calling not_mpesa_message (the "parseable: false" sentinel) resolves to manual', () => {
    const otp = 'Your OTP is 482913. Do not share it.'
    const outcome = interpretToolUse({ name: NOT_MPESA_TOOL_NAME, input: {} }, otp)
    expect(outcome).toEqual({ status: 'manual', raw: otp })
  })

  it('no tool call at all (e.g. the Anthropic call failed upstream) resolves to manual', () => {
    const outcome = interpretToolUse(null, RAW_SMS)
    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })

  it('an unrecognized tool name resolves to manual (defensive)', () => {
    const outcome = interpretToolUse({ name: 'something_else', input: {} }, RAW_SMS)
    expect(outcome).toEqual({ status: 'manual', raw: RAW_SMS })
  })
})
