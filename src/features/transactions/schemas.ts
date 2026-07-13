import { z } from 'zod'

/**
 * Boundary validation for transaction writes (CLAUDE.md: "zod at every
 * boundary"). Mirrors the DB CHECK constraints in
 * `supabase/migrations/*_create_transactions_table.sql` so a bad write fails
 * client-side before it ever reaches the network:
 *   - `amount_cents` is a positive integer — `z.number().int()` rejects any
 *     float outright (CLAUDE.md: "never floats ... for money").
 *   - `kind = 'transfer'` <=> `counter_account_id` is set and differs from
 *     `account_id`; non-transfers must NOT set `counter_account_id`.
 *   - `kind = 'transfer'` => `category_id` must be null (transfers aren't
 *     categorizable income/expense).
 * `user_id` is deliberately NOT part of this schema — the mutation hooks
 * inject it from the authenticated session, never from caller input.
 */

const uuid = z.string().uuid()

const kindSchema = z.enum(['income', 'expense', 'transfer'])
const sourceSchema = z.enum(['manual', 'sms_parse', 'statement_import'])

const nullableTrimmedString = z.string().trim().min(1).nullable()

const isoDateTimeString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid ISO date/time string')

const addTransactionShape = {
  kind: kindSchema,
  amount_cents: z
    .number()
    .int('amount_cents must be an integer number of cents (no floats, no fractional cents)')
    .positive('amount_cents must be > 0'),
  account_id: uuid,
  counter_account_id: uuid.nullable().optional(),
  category_id: uuid.nullable().optional(),
  merchant: nullableTrimmedString.optional(),
  note: nullableTrimmedString.optional(),
  mpesa_ref: nullableTrimmedString.optional(),
  occurred_at: isoDateTimeString.optional(),
  fee_cents: z.number().int().nonnegative().nullable().optional(),
  source: sourceSchema.optional(),
  parser_version: z.string().nullable().optional(),
  raw_sms: z.string().nullable().optional(),
}

function checkTransferInvariants(
  val: { kind?: string; counter_account_id?: string | null; account_id?: string; category_id?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (val.kind === 'transfer') {
    if (val.counter_account_id === undefined || val.counter_account_id === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'transfers require counter_account_id',
        path: ['counter_account_id'],
      })
    } else if (val.account_id !== undefined && val.counter_account_id === val.account_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'counter_account_id must differ from account_id',
        path: ['counter_account_id'],
      })
    }
    if (val.category_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'transfers must not have a category_id',
        path: ['category_id'],
      })
    }
  } else if (val.kind !== undefined && val.counter_account_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'only transfers may set counter_account_id',
      path: ['counter_account_id'],
    })
  }
}

export const addTransactionSchema = z.object(addTransactionShape).superRefine(checkTransferInvariants)

export type AddTransactionInput = z.infer<typeof addTransactionSchema>

/**
 * Update payload: every field optional (a patch). The transfer invariants
 * above are only fully enforceable when the patch itself touches
 * `kind`/`counter_account_id`/`account_id` together — a patch that changes
 * only e.g. `note` can't be checked against fields it doesn't carry without
 * fetching the current row first. That's an accepted gap (recorded in
 * DECISIONS.md): the DB CHECK constraints remain the final guard for
 * cross-field invariants on partial patches.
 */
export const updateTransactionSchema = z.object(addTransactionShape).partial().superRefine(checkTransferInvariants)

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
