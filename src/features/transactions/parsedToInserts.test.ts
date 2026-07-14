import { describe, expect, it } from 'vitest'
import { CATEGORY_NAMES, parseMpesaMessage, type ParsedMpesaMessage } from '../../parser'
import {
  airtimeFixtures,
  depositFixtures,
  fulizaDrawdownFixtures,
  fulizaRepaymentFixtures,
  mshwariKcbTransferFixtures,
  paybillFixtures,
  receivedFixtures,
  reversalFixtures,
  sentToPersonFixtures,
  withdrawalFixtures,
  type Fixture,
} from '../../parser/__fixtures__'
import { transactionBalanceDeltas } from './balanceDelta'
import { parsedToTransactions, type MapParsedContext } from './parsedToInserts'

const ACCOUNT_IDS = { mpesa: 'acct-mpesa', cash: 'acct-cash', bank: 'acct-bank' }
const categoryIdByName = new Map(CATEGORY_NAMES.map((name) => [name, `cat-${name}`]))
const ctx: MapParsedContext = { userId: 'u1', accountIds: ACCOUNT_IDS, categoryIdByName }

/** Parse a fixture's raw text into a genuine ParsedMpesaMessage (asserting it matched). */
function parsed(fixture: Fixture): ParsedMpesaMessage {
  const result = parseMpesaMessage(fixture.raw)
  if (result.status !== 'matched') throw new Error(`fixture did not match: ${fixture.description}`)
  return result.data
}

// All matched fixtures across the non-reversal families, for the generic invariants.
const insertFamilies: Fixture[] = [
  ...receivedFixtures,
  ...sentToPersonFixtures,
  ...paybillFixtures,
  ...airtimeFixtures,
  ...withdrawalFixtures,
  ...depositFixtures,
  ...fulizaDrawdownFixtures,
  ...fulizaRepaymentFixtures,
  ...mshwariKcbTransferFixtures,
]

describe('parsedToTransactions — generic row-split invariants (every non-reversal family)', () => {
  it.each(insertFamilies.map((f) => [f.description, f] as const))('%s', (_desc, fixture) => {
    const p = parsed(fixture)
    const result = parsedToTransactions(p, ctx)
    if (result.type !== 'inserts') throw new Error('expected inserts')
    const rows = result.rows

    // Exactly one primary row, plus a fee row iff feeCents > 0.
    expect(rows.length).toBe(p.feeCents > 0 ? 2 : 1)

    const primary = rows[0]!
    // Shared provenance on every row.
    for (const row of rows) {
      expect(row.user_id).toBe('u1')
      expect(row.occurred_at).toBe(p.occurredAt)
      expect(row.source).toBe('sms_parse')
      expect(row.parser_version).toBe(p.parserVersion)
      expect(row.raw_sms).toBe(p.rawText)
    }

    // Amounts are always positive integer cents; never a float, never signed.
    expect(Number.isInteger(primary.amount_cents)).toBe(true)
    expect(primary.amount_cents).toBe(p.amountCents)
    expect(primary.amount_cents).toBeGreaterThan(0)
    expect(primary.kind).toBe(p.kind)
    expect(primary.mpesa_ref).toBe(p.mpesaRef)

    if (p.kind === 'transfer') {
      // A transfer is never carried as income/expense and never categorized.
      expect(primary.category_id).toBeNull()
      // account_id = source, counter_account_id = destination (view semantics).
      const mpesaLeg = p.transferDirection === 'mpesa_to_counter' ? 'account_id' : 'counter_account_id'
      const counterLeg = p.transferDirection === 'mpesa_to_counter' ? 'counter_account_id' : 'account_id'
      expect(primary[mpesaLeg]).toBe(ACCOUNT_IDS.mpesa)
      expect(primary[counterLeg]).toBe(ACCOUNT_IDS[p.counterAccountHint as 'cash' | 'bank'])
    } else {
      // income/expense: single M-PESA-side row.
      expect(primary.account_id).toBe(ACCOUNT_IDS.mpesa)
      expect(primary.counter_account_id).toBeNull()
      const expectedCat = p.category ? `cat-${p.category}` : null
      expect(primary.category_id).toBe(expectedCat)
    }

    // The fee, when present, is its own expense row — never merged into the primary amount.
    if (p.feeCents > 0) {
      const fee = rows[1]!
      expect(fee.kind).toBe('expense')
      expect(fee.amount_cents).toBe(p.feeCents)
      expect(fee.account_id).toBe(ACCOUNT_IDS.mpesa)
      expect(fee.counter_account_id).toBeNull()
      expect(fee.category_id).toBe('cat-Fees & Fuliza charges')
      expect(fee.mpesa_ref).toBe(`${p.mpesaRef}-FEE`)
      // fee_cents is provenance on the PARENT only; the fee row's own amount is the fee.
      expect(fee.fee_cents).toBeNull()
      expect(primary.fee_cents).toBe(p.feeCents)
    } else {
      expect(primary.fee_cents).toBeNull()
    }
  })
})

