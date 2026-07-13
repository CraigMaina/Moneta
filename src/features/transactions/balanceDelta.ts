import type { AccountBalance, Transaction } from './types'

export interface BalanceDelta {
  account_id: string
  delta_cents: number
}

/**
 * Pure function: the per-account balance deltas a transaction causes.
 * Mirrors the `account_balances` SQL view exactly (see DECISIONS.md
 * "Fee-modeling decision") so optimistic-cache math never drifts from what
 * the server will actually compute:
 *   - income: `+amount_cents` on `account_id`.
 *   - expense: `-amount_cents` on `account_id`.
 *   - transfer: `-amount_cents` on `account_id`, `+amount_cents` on
 *     `counter_account_id` — never counted as income/expense anywhere.
 *   - `fee_cents` is NEVER applied here — it's provenance only, not
 *     authoritative money movement (a fee is its own separate `expense` row).
 */
export function transactionBalanceDeltas(
  txn: Pick<Transaction, 'kind' | 'amount_cents' | 'account_id' | 'counter_account_id'>,
): BalanceDelta[] {
  switch (txn.kind) {
    case 'income':
      return [{ account_id: txn.account_id, delta_cents: txn.amount_cents }]
    case 'expense':
      return [{ account_id: txn.account_id, delta_cents: -txn.amount_cents }]
    case 'transfer': {
      const deltas: BalanceDelta[] = [{ account_id: txn.account_id, delta_cents: -txn.amount_cents }]
      if (txn.counter_account_id) {
        deltas.push({ account_id: txn.counter_account_id, delta_cents: txn.amount_cents })
      }
      return deltas
    }
    default:
      return []
  }
}

/**
 * Apply balance deltas to a cached `account_balances` snapshot. Accounts not
 * present in the snapshot are left untouched (an `onSettled` invalidation
 * corrects the cache from the server either way — the view stays the single
 * source of truth; this only keeps the optimistic UI honest in the interim).
 */
export function applyBalanceDeltas(balances: AccountBalance[], deltas: BalanceDelta[]): AccountBalance[] {
  if (deltas.length === 0) return balances

  const deltaByAccount = new Map<string, number>()
  for (const { account_id, delta_cents } of deltas) {
    deltaByAccount.set(account_id, (deltaByAccount.get(account_id) ?? 0) + delta_cents)
  }

  return balances.map((balance) => {
    if (!balance.account_id) return balance
    const delta = deltaByAccount.get(balance.account_id)
    if (delta === undefined) return balance
    return { ...balance, balance_cents: (balance.balance_cents ?? 0) + delta }
  })
}

/** Reverse a set of deltas — used to undo a transaction's effect on update/delete. */
export function negateDeltas(deltas: BalanceDelta[]): BalanceDelta[] {
  return deltas.map((delta) => ({ ...delta, delta_cents: -delta.delta_cents }))
}
