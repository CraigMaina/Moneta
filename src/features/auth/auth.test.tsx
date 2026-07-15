import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/ui/Toast'

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

import { SignIn } from './SignIn'
import { SessionGate } from './SessionGate'
import { UpdatePassword } from './UpdatePassword'

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
  it('signs an existing user in with email and password', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
    renderSignIn()

    const submit = screen.getByRole('button', { name: 'Sign in' })
    expect(submit).toBeDisabled() // no email/password yet

    await user.type(screen.getByLabelText('Email'), 'wanjiru@example.com')
    await user.type(screen.getByLabelText('Password'), 'sup3rsecret')
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'wanjiru@example.com',
      password: 'sup3rsecret',
    })
  })

  it('creates an account with signUp in create-account mode', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signUp.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
    renderSignIn()

    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    await user.type(screen.getByLabelText('Email'), 'kev@example.com')
    await user.type(screen.getByLabelText('Password'), 'longenoughpw')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'kev@example.com',
      password: 'longenoughpw',
    })
  })

  it('requires at least 8 characters to create an account', async () => {
    const user = userEvent.setup()
    renderSignIn()

    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.type(screen.getByLabelText('Password'), 'short')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('shows a clear message on invalid sign-in credentials', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    })
    renderSignIn()

    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument()
  })

  it('sends a reset email from the forgot-password flow', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    renderSignIn()

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Email'), 'wanjiru@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'wanjiru@example.com',
      expect.objectContaining({ redirectTo: expect.any(String) }),
    )
    // Back to the sign-in view after the email is sent.
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('UpdatePassword', () => {
  it('sets the new password via updateUser and calls onDone', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null })
    const onDone = vi.fn()
    render(
      <ToastProvider>
        <UpdatePassword onDone={onDone} />
      </ToastProvider>,
    )

    const submit = screen.getByRole('button', { name: 'Update password' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('New password'), 'brandnewpw')
    await user.click(submit)

    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'brandnewpw' })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
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