describe('parsedToTransactions — the hard cases', () => {
  it('withdrawal → transfer (M-PESA → Cash) + a separate fee expense, netting correctly', () => {
    // Find a withdrawal fixture that carries a fee (the whole point of the split).
    const withFee = withdrawalFixtures.find((f) => parsed(f).feeCents > 0)
    expect(withFee, 'expected a withdrawal fixture with a fee').toBeDefined()
    const p = parsed(withFee!)
    const result = parsedToTransactions(p, ctx)
    if (result.type !== 'inserts') throw new Error('expected inserts')
    expect(result.rows).toHaveLength(2)

    const [transfer, fee] = result.rows
    // The transfer leg: money leaves M-PESA, lands in Cash.
    expect(transfer!.kind).toBe('transfer')
    expect(transfer!.account_id).toBe(ACCOUNT_IDS.mpesa)
    expect(transfer!.counter_account_id).toBe(ACCOUNT_IDS.cash)
    expect(fee!.kind).toBe('expense')

    // Cross-check against the account_balances view math: M-PESA loses amount+fee,
    // Cash gains amount, so net worth only drops by the fee (a real outflow).
    let mpesa = 0
    let cash = 0
    for (const row of result.rows) {
      const deltas = transactionBalanceDeltas({
        kind: row.kind,
        amount_cents: row.amount_cents,
        account_id: row.account_id,
        counter_account_id: row.counter_account_id ?? null,
      })
      for (const delta of deltas) {
        if (delta.account_id === ACCOUNT_IDS.mpesa) mpesa += delta.delta_cents
        if (delta.account_id === ACCOUNT_IDS.cash) cash += delta.delta_cents
      }
    }
    expect(mpesa).toBe(-(p.amountCents + p.feeCents))
    expect(cash).toBe(p.amountCents)
    expect(mpesa + cash).toBe(-p.feeCents) // only the fee actually leaves your net worth
  })

  it('deposit → one transfer Cash → M-PESA', () => {
    const p = parsed(depositFixtures[0]!)
    const result = parsedToTransactions(p, ctx)
    if (result.type !== 'inserts') throw new Error('expected inserts')
    expect(result.rows).toHaveLength(1)
    const [row] = result.rows
    expect(row!.kind).toBe('transfer')
    expect(row!.account_id).toBe(ACCOUNT_IDS.cash) // source
    expect(row!.counter_account_id).toBe(ACCOUNT_IDS.mpesa) // destination
  })

  it('fuliza drawdown flows INTO M-PESA (counter → M-PESA), never booked as income', () => {
    const p = parsed(fulizaDrawdownFixtures[0]!)
    const result = parsedToTransactions(p, ctx)
    if (result.type !== 'inserts') throw new Error('expected inserts')
    const [row] = result.rows
    expect(row!.kind).toBe('transfer') // NOT income
    expect(row!.counter_account_id).toBe(ACCOUNT_IDS.mpesa) // money enters M-PESA
    expect(row!.account_id).toBe(ACCOUNT_IDS.bank)
  })

  it('fuliza repayment pays down from M-PESA (M-PESA → counter)', () => {
    const p = parsed(fulizaRepaymentFixtures[0]!)
    const result = parsedToTransactions(p, ctx)
    if (result.type !== 'inserts') throw new Error('expected inserts')
    const [row] = result.rows
    expect(row!.kind).toBe('transfer')
    expect(row!.account_id).toBe(ACCOUNT_IDS.mpesa)
    expect(row!.counter_account_id).toBe(ACCOUNT_IDS.bank)
  })

  it('reversal returns a reversal outcome keyed by the original ref — never an insert', () => {
    const p = parsed(reversalFixtures[0]!)
    const result = parsedToTransactions(p, ctx)
    expect(result.type).toBe('reversal')
    if (result.type !== 'reversal') throw new Error('expected reversal')
    expect(result.reversalOfRef).toBe(p.reversalOfRef)
    expect(result.reversalOfRef).toBeTruthy()
  })

  it('a PayBill account reference lands in the note', () => {
    const withAcc = paybillFixtures.find((f) => parsed(f).accountReference !== null)
    expect(withAcc, 'expected a paybill fixture with an account reference').toBeDefined()
    const p = parsed(withAcc!)
    const result = parsedToTransactions(p, ctx)
    if (result.type !== 'inserts') throw new Error('expected inserts')
    expect(result.rows[0]!.note).toBe(`Acc: ${p.accountReference}`)
  })

  it('merchant-memory override wins over the parser’s suggested category', () => {
    // An expense fixture; force an override to a different valid expense category.
    const p = parsed(sentToPersonFixtures[0]!)
    const overridden = parsedToTransactions(p, { ...ctx, merchantCategoryOverride: 'Family & Black Tax' })
    if (overridden.type !== 'inserts') throw new Error('expected inserts')
    expect(overridden.rows[0]!.category_id).toBe('cat-Family & Black Tax')
  })

  it('an unknown category name resolves to null rather than a bogus id', () => {
    const p = parsed(receivedFixtures[0]!)
    const result = parsedToTransactions(p, { ...ctx, categoryIdByName: new Map() })
    if (result.type !== 'inserts') throw new Error('expected inserts')
    expect(result.rows[0]!.category_id).toBeNull()
  })
})
