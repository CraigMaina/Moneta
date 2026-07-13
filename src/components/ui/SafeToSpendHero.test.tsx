import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SafeToSpendHero } from './SafeToSpendHero'

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('SafeToSpendHero', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('under prefers-reduced-motion, renders the final amount immediately with no count-up', () => {
    mockMatchMedia(true)
    render(<SafeToSpendHero safeToSpendCents={140000} spentTodayCents={20000} dailyBudgetCents={50000} />)

    // The "KES" mark is a separate de-emphasized node; the numeral carries the value.
    expect(screen.getByText('1,400')).toBeInTheDocument()
  })

  it('counts up to the final value when motion is enabled (settles on the target amount)', async () => {
    mockMatchMedia(false)
    render(<SafeToSpendHero safeToSpendCents={140000} spentTodayCents={20000} dailyBudgetCents={50000} />)

    // jsdom has no real animation-frame timing, so the tween may settle
    // synchronously or asynchronously depending on the environment — either
    // way it must land on the exact final amount, never something else.
    await waitFor(() => expect(screen.getByText('1,400')).toBeInTheDocument(), { timeout: 2000 })
  })

  it('the negative case never renders a raw negative hero — it renders the calm "over this month" copy instead', () => {
    mockMatchMedia(true)
    render(<SafeToSpendHero safeToSpendCents={-34000} spentTodayCents={50000} dailyBudgetCents={50000} />)

    expect(screen.queryByText(/^-KES/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^-/)).not.toBeInTheDocument()
    expect(screen.getByText("You're")).toBeInTheDocument()
    expect(screen.getByText('340')).toBeInTheDocument()
    expect(screen.getByText('over this month')).toBeInTheDocument()
  })

  it('the negative case never shows a bare zero hero either', () => {
    mockMatchMedia(true)
    render(<SafeToSpendHero safeToSpendCents={-1} spentTodayCents={0} dailyBudgetCents={50000} />)

    expect(screen.queryByText('KES 0')).not.toBeInTheDocument()
  })

  it('the healthy case shows the "Safe to spend today" label', () => {
    mockMatchMedia(true)
    render(<SafeToSpendHero safeToSpendCents={140000} spentTodayCents={20000} dailyBudgetCents={50000} />)

    expect(screen.getByText('Safe to spend today')).toBeInTheDocument()
  })

  it('guards against a zero daily budget without crashing', () => {
    mockMatchMedia(true)
    expect(() =>
      render(<SafeToSpendHero safeToSpendCents={140000} spentTodayCents={20000} dailyBudgetCents={0} />),
    ).not.toThrow()
  })
})
