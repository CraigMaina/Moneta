import { describe, expect, it } from 'vitest'
import { airtimeFixtures, depositFixtures, reversalFixtures, withdrawalFixtures } from '../../parser/__fixtures__'
import type { Fixture } from '../../parser/__fixtures__'
import type { ParsedMpesaMessage } from '../../parser/types'
import {
  amountTone,
  familyTitle,
  resolveDefaultAccounts,
  transferHeadline,
  type AccountOption,
} from './parseConfirmationLogic'

/** Every fixture used here is a MATCHED one — this just narrows `Fixture['expected']` (`ParsedMpesaMessage | 'unmatched'`) for TypeScript, since the fixture arrays are typed `Fixture[]` even though every entry in these specific families is matched. */
function matched(fixture: Fixture): ParsedMpesaMessage {
  if (fixture.expected === 'unmatched') throw new Error(`fixture "${fixture.description}" is unexpectedly unmatched`)
  return fixture.expected
}

const MPESA: AccountOption = { id: 'mpesa-1', name: 'M-PESA', type: 'mpesa' }
const CASH: AccountOption = { id: 'cash-1', name: 'Cash', type: 'cash' }
const BANK: AccountOption = { id: 'bank-1', name: 'Bank', type: 'bank' }

describe('amountTone', () => {
  it('income is leaf-toned', () => {
    expect(amountTone('income')).toBe('income')
  })

  it('expense is ink-toned', () => {
    expect(amountTone('expense')).toBe('expense')
  })

  it('transfer is NEVER the expense tone — it gets its own distinct value', () => {
    expect(amountTone('transfer')).toBe('default')
    expect(amountTone('transfer')).not.toBe('expense')
  })
})

describe('familyTitle', () => {
  it('has a human label for every family', () => {
    expect(familyTitle('withdrawal')).toBe('Agent withdrawal')
    expect(familyTitle('received')).toBe('Money received')
    expect(familyTitle('reversal')).toBe('Reversal')
  })
})

describe('resolveDefaultAccounts', () => {
  it('withdrawal (mpesa_to_counter, hint cash): account_id = M-PESA, counter_account_id = Cash', () => {
    const parsed = matched(withdrawalFixtures[0]!)
    expect(parsed.family).toBe('withdrawal')
    const result = resolveDefaultAccounts(parsed, [MPESA, CASH])
    expect(result).toEqual({ accountId: MPESA.id, counterAccountId: CASH.id })
  })

  it('deposit (counter_to_mpesa, hint cash): account_id = Cash, counter_account_id = M-PESA', () => {
    const parsed = matched(depositFixtures[0]!)
    expect(parsed.family).toBe('deposit')
    const result = resolveDefaultAccounts(parsed, [MPESA, CASH])
    expect(result).toEqual({ accountId: CASH.id, counterAccountId: MPESA.id })
  })

  it('a plain expense (airtime) only ever touches M-PESA — no counter account', () => {
    const parsed = matched(airtimeFixtures[0]!)
    const result = resolveDefaultAccounts(parsed, [MPESA, CASH, BANK])
    expect(result).toEqual({ accountId: MPESA.id, counterAccountId: null })
  })

  it('reversal never resolves a counter account, even though kind is transfer', () => {
    const parsed = matched(reversalFixtures[0]!)
    expect(parsed.kind).toBe('transfer')
    const result = resolveDefaultAccounts(parsed, [MPESA, CASH])
    expect(result).toEqual({ accountId: MPESA.id, counterAccountId: null })
  })

  it('never guesses a counter account that is not in the known accounts list', () => {
    const parsed = matched(withdrawalFixtures[0]!)
    const result = resolveDefaultAccounts(parsed, [MPESA]) // no Cash account known yet
    expect(result).toEqual({ accountId: MPESA.id, counterAccountId: null })
  })
})

describe('transferHeadline', () => {
  it('withdrawal reads "M-PESA -> Cash" using real account names', () => {
    const parsed = matched(withdrawalFixtures[0]!)
    const resolved = resolveDefaultAccounts(parsed, [MPESA, CASH])
    const headline = transferHeadline(parsed, resolved, [MPESA, CASH])
    expect(headline).toEqual({ fromLabel: 'M-PESA', toLabel: 'Cash' })
  })

  it('deposit reads "Cash -> M-PESA"', () => {
    const parsed = matched(depositFixtures[0]!)
    const resolved = resolveDefaultAccounts(parsed, [MPESA, CASH])
    const headline = transferHeadline(parsed, resolved, [MPESA, CASH])
    expect(headline).toEqual({ fromLabel: 'Cash', toLabel: 'M-PESA' })
  })

  it('falls back to a generic (still truthful) type label when the account is not known yet', () => {
    const parsed = matched(withdrawalFixtures[0]!)
    const resolved = resolveDefaultAccounts(parsed, []) // nothing loaded yet
    const headline = transferHeadline(parsed, resolved, [])
    expect(headline).toEqual({ fromLabel: 'M-PESA', toLabel: 'Cash' })
  })

  it('is null for a non-transfer family', () => {
    const parsed = matched(airtimeFixtures[0]!)
    const resolved = resolveDefaultAccounts(parsed, [MPESA])
    expect(transferHeadline(parsed, resolved, [MPESA])).toBeNull()
  })

  it('is null for a reversal (no real second account)', () => {
    const parsed = matched(reversalFixtures[0]!)
    const resolved = resolveDefaultAccounts(parsed, [MPESA])
    expect(transferHeadline(parsed, resolved, [MPESA])).toBeNull()
  })
})
