import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { accountBalanceKeys, transactionKeys } from '../transactions/queryKeys'
import { addTransactionSchema } from '../transactions/schemas'
import type { StatementCandidate } from './statementParser'

/**
 * Import reviewed statement candidates (PRD F5). Unlike the tap-fast add flow
 * this is NOT optimistic — a statement import is a deliberate bulk action where
 * correctness beats instant feedback (same call as "mark bill paid"): we dedupe
 * against existing `mpesa_ref`s, insert only the new rows in one batch, and
 * invalidate so the server's numbers are the last word. The `mpesa_ref` unique
 * index is the ultimate backstop if two imports race.
 */
export interface ImportStatementInput {
  accountId: string
  candidates: StatementCandidate[]
}

export interface ImportStatementResult {
  inserted: number
  duplicates: number
}

export function useImportStatement() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()

  return useMutation<ImportStatementResult, Error, ImportStatementInput>({
    mutationFn: async ({ accountId, candidates }) => {
      if (!userId) throw new Error('useImportStatement: no authenticated user')
      if (candidates.length === 0) return { inserted: 0, duplicates: 0 }

      const rows = candidates.map((candidate) =>
        addTransactionSchema.parse({
          kind: candidate.kind,
          amount_cents: candidate.amountCents,
          account_id: accountId,
          merchant: candidate.merchant,
          note: candidate.note,
          mpesa_ref: candidate.mpesaRef,
          occurred_at: candidate.occurredAt,
          source: 'statement_import',
        }),
      )

      const refs = rows.map((row) => row.mpesa_ref).filter((ref): ref is string => Boolean(ref))
      let existingRefs = new Set<string>()
      if (refs.length > 0) {
        const { data: existing, error: readError } = await supabase
          .from('transactions')
          .select('mpesa_ref')
          .eq('user_id', userId)
          .in('mpesa_ref', refs)
        if (readError) throw readError
        existingRefs = new Set((existing ?? []).map((row) => row.mpesa_ref).filter((ref): ref is string => Boolean(ref)))
      }

      const newRows = rows.filter((row) => !row.mpesa_ref || !existingRefs.has(row.mpesa_ref))
      const duplicates = rows.length - newRows.length

      if (newRows.length > 0) {
        const { error } = await supabase.from('transactions').insert(newRows.map((row) => ({ ...row, user_id: userId })))
        if (error) throw error
      }

      return { inserted: newRows.length, duplicates }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: accountBalanceKeys.all(userId) })
    },
  })
}
