import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { type MerchantRule } from '../../parser'
import { useAuthUserId } from './hooks/useAuthUserId'
import { merchantRuleKeys } from './queryKeys'

/**
 * Merchant→category memory (PRD §4.3): once the user corrects the category
 * for a parsed merchant (NAIVAS → Food & Groceries), remember it and
 * auto-apply to every future parse of that merchant.
 *
 * The pure matching/normalization lives in `src/parser/merchant.ts`
 * (`normalizeMerchant`, `resolveMerchantCategory`); this file is only the
 * Supabase I/O. `merchant_rules` stores a `category_id`, but the parser's
 * override contract (and `parsedToTransactions`) speaks category *names*, so
 * the read here joins `category_id → categories.name` and returns the parser's
 * `MerchantRule` ({ merchantNormalized, categoryName }) shape directly.
 */

type MerchantRuleRow = {
  merchant_normalized: string
  // supabase-js embeds a to-one FK as an object (older detections use an array) — handle both.
  categories: { name: string } | { name: string }[] | null
}

function toMerchantRule(row: MerchantRuleRow): MerchantRule | null {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories
  if (!category?.name) return null
  return { merchantNormalized: row.merchant_normalized, categoryName: category.name }
}

/** All of the user's merchant→category rules, in the parser's `MerchantRule` shape. */
export function useMerchantRules() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: merchantRuleKeys.all(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MerchantRule[]> => {
      const { data, error } = await supabase.from('merchant_rules').select('merchant_normalized, categories(name)')
      if (error) throw error
      return (data ?? []).map((row) => toMerchantRule(row as MerchantRuleRow)).filter((r): r is MerchantRule => r !== null)
    },
  })
}

export interface SetMerchantRuleInput {
  /** Already normalized via `normalizeMerchant` by the caller. */
  merchantNormalized: string
  categoryId: string
}

/**
 * Remember (or update) the category the user chose for a merchant. Upserts on
 * the `(user_id, merchant_normalized)` unique constraint so re-correcting the
 * same merchant overwrites rather than duplicates. `user_id` is injected from
 * the session, never trusted from the caller.
 */
export function useSetMerchantRule() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()

  return useMutation<void, Error, SetMerchantRuleInput>({
    mutationFn: async ({ merchantNormalized, categoryId }) => {
      if (!userId) throw new Error('useSetMerchantRule: no authenticated user')
      const { error } = await supabase.from('merchant_rules').upsert(
        { user_id: userId, merchant_normalized: merchantNormalized, category_id: categoryId },
        { onConflict: 'user_id,merchant_normalized' },
      )
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: merchantRuleKeys.all(userId) })
    },
  })
}
