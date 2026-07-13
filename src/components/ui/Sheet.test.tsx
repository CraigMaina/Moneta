import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sheet, shouldDismissSheetDrag } from './Sheet'

function Harness({ title = 'Add expense' }: { title?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <p>Sheet body content</p>
        <button>Confirm</button>
      </Sheet>
    </>
  )
}

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

describe('Sheet', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens with focus moved inside, closes on Escape, and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Add expense' })
    expect(dialog).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(dialog.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('closes on backdrop click', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    await screen.findByRole('dialog')

    await user.click(screen.getByTestId('sheet-backdrop'))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open sheet' })).toHaveFocus())
  })

  it('locks and restores body scroll while open', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(document.body.style.overflow).not.toBe('hidden')
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    await screen.findByRole('dialog')
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'))
  })

  it('still opens, closes, and restores focus under prefers-reduced-motion', async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    await user.click(trigger)
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe('shouldDismissSheetDrag', () => {
  it('dismisses past the offset threshold', () => {
    expect(shouldDismissSheetDrag(121, 0)).toBe(true)
    expect(shouldDismissSheetDrag(120, 0)).toBe(false)
  })

  it('dismisses on a fast downward flick even with a small offset', () => {
    expect(shouldDismissSheetDrag(10, 501)).toBe(true)
    expect(shouldDismissSheetDrag(10, 500)).toBe(false)
  })

  it('snaps back for a small, slow drag', () => {
    expect(shouldDismissSheetDrag(30, 40)).toBe(false)
  })
})
