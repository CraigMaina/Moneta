import { create } from 'zustand'

/**
 * Theme preference (dark mode). UI-only state, so Zustand + localStorage is
 * the right home — this is explicitly NOT financial data, so the CLAUDE.md
 * "no localStorage for financial data" rule doesn't apply (theme must persist
 * across reloads and is fine to lose). Three states: an explicit `light`/`dark`
 * override, or `system` which defers to the OS via the CSS media query (see
 * `index.css`). A tiny inline script in `index.html` applies the stored value
 * before first paint to avoid a light-theme flash; this store stays
 * authoritative afterwards.
 */

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'moneta-theme'

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // localStorage unavailable (private mode / SSR) — fall through to default.
  }
  return 'system'
}

function applyToDocument(preference: ThemePreference): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)
}

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: readStored(),
  setPreference: (preference) => {
    applyToDocument(preference)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // Best-effort persistence; the in-memory preference still applies this session.
    }
    set({ preference })
  },
}))

// Keep the DOM in sync with the restored preference on module load.
applyToDocument(useThemeStore.getState().preference)
