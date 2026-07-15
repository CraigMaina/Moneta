/**
 * Query key factories, one per resource. Every key is namespaced by userId so
 * a sign-out/sign-in (or two users on one device — a shared PWA install)
 * never leaks cached rows across accounts. `transactionKeys.all` is a prefix
 * of every `transactionKeys.list(...)` key, so cancelling/invalidating/
 * snapshotting `all` reaches every list variant.
 */

export interface TransactionListFilters {
  from?: string
  to?: string
  limit?: number
}

export const transactionKeys = {
  all: (userId: string | undefined) => ['transactions', userId] as const,
  list: (userId: string | undefined, filters: TransactionListFilters = {}) =>
    [...transactionKeys.all(userId), 'list', filters] as const,
}

export const accountKeys = {
  all: (userId: string | undefined) => ['accounts', userId] as const,
}

export const categoryKeys = {
  all: (userId: string | undefined) => ['categories', userId] as const,
}

export const accountBalanceKeys = {
  all: (userId: string | undefined) => ['accountBalances', userId] as const,
}

export const profileKeys = {
  detail: (userId: string | undefined) => ['profile', userId] as const,
}

export const merchantRuleKeys = {
  all: (userId: string | undefined) => ['merchantRules', userId] as const,
}

export const streakKeys = {
  detail: (userId: string | undefined) => ['streak', userId] as const,
}

export const goalKeys = {
  all: (userId: string | undefined) => ['goals', userId] as const,
}

export const budgetKeys = {
  all: (userId: string | undefined) => ['budgets', userId] as const,
}

export const goalContributionKeys = {
  all: (userId: string | undefined) => ['goalContributions', userId] as const,
}

export const recurringItemKeys = {
  all: (userId: string | undefined) => ['recurringItems', userId] as const,
  upcomingBills: (userId: string | undefined, fromDate: string, toDate: string) =>
    ['recurringItems', userId, 'upcomingBills', fromDate, toDate] as const,
}

/**
 * Stable mutation keys for the write paths we want to survive a reload while
 * offline (PRD F12). A key lets `setMutationDefaults` supply a `mutationFn` when
 * TanStack rehydrates a paused mutation whose original closure is gone — see
 * `features/offline/mutationDefaults.ts`. NOT namespaced by userId: the resumed
 * mutationFn reads the live session itself.
 */
export const mutationKeys = {
  addTransaction: ['addTransaction'] as const,
  saveParsedTransactions: ['saveParsedTransactions'] as const,
}
