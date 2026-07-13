import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui/Toast'

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
  },
}))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { SignIn } from './SignIn'
import { SessionGate } from './SessionGate'

function renderSignIn() {
  return render(
    <ToastProvider>
      <SignIn />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('SignIn', () => {
  it('sends an OTP for a valid email, then reveals the code step', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null })
    renderSignIn()

    const sendButton = screen.getByRole('button', { name: 'Email me a link' })
    expect(sendButton).toBeDisabled() // no email yet

    await user.type(screen.getByLabelText('Email'), 'wanjiru@example.com')
    expect(sendButton).toBeEnabled()
    await user.click(sendButton)

    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'wanjiru@example.com',
      options: { shouldCreateUser: true },
    })
    expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument()
  })

  it('verifies the entered code with verifyOtp', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null })
    mockSupabase.auth.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null })
    renderSignIn()

    await user.type(screen.getByLabelText('Email'), 'kev@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me a link' }))

    const codeInput = await screen.findByLabelText('6-digit code')
    await user.type(codeInput, '123456')
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }))

    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'kev@example.com',
      token: '123456',
      type: 'email',
    })
  })

  it('only accepts up to 6 numeric digits in the code field', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null })
    renderSignIn()
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Email me a link' }))

    const codeInput = (await screen.findByLabelText('6-digit code')) as HTMLInputElement
    await user.type(codeInput, '12ab3456789')
    expect(codeInput.value).toBe('123456')
  })
})

describe('SessionGate', () => {
  it('shows a splash while the session resolves, then the app once authenticated', async () => {
    // getSession never settles here → stays in loading until the auth event fires.
    let resolveSession: (value: { data: { session: unknown } }) => void = () => {}
    mockSupabase.auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )

    render(
      <SessionGate>
        <div>Protected app</div>
      </SessionGate>,
    )

    expect(screen.getByRole('heading', { name: 'Moneta' })).toBeInTheDocument()
    expect(screen.queryByText('Protected app')).not.toBeInTheDocument()

    resolveSession({ data: { session: { user: { id: 'u1' } } } })
    await waitFor(() => expect(screen.getByText('Protected app')).toBeInTheDocument())
  })

  it('shows the sign-in screen when there is no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    render(
      <ToastProvider>
        <SessionGate>
          <div>Protected app</div>
        </SessionGate>
      </ToastProvider>,
    )

    await waitFor(() => expect(screen.getByLabelText('Email')).toBeInTheDocument())
    expect(screen.queryByText('Protected app')).not.toBeInTheDocument()
  })
})
