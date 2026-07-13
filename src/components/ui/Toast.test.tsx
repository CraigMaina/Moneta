import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Trigger({ durationMs }: { durationMs: number }) {
  const { showToast } = useToast()
  return (
    <button
      onClick={() =>
        showToast({ title: 'Marked paid', description: 'Rent for July', variant: 'success', durationMs })
      }
    >
      Show toast
    </button>
  )
}

describe('Toast', () => {
  it('appears on showToast and auto-dismisses after its duration', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger durationMs={50} />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show toast' }))
    expect(await screen.findByText('Marked paid')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Marked paid')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('pauses the auto-dismiss timer on hover and resumes on leave', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger durationMs={150} />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show toast' }))
    const toast = await screen.findByText('Marked paid')

    fireHover(toast)
    // Wait past the original duration — the paused toast must still be present.
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(screen.getByText('Marked paid')).toBeInTheDocument()

    fireLeave(toast)
    await waitFor(() => expect(screen.queryByText('Marked paid')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('dismisses immediately on click/tap', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger durationMs={5000} />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show toast' }))
    const toast = await screen.findByText('Marked paid')

    await user.click(toast)
    await waitFor(() => expect(screen.queryByText('Marked paid')).not.toBeInTheDocument())
  })

  it('throws a clear error when used outside a provider', () => {
    // Swallow the expected React error-boundary console noise for this one assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bare() {
      useToast()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useToast must be used within a ToastProvider')
    spy.mockRestore()
  })
})

// React's onPointerEnter/onPointerLeave are synthesized from the bubbling
// 'pointerover'/'pointerout' events, not the (non-bubbling) 'pointerenter'/
// 'pointerleave' events — fire the ones React actually listens for.
function fireHover(element: Element) {
  fireEvent.pointerOver(element)
}

function fireLeave(element: Element) {
  fireEvent.pointerOut(element)
}
