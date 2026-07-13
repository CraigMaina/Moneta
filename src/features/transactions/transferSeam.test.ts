import { describe, expect, it } from 'vitest'
import { calcSafeToSpend, type CalcTxn } from '../../lib/safeToSpend'
import { applyBalanceDeltas, transactionBalanceDeltas } from './balanceDelta'
import type { AccountBalance, Transaction } from './types'

/**
 * The transfer-semantics seam (master prompt, Phase 2 exit; PRD §4.2, §10):
 * an M-PESA agent withdrawal is a TRANSFER (M-PESA → Cash) PLUS a separate FEE
 * expense — never a single expense. This integration test drives the real
 * money functions (`transactionBalanceDeltas` mirrors the account_balances
 * view; `calcSafeToSpend` is the hero calc) over that scenario and asserts
 * every total lands correctly and consistently, the way the lead would verify
 * it clicking through the app — but deterministic and CI-guarded.
 */

const MPESA = 'acct-mpesa'
const CASH = 'acct-cash'

function balance(account_id: string): AccountBalance {
  return { user_id: 'u1', account_id, account_name: account_id, balance_cents: 0 }
}

// Fold a set of transactions into derived balances exactly as the SQL view would.
function balancesFrom(txns: Array<Pick<Transaction, 'kind' | 'amount_cents' | 'account_id' | 'counter_account_id'>>) {
  let balances: AccountBalance[] = [balance(MPESA), balance(CASH)]
  for (const txn of txns) {
    balances = applyBalanceDeltas(balances, transactionBalanceDeltas(txn))
  }
  return Object.fromEntries(balances.map((b) => [b.account_id, b.balance_cents]))
}

describe('transfer seam: income → expense → withdrawal(transfer + fee)', () => {
  // Salary in, a lunch out, then a KES 1,000 agent withdrawal with a KES 28 fee.
  const txns = [
    { kind: 'income' as const, amount_cents: 300000, account_id: MPESA, counter_account_id: null },
    { kind: 'expense' as const, amount_cents: 50000, account_id: MPESA, counter_account_id: null },
    // The withdrawal: transfer M-PESA → Cash …
    { kind: 'transfer' as const, amount_cents: 100000, account_id: MPESA, counter_account_id: CASH },
    // … and its fee, a separate expense on M-PESA.
    { kind: 'expense' as const, amount_cents: 2800, account_id: MPESA, counter_account_id: null },
  ]

  it('balances: the transfer moves money between accounts; the fee leaves M-PESA once', () => {
    const b = balancesFrom(txns)
    // M-PESA: +300000 income −50000 lunch −100000 transfer-out −2800 fee = 147200
    expect(b[MPESA]).toBe(147200)
    // Cash: +100000 transfer-in
    expect(b[CASH]).toBe(100000)
    // Nothing created or destroyed by the transfer itself — it nets to zero.
    const totalNet = b[MPESA] + b[CASH]
    expect(totalNet).toBe(300000 - 50000 - 2800) // only real outflows reduce net worth
  })

  it('safe-to-spend counts the lunch and the fee as spend, but NOT the transfer amount', () => {
    const now = new Date('2026-07-13T09:00:00+03:00')
    const occurredAt = new Date('2026-07-05T09:00:00+03:00')
    const calcTxns: CalcTxn[] = txns.map((t) => ({ kind: t.kind, amountCents: t.amount_cents, occurredAt }))

    const result = calcSafeToSpend({
      now,
      expectedIncomeCents: 300000,
      transactions: calcTxns,
    })

    // Variable spend = lunch (50000) + fee (2800). The 100000 transfer is excluded.
    expect(result.variableSpentCents).toBe(52800)
    expect(result.incomeSoFarCents).toBe(300000)
    // Pool = income − spend (no bills/goals here) = 300000 − 52800 = 247200.
    expect(result.poolCents).toBe(247200)
    expect(result.isOver).toBe(false)
  })

  it('re-modelling the withdrawal as a single expense would be WRONG — this is what we must never do', () => {
    // A naive "withdrawal = one expense of the whole amount" would double-hit
    // net worth and wrongly shrink safe-to-spend. Prove the correct model differs.
    const wrongSingleExpense = [
      { kind: 'income' as const, amount_cents: 300000, account_id: MPESA, counter_account_id: null },
      { kind: 'expense' as const, amount_cents: 50000, account_id: MPESA, counter_account_id: null },
      { kind: 'expense' as const, amount_cents: 102800, account_id: MPESA, counter_account_id: null }, // withdrawal+fee as expense
    ]
    const wrong = balancesFrom(wrongSingleExpense)
    const right = balancesFrom(txns)
    // The wrong model loses the 100000 that actually still exists as Cash.
    expect(wrong[MPESA] + wrong[CASH]).toBe(147200) // 100000 vanished from net worth
    expect(right[MPESA] + right[CASH]).toBe(247200) // correct: still have it as Cash
  })
})
