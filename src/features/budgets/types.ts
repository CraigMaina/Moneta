import type { Database } from '../../lib/database.types'

/** A per-category monthly spending cap (integer cents). Weekly is a derived view. */
export type Budget = Database['public']['Tables']['budgets']['Row']
