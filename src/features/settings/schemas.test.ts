import { describe, expect, it } from 'vitest'
import { createAccountSchema, createCategorySchema, updateCategorySchema } from './schemas'

describe('settings schemas', () => {
  it('accepts a valid custom category with an emoji', () => {
    const parsed = createCategorySchema.parse({ name: '  Chama  ', kind: 'expense', icon: '🐄' })
    expect(parsed).toEqual({ name: 'Chama', kind: 'expense', icon: '🐄' })
  })

  it('rejects an empty category name', () => {
    expect(createCategorySchema.safeParse({ name: '   ', kind: 'expense' }).success).toBe(false)
  })

  it('rejects an unknown category kind', () => {
    expect(createCategorySchema.safeParse({ name: 'X', kind: 'transfer' }).success).toBe(false)
  })

  it('allows omitting the icon (falls back to a name glyph)', () => {
    expect(createCategorySchema.safeParse({ name: 'School fees', kind: 'expense' }).success).toBe(true)
  })

  it('accepts the four account types and rejects others', () => {
    for (const type of ['mpesa', 'cash', 'bank', 'other'] as const) {
      expect(createAccountSchema.safeParse({ name: 'Wallet', type }).success).toBe(true)
    }
    expect(createAccountSchema.safeParse({ name: 'Wallet', type: 'crypto' }).success).toBe(false)
  })

  it('requires an update to change something', () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(false)
    expect(updateCategorySchema.safeParse({ name: 'Renamed' }).success).toBe(true)
    expect(updateCategorySchema.safeParse({ icon: null }).success).toBe(true)
  })
})
