import type { Database } from '../../lib/database.types'

export type AccountTypeValue = Database['public']['Enums']['account_type']

/** The four account types with human labels, in a sensible display order. */
export const ACCOUNT_TYPES: { value: AccountTypeValue; label: string }[] = [
  { value: 'mpesa', label: 'M-PESA' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
]

export function accountTypeLabel(type: AccountTypeValue): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? 'Other'
}
