import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

/**
 * jsdom ships no `window.matchMedia`. Framer Motion's `useReducedMotion` reads
 * it (and caches the result at module scope on first call), so without a
 * stable default, animated components behave inconsistently depending on which
 * test happened to touch `matchMedia` first in a worker — a real cross-file
 * flake source. Install a deterministic default (nothing matches, i.e.
 * reduced-motion OFF) before every test. Tests that specifically assert the
 * reduced-motion path override this before their first render.
 */
function installDefaultMatchMedia(): void {
  if (typeof window === 'undefined') return
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

installDefaultMatchMedia()
beforeEach(installDefaultMatchMedia)
