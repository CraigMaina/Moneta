import { create } from 'zustand'

/**
 * Session-scoped dismissal of nudges (PRD F9). Nudges are recomputed from
 * transactions every render, so "dismiss" only needs to suppress a signature
 * for this session — a genuinely still-true nudge simply returns next launch,
 * which is the desired gentle behaviour (Moneta reminds, it doesn't nag).
 *
 * Kept in memory only, NOT localStorage: dismissal keys can embed merchant
 * names/amounts, and CLAUDE.md forbids `localStorage` for financial data.
 * Cross-session persistence (via the IndexedDB persister) is a future refinement
 * recorded in DECISIONS.md.
 */
interface NudgeStore {
  dismissed: Set<string>
  dismiss: (signature: string) => void
  isDismissed: (signature: string) => boolean
}

export const useNudgeStore = create<NudgeStore>((set, get) => ({
  dismissed: new Set<string>(),
  dismiss: (signature) =>
    set((state) => {
      const next = new Set(state.dismissed)
      next.add(signature)
      return { dismissed: next }
    }),
  isDismissed: (signature) => get().dismissed.has(signature),
}))
