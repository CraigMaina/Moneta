import { create } from 'zustand'

/**
 * UI-only state (Zustand). Never put server/financial data here — that
 * belongs to TanStack Query hooks. This store is a stub for now; it is not
 * yet consumed by any component.
 */

export type SheetId = 'add' | 'transaction-detail' | 'goal-detail' | 'settings' | null

interface UiState {
  activeSheet: SheetId
  isLocked: boolean
  openSheet: (sheet: Exclude<SheetId, null>) => void
  closeSheet: () => void
  setLocked: (locked: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeSheet: null,
  isLocked: false,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  setLocked: (locked) => set({ isLocked: locked }),
}))
