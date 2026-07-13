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

export const recurringItemKeys = {
  upcomingBills: (userId: string | undefined, fromDate: string, toDate: string) =>
    ['recurringItems', userId, 'upcomingBills', fromDate, toDate] as const,
}
