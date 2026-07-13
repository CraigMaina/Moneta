import type { Database } from '../../lib/database.types'

/**
 * Row/Insert/Update aliases derived from the generated `Database` type — per
 * CLAUDE.md, hooks must derive from `database.types.ts`, never hand-write
 * row shapes.
 */
export type Account = Database['public']['Tables']['accounts']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type RecurringItem = Database['public']['Tables']['recurring_items']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']
export type AccountBalance = Database['public']['Views']['account_balances']['Row']

export type TransactionKind = Database['public']['Enums']['transaction_kind']
export type TransactionSource = Database['public']['Enums']['transaction_source']
