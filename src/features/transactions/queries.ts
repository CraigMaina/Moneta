import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from './hooks/useAuthUserId'
import { toNairobiDateString } from './nairobiDate'
import { accountBalanceKeys, accountKeys, categoryKeys, profileKeys, recurringItemKeys, transactionKeys } from './queryKeys'
import type { Account, AccountBalance, Category, Profile, RecurringItem, Transaction } from './types'

/**
 * Typed query hooks — the only place `src/features/transactions/` talks to
 * Supabase for reads (CLAUDE.md: "all Supabase access through typed
 * query/mutation hooks; no inline client calls in components"). Every hook
 * reads the current session via `useAuthUserId` and stays disabled until a
 * user id is present; RLS scopes every row to `auth.uid()` regardless.
 */

const DEFAULT_STALE_TIME_MS = 60 * 1000
// Accounts/categories/profile change far less often than transactions — a
// longer staleTime avoids refetching them on every screen focus.
const SLOW_MOVING_STALE_TIME_MS = 5 * 60 * 1000

export function useAccounts() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: accountKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: SLOW_MOVING_STALE_TIME_MS,
    queryFn: async (): Promise<Account[]> => {
      // Archived accounts (soft-deleted in Settings) stay out of every picker,
      // filter, and balance list — their past transactions remain intact.
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCategories() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: categoryKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: SLOW_MOVING_STALE_TIME_MS,
    queryFn: async (): Promise<Category[]> => {
      // Archived categories (soft-deleted in Settings) stay out of the pickers
      // and filters; transactions already categorized under them are untouched.
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export interface UseTransactionsOptions {
  /** Inclusive lower bound on `occurred_at`. */
  from?: Date
  /** Inclusive upper bound on `occurred_at`. */
  to?: Date
  /** Cap the number of rows returned (most recent first). */
  limit?: number
}

/**
 * All the user's transactions (income/expense/transfer — unfiltered by kind;
 * transfer-exclusion is the *consumer's* job, e.g. `calcSafeToSpend`, charts,
 * totals — never this hook's), ordered `occurred_at desc` so a UI can group
 * rows by calendar day top-to-bottom without re-sorting.
 */
export function useTransactions(options: UseTransactionsOptions = {}) {
  const userId = useAuthUserId()
  const { from, to, limit } = options
  const fromIso = from?.toISOString()
  const toIso = to?.toISOString()

  return useQuery({
    queryKey: transactionKeys.list(userId, { from: fromIso, to: toIso, limit }),
    enabled: Boolean(userId),
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase.from('transactions').select('*').order('occurred_at', { ascending: false })
      if (fromIso) query = query.gte('occurred_at', fromIso)
      if (toIso) query = query.lte('occurred_at', toIso)
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

/** Derived, never-stored balances (CLAUDE.md) — reads the `account_balances` SQL view. */
export function useAccountBalances() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: accountBalanceKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<AccountBalance[]> => {
      const { data, error } = await supabase.from('account_balances').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * The user's single `profiles` row (`expected_income_cents`,
 * `cycle_anchor_day`, ...). Placed here (not under a `settings/` feature)
 * because `useSafeToSpend` in this same folder is its primary Phase 2
 * consumer — see DECISIONS.md "useSafeToSpend placement". A future settings
 * screen can import it from here too; nothing about it is transactions-
 * specific enough to warrant duplicating the query.
 */
export function useProfile() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: profileKeys.detail(userId),
    enabled: Boolean(userId),
    staleTime: SLOW_MOVING_STALE_TIME_MS,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export interface UseUpcomingRecurringBillsOptions {
  /** Inclusive lower bound (typically "now"). */
  from: Date
  /** Inclusive upper bound (typically the period end). */
  to: Date
}

/**
 * Recurring items still due within `[from, to]` — raw rows only; summing
 * into `upcomingFixedBillsCents` is `useSafeToSpend`'s job, not this hook's.
 * Filtered to `kind: 'expense'` here: a recurring *income* or *transfer*
 * template is not a "bill" and must not reduce safe-to-spend (see
 * DECISIONS.md "upcoming-bills computation").
 */
export function useUpcomingRecurringBills(options: UseUpcomingRecurringBillsOptions) {
  const userId = useAuthUserId()
  const fromDate = toNairobiDateString(options.from)
  const toDate = toNairobiDateString(options.to)

  return useQuery({
    queryKey: recurringItemKeys.upcomingBills(userId, fromDate, toDate),
    enabled: Boolean(userId),
    staleTime: DEFAULT_STALE_TIME_MS,
    queryFn: async (): Promise<RecurringItem[]> => {
      const { data, error } = await supabase
        .from('recurring_items')
        .select('*')
        .eq('kind', 'expense')
        .gte('next_due_date', fromDate)
        .lte('next_due_date', toDate)
      if (error) throw error
      return data ?? []
    },
  })
}
