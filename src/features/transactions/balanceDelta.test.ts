import { describe, expect, it } from 'vitest'
import { applyBalanceDeltas, negateDeltas, transactionBalanceDeltas } from './balanceDelta'
import type { AccountBalance, Transaction } from './types'

type MinimalTxn = Pick<Transaction, 'kind' | 'amount_cents' | 'account_id' | 'counter_account_id'>

const mpesaId = 'mpesa-account'
const cashId = 'cash-account'
const bankId = 'bank-account'

function balance(account_id: string | null, balance_cents: number | null): AccountBalance {
  return { account_id, balance_cents, account_name: 'Test', user_id: 'user-1' }
}

describe('transactionBalanceDeltas', () => {
  it('income raises the account balance', () => {
    const txn: MinimalTxn = { kind: 'income', amount_cents: 5000, account_id: mpesaId, counter_account_id: null }
    expect(transactionBalanceDeltas(txn)).toEqual([{ account_id: mpesaId, delta_cents: 5000 }])
  })

  it('expense lowers the account balance', () => {
    const txn: MinimalTxn = { kind: 'expense', amount_cents: 1200, account_id: mpesaId, counter_account_id: null }
    expect(transactionBalanceDeltas(txn)).toEqual([{ account_id: mpesaId, delta_cents: -1200 }])
  })

  it('transfer moves the amount from account_id to counter_account_id — never a net change', () => {
    const txn: MinimalTxn = { kind: 'transfer', amount_cents: 3000, account_id: mpesaId, counter_account_id: cashId }
    const deltas = transactionBalanceDeltas(txn)
    expect(deltas).toEqual([
      { account_id: mpesaId, delta_cents: -3000 },
      { account_id: cashId, delta_cents: 3000 },
    ])
    // The defining transfer guarantee: the sum of deltas is always zero.
    expect(deltas.reduce((sum, d) => sum + d.delta_cents, 0)).toBe(0)
  })

  it('a malformed transfer with no counter_account_id still debits account_id only (defensive)', () => {
    const txn: MinimalTxn = { kind: 'transfer', amount_cents: 3000, account_id: mpesaId, counter_account_id: null }
    expect(transactionBalanceDeltas(txn)).toEqual([{ account_id: mpesaId, delta_cents: -3000 }])
  })
})

describe('applyBalanceDeltas', () => {
  it('applies a single delta to the matching account', () => {
    const balances = [balance(mpesaId, 10000), balance(cashId, 2000)]
    const result = applyBalanceDeltas(balances, [{ account_id: mpesaId, delta_cents: -1500 }])
    expect(result.find((b) => b.account_id === mpesaId)?.balance_cents).toBe(8500)
    expect(result.find((b) => b.account_id === cashId)?.balance_cents).toBe(2000)
  })

  it('applies a transfer pair across two accounts in one call', () => {
    const balances = [balance(mpesaId, 10000), balance(cashId, 2000)]
    const result = applyBalanceDeltas(balances, [
      { account_id: mpesaId, delta_cents: -3000 },
      { account_id: cashId, delta_cents: 3000 },
    ])
    expect(result.find((b) => b.account_id === mpesaId)?.balance_cents).toBe(7000)
    expect(result.find((b) => b.account_id === cashId)?.balance_cents).toBe(5000)
  })

  it('leaves an account not present in the snapshot untouched (no crash, no phantom row)', () => {
    const balances = [balance(mpesaId, 10000)]
    const result = applyBalanceDeltas(balances, [{ account_id: bankId, delta_cents: 500 }])
    expect(result).toEqual(balances)
  })

  it('treats a null balance_cents as 0 before applying a delta', () => {
    const balances = [balance(mpesaId, null)]
    const result = applyBalanceDeltas(balances, [{ account_id: mpesaId, delta_cents: 1000 }])
    expect(result.find((b) => b.account_id === mpesaId)?.balance_cents).toBe(1000)
  })

  it('is a no-op for an empty delta list (returns the same reference)', () => {
    const balances = [balance(mpesaId, 10000)]
    expect(applyBalanceDeltas(balances, [])).toBe(balances)
  })

  it('sums multiple deltas targeting the same account', () => {
    const balances = [balance(mpesaId, 10000)]
    const result = applyBalanceDeltas(balances, [
      { account_id: mpesaId, delta_cents: -1000 },
      { account_id: mpesaId, delta_cents: -500 },
    ])
    expect(result.find((b) => b.account_id === mpesaId)?.balance_cents).toBe(8500)
  })
})

describe('negateDeltas', () => {
  it('flips the sign of every delta without mutating the input', () => {
    const deltas = [
      { account_id: mpesaId, delta_cents: -3000 },
      { account_id: cashId, delta_cents: 3000 },
    ]
    const negated = negateDeltas(deltas)
    expect(negated).toEqual([
      { account_id: mpesaId, delta_cents: 3000 },
      { account_id: cashId, delta_cents: -3000 },
    ])
    expect(deltas[0]?.delta_cents).toBe(-3000) // original untouched
  })

  it('reversing a transaction is idempotent: apply then apply-the-negation restores the original', () => {
    const balances = [balance(mpesaId, 10000), balance(cashId, 2000)]
    const txn: MinimalTxn = { kind: 'transfer', amount_cents: 4000, account_id: mpesaId, counter_account_id: cashId }
    const deltas = transactionBalanceDeltas(txn)
    const applied = applyBalanceDeltas(balances, deltas)
    const restored = applyBalanceDeltas(applied, negateDeltas(deltas))
    expect(restored).toEqual(balances)
  })
})
