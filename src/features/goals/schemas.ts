import { z } from 'zod'

/**
 * Boundary validation for goal writes (CLAUDE.md: zod at every boundary).
 * `target_cents` is a positive integer (money is never a float); `emoji` is an
 * optional grapheme; `target_date` is an optional `yyyy-MM-dd` calendar date.
 * `user_id` is injected by the mutation hook, never from input.
 */

const trimmedName = z.string().trim().min(1, 'Give your goal a name').max(60, 'Keep the name short')
const emoji = z.string().trim().min(1).max(24).nullable().optional()
const targetCents = z
  .number()
  .int('target must be a whole number of cents')
  .positive('set a target above zero')
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a yyyy-MM-dd date')
  .nullable()
  .optional()

export const createGoalSchema = z.object({
  name: trimmedName,
  target_cents: targetCents,
  target_date: dateString,
  emoji,
})
export type CreateGoalInput = z.infer<typeof createGoalSchema>

export const updateGoalSchema = z
  .object({
    name: trimmedName.optional(),
    target_cents: targetCents.optional(),
    target_date: dateString,
    emoji,
  })
  .refine(
    (v) => v.name !== undefined || v.target_cents !== undefined || v.target_date !== undefined || v.emoji !== undefined,
    'Nothing to update',
  )
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>

export const contributeSchema = z.object({
  amount_cents: z.number().int('amount must be whole cents').positive('add more than zero'),
})
export type ContributeInput = z.infer<typeof contributeSchema>
