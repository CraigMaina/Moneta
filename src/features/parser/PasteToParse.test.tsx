import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PasteToParse } from './PasteToParse'

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('PasteToParse', () => {
  beforeEach(() => {
    mockMatchMedia()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the warm empty prompt and disables "Read message" until text is entered', () => {
    render(<PasteToParse onParse={vi.fn()} onEnterManually={vi.fn()} />)
    expect(screen.getByText('Paste your M-PESA message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read message' })).toBeDisabled()
  })

  it('calls onParse with the trimmed pasted text', async () => {
    const onParse = vi.fn()
    const user = userEvent.setup()
    render(<PasteToParse onParse={onParse} onEnterManually={vi.fn()} />)

    await user.type(screen.getByLabelText('M-PESA message'), '  QGH7 Confirmed. You have received Ksh500.  ')
    await user.click(screen.getByRole('button', { name: 'Read message' }))

    expect(onParse).toHaveBeenCalledTimes(1)
    expect(onParse).toHaveBeenCalledWith('QGH7 Confirmed. You have received Ksh500.')
  })

  it('pending status disables the trigger and shows a calm "reading" surface, never a spinner wall', () => {
    render(<PasteToParse onParse={vi.fn()} onEnterManually={vi.fn()} status="pending" />)
    expect(screen.getByRole('button', { name: 'Read message' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Reading your message')
  })

  it('an unparseable message shows a calm, non-technical fallback with an "Enter manually" action', async () => {
    const onEnterManually = vi.fn()
    const user = userEvent.setup()
    render(<PasteToParse onParse={vi.fn()} onEnterManually={onEnterManually} status="error" />)

    expect(screen.getByText("We couldn't read that message.")).toBeInTheDocument()
    expect(screen.getByText(/enter it manually/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enter manually' }))
    expect(onEnterManually).toHaveBeenCalledTimes(1)
  })

  it('accepts a custom error message', () => {
    render(<PasteToParse onParse={vi.fn()} onEnterManually={vi.fn()} status="error" errorMessage="That message looks incomplete." />)
    expect(screen.getByText('That message looks incomplete.')).toBeInTheDocument()
  })
})
