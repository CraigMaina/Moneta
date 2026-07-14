import { describe, expect, it } from 'vitest'
import type { ParseConfirmationEdits } from '../parser/ParseConfirmationCard'
import { CATEGORY_NAMES, parseMpesaMessage, type ParsedMpesaMessage } from '../../parser'
import { receivedFixtures, withdrawalFixtures, type Fixture } from '../../parser/__fixtures__'
import { buildParsedRows } from './buildParsedRows'

const MPESA = 'acct-mpesa'
const CASH = 'acct-cash'
const categoryIdByName = new Map(CATEGORY_NAMES.map((name) => [name, `cat-${name}`]))

function parsed(fixture: Fixture): ParsedMpesaMessage {
  const r = parseMpesaMessage(fixture.raw)
  if (r.status !== 'matched') throw new Error('setup: expected a match')
  return r.data
}

/** Edits as the confirmation card would emit them, defaulting to the parsed values. */
function editsFrom(p: ParsedMpesaMessage, overrides: Partial<ParseConfirmationEdits> = {}): ParseConfirmationEdits {
  return {
    amountCents: p.amountCents,
    kind: p.kind,
    merchant: p.merchant,
    note: '',
    category: p.kind === 'transfer' ? null : p.category,
    accountId: MPESA,
    counterAccountId: p.kind === 'transfer' ? CASH : null,
    feeCents: p.feeCents,
    feeAccountId: p.feeCents > 0 ? MPESA : null,
    ...overrides,
  }
}

describe('buildParsedRows', () => {
  it('builds a single income row for received money, with parse provenance', () => {
    const p = parsed(receivedFixtures[0]!)
    const rows = buildParsedRows(p, editsFrom(p), categoryIdByName)
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row).toMatchObject({
      kind: 'income',
      amount_cents: p.amountCents,
      account_id: MPESA,
      counter_account_id: null,
      mpesa_ref: p.mpesaRef,
      source: 'sms_parse',
      parser_version: p.parserVersion,
      raw_sms: p.rawText,
    })
    expect(row!.category_id).toBe(p.category ? `cat-${p.category}` : null)
  })

  it('splits a withdrawal into a transfer + a distinct Fees expense row', () => {
    const withFee = withdrawalFixtures.find((f) => parsed(f).feeCents > 0)!
    const p = parsed(withFee)
    const rows = buildParsedRows(p, editsFrom(p), categoryIdByName)
    expect(rows).toHaveLength(2)

    const [transfer, fee] = rows
    expect(transfer).toMatchObject({ kind: 'transfer', account_id: MPESA, counter_account_id: CASH, mpesa_ref: p.mpesaRef })
    expect(transfer!.category_id).toBeNull()
    expect(transfer!.fee_cents).toBe(p.feeCents) // provenance on the parent

    expect(fee).toMatchObject({
      kind: 'expense',
      amount_cents: p.feeCents,
      account_id: MPESA,
      counter_account_id: null,
      category_id: 'cat-Fees & Fuliza charges',
      mpesa_ref: `${p.mpesaRef}-FEE`,
      fee_cents: null,
    })
  })

  it('honours an edited category and note over the parsed defaults', () => {
    const p = parsed(receivedFixtures[0]!)
    const rows = buildParsedRows(p, editsFrom(p, { category: 'Gift/Received', note: '  from mum  ' }), categoryIdByName)
    expect(rows[0]!.category_id).toBe('cat-Gift/Received')
    expect(rows[0]!.note).toBe('from mum')
  })

  it('throws rather than build a row with no account (guarded by the flow)', () => {
    const p = parsed(receivedFixtures[0]!)
    expect(() => buildParsedRows(p, editsFrom(p, { accountId: null }), categoryIdByName)).toThrow(/no account/)
  })
})
