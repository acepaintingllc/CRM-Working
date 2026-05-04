import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../login/page'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    refresh: mocks.routerRefresh,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabaseBrowser: {
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithPassword: mocks.signInWithPassword,
    },
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    cleanup()
    mocks.routerPush.mockReset()
    mocks.routerRefresh.mockReset()
    mocks.signInWithOAuth.mockReset()
    mocks.signInWithPassword.mockReset()
    window.history.replaceState(null, '', '/login?next=%2Fcrm%2Fquotes')
  })

  it('signs in with email/password and routes to the safe next path', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'codex-test@newburghacepainting.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: 'codex-test@newburghacepainting.com',
        password: 'test-password',
      })
    })
    expect(mocks.routerPush).toHaveBeenCalledWith('/crm/quotes')
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1)
  })

  it('keeps Google sign-in available', async () => {
    mocks.signInWithOAuth.mockResolvedValue({})

    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback?next=%2Fcrm%2Fquotes',
        },
      })
    })
  })

  it('shows email/password auth errors without routing', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'codex-test@newburghacepainting.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy()
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })
})
