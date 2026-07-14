import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ParseTransform } from './ParseTransform'

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('ParseTransform', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Framer Motion's `useReducedMotion` lazily initializes a MODULE-LEVEL
  // cache from `window.matchMedia` on its first-ever call in this file, and
  // never re-reads it afterwards (no cross-test reset). This test — the only
  // one in the file that needs `matches: true` — runs FIRST for exactly that
  // reason (same ordering constraint the existing `SafeToSpendHero.test.tsx`
  // relies on). See DECISIONS.md.
  it('prefers-reduced-motion: swaps stages instantly, with no animation gate', () => {
    mockMatchMedia(true)
    const { rerender } = render(
      <ParseTransform rawText="raw text" parsed={false}>
        <p>Confirmation card</p>
      </ParseTransform>,
    )
    expect(screen.getByText(/Reading your message/)).toBeInTheDocument()
    expect(screen.queryByText('Confirmation card')).not.toBeInTheDocument()

    rerender(
      <ParseTransform rawText="raw text" parsed>
        <p>Confirmation card</p>
      </ParseTransform>,
    )
    expect(screen.getByText('Confirmation card')).toBeInTheDocument()
    expect(screen.queryByText(/Reading your message/)).not.toBeInTheDocument()
  })

  it('shows the raw message while not yet parsed', () => {
    mockMatchMedia(false)
    render(
      <ParseTransform rawText="QGH7 Confirmed. You have received Ksh500." parsed={false}>
        <p>Confirmation card</p>
      </ParseTransform>,
    )
    expect(screen.getByText(/You have received Ksh500/)).toBeInTheDocument()
    expect(screen.queryByText('Confirmation card')).not.toBeInTheDocument()
  })

  it('mounts the structured card once parsed is true', () => {
    mockMatchMedia(false)
    render(
      <ParseTransform rawText="QGH7 Confirmed. You have received Ksh500." parsed>
        <p>Confirmation card</p>
      </ParseTransform>,
    )
    expect(screen.getByText('Confirmation card')).toBeInTheDocument()
    expect(screen.queryByText(/Reading your message/)).not.toBeInTheDocument()
  })
})
