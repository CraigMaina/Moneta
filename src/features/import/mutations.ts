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

// A full statement can be thousands of rows. PostgREST filters ride in the URL,
// so a single `.in(...)` of every ref would overflow it; and one giant insert
// can time out. Both are chunked.
const CHUNK_SIZE = 200

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
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
      const existingRefs = new Set<string>()
      for (const refChunk of chunk(refs, CHUNK_SIZE)) {
        const { data: existing, error: readError } = await supabase
          .from('transactions')
          .select('mpesa_ref')
          .eq('user_id', userId)
          .in('mpesa_ref', refChunk)
        if (readError) throw readError
        for (const row of existing ?? []) {
          if (row.mpesa_ref) existingRefs.add(row.mpesa_ref)
        }
      }

      const newRows = rows.filter((row) => !row.mpesa_ref || !existingRefs.has(row.mpesa_ref))
      const duplicates = rows.length - newRows.length

      for (const rowChunk of chunk(newRows, CHUNK_SIZE)) {
        const { error } = await supabase.from('transactions').insert(rowChunk.map((row) => ({ ...row, user_id: userId })))
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
