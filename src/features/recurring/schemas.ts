import { z } from 'zod'

/**
 * Boundary validation for recurring-item writes (CLAUDE.md: zod at every
 * boundary). Mirrors the DB: positive integer `amount_cents`, a known cadence
 * keyword, a `yyyy-MM-dd` next-due date. `user_id` is injected by the hook.
 * `kind` is constrained to income/expense here — a recurring transfer isn't a
 * "bill" and the safe-to-spend bills term only sums expenses anyway.
 */

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a yyyy-MM-dd date')

const recurringShape = {
  kind: z.enum(['income', 'expense']),
  amount_cents: z.number().int('amount must be whole cents').positive('set an amount above zero'),
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  merchant: z.string().trim().min(1).max(80).nullable().optional(),
  note: z.string().trim().min(1).max(200).nullable().optional(),
  cadence: z.enum(['weekly', 'monthly']),
  next_due_date: dateString,
}

export const createRecurringSchema = z.object(recurringShape)
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>

export const updateRecurringSchema = z
  .object({
    kind: recurringShape.kind.optional(),
    amount_cents: recurringShape.amount_cents.optional(),
    account_id: recurringShape.account_id.optional(),
    category_id: recurringShape.category_id,
    merchant: recurringShape.merchant,
    note: recurringShape.note,
    cadence: recurringShape.cadence.optional(),
    next_due_date: dateString.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>
