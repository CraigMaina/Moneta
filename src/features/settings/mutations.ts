import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuthUserId } from '../transactions/hooks/useAuthUserId'
import { accountKeys, categoryKeys } from '../transactions/queryKeys'
import type { Account, Category } from '../transactions/types'
import {
  createAccountSchema,
  createCategorySchema,
  updateAccountSchema,
  updateCategorySchema,
  type CreateAccountInput,
  type CreateCategoryInput,
  type UpdateAccountInput,
  type UpdateCategoryInput,
} from './schemas'

/**
 * Settings CRUD for categories & accounts (PRD §7). Unlike the money-path
 * transaction mutations these aren't optimistic — they're low-frequency
 * management actions where a plain invalidate-on-success is simpler and the
 * server (RLS + `unique (user_id, name)`) is the authority. "Removing" a
 * category/account is a soft-delete (`archived_at`), never a hard delete: it
 * keeps past transactions and their history intact (accounts are
 * `on delete restrict` at the DB anyway) and just hides the row from pickers.
 */

/** Postgres unique-violation → a friendly, name-collision message. */
export function isDuplicateNameError(error: unknown): boolean {
  return (error as PostgrestError | null)?.code === '23505'
}

const nextSortOrder = (rows: { sort_order?: number | null }[] | undefined): number => {
  const max = (rows ?? []).reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)
  return max + 1
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Category, Error, CreateCategoryInput>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('useCreateCategory: no authenticated user')
      const parsed = createCategorySchema.parse(input)
      const existing = queryClient.getQueryData<Category[]>(categoryKeys.all(userId))
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...parsed, icon: parsed.icon ?? null, user_id: userId, sort_order: nextSortOrder(existing) })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: categoryKeys.all(userId) }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Category, Error, { id: string; patch: UpdateCategoryInput }>({
    mutationFn: async ({ id, patch }) => {
      if (!userId) throw new Error('useUpdateCategory: no authenticated user')
      const parsed = updateCategorySchema.parse(patch)
      const { data, error } = await supabase.from('categories').update(parsed).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: categoryKeys.all(userId) }),
  })
}

export function useArchiveCategory() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      if (!userId) throw new Error('useArchiveCategory: no authenticated user')
      const { error } = await supabase.from('categories').update({ archived_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: categoryKeys.all(userId) }),
  })
}

export function useRestoreCategory() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('categories').update({ archived_at: null }).eq('id', id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: categoryKeys.all(userId) }),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Account, Error, CreateAccountInput>({
    mutationFn: async (input) => {
      if (!userId) throw new Error('useCreateAccount: no authenticated user')
      const parsed = createAccountSchema.parse(input)
      const { data, error } = await supabase
        .from('accounts')
        .insert({ ...parsed, icon: parsed.icon ?? null, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all(userId) }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<Account, Error, { id: string; patch: UpdateAccountInput }>({
    mutationFn: async ({ id, patch }) => {
      if (!userId) throw new Error('useUpdateAccount: no authenticated user')
      const parsed = updateAccountSchema.parse(patch)
      const { data, error } = await supabase.from('accounts').update(parsed).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all(userId) }),
  })
}

export function useArchiveAccount() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      if (!userId) throw new Error('useArchiveAccount: no authenticated user')
      const { error } = await supabase.from('accounts').update({ archived_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all(userId) }),
  })
}

export function useRestoreAccount() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('accounts').update({ archived_at: null }).eq('id', id)
      if (error) throw error
      return { id }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all(userId) }),
  })
}
