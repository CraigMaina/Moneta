import { z } from 'zod'

/**
 * Boundary validation for category & account writes (CLAUDE.md: "zod at every
 * boundary"). Mirrors the DB constraints in `create_categories.sql` /
 * `create_accounts.sql`:
 *   - `name` is a non-empty trimmed string, unique per user (the DB's
 *     `unique (user_id, name)` is the ultimate backstop; we surface a friendly
 *     message before it ever gets there).
 *   - `kind` / `type` are the same enums the DB enforces.
 *   - `icon` holds a single emoji (user-picked) — optional; the display layer
 *     falls back to a name-based glyph when absent.
 * `user_id` is injected by the mutation hook from the session, never by input.
 */

const trimmedName = z.string().trim().min(1, 'Give it a name').max(40, 'Keep the name short')
// A user-picked emoji. We don't hard-validate "is exactly one emoji" (grapheme
// counting is fiddly across platforms); we just cap length so a pasted string
// can't bloat the row. The cap is 24 UTF-16 units, not a small number, because
// a single ZWJ emoji (e.g. a 4-member family, with skin tones) can be ~11–25
// code units — the picker already narrows free input to the first grapheme, so
// this only guards against paste bloat. `null` clears it to the default glyph.
const emojiIcon = z.string().trim().min(1).max(24).nullable().optional()

export const categoryKindSchema = z.enum(['income', 'expense'])
export const accountTypeSchema = z.enum(['mpesa', 'cash', 'bank', 'other'])

export const createCategorySchema = z.object({
  name: trimmedName,
  kind: categoryKindSchema,
  icon: emojiIcon,
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = z
  .object({
    name: trimmedName.optional(),
    icon: emojiIcon,
  })
  .refine((v) => v.name !== undefined || v.icon !== undefined, 'Nothing to update')
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

export const createAccountSchema = z.object({
  name: trimmedName,
  type: accountTypeSchema,
  icon: emojiIcon,
})
export type CreateAccountInput = z.infer<typeof createAccountSchema>

export const updateAccountSchema = z
  .object({
    name: trimmedName.optional(),
    type: accountTypeSchema.optional(),
    icon: emojiIcon,
  })
  .refine((v) => v.name !== undefined || v.type !== undefined || v.icon !== undefined, 'Nothing to update')
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
