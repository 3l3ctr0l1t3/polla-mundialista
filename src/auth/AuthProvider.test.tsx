import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

// --- mocks -----------------------------------------------------------------

let authCallback: ((u: unknown) => void) | null = null
const onAuthChangeMock = vi.fn((cb: (u: unknown) => void) => {
  authCallback = cb
  return () => {}
})

vi.mock('../firebase/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => onAuthChangeMock(cb),
}))

vi.mock('../firebase/db', () => ({
  userDoc: vi.fn(() => ({ __ref: 'user' })),
  allowlistConfigDoc: vi.fn(() => ({ __ref: 'allowlist' })),
}))

const getDocMock = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const setDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDocMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
}))

// A probe component that surfaces context values as text for assertions.
function Probe() {
  const { user, loading, isMember } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="member">{String(isMember)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

beforeEach(() => {
  authCallback = null
  onAuthChangeMock.mockClear()
  getDocMock.mockReset()
  setDocMock.mockClear()
})

describe('AuthProvider', () => {
  it('resolves to signed-out, non-member when no user', async () => {
    renderProbe()
    act(() => {
      authCallback?.(null)
    })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('member').textContent).toBe('false')
    expect(screen.getByTestId('email').textContent).toBe('none')
  })

  it('marks an allowlisted user as a member and upserts their profile', async () => {
    // First getDoc: existing-user check (does not exist). Second: allowlist read.
    getDocMock
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ emails: ['a@b.com'] }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('member').textContent).toBe('true'))
    expect(screen.getByTestId('email').textContent).toBe('a@b.com')
    expect(setDocMock).toHaveBeenCalledTimes(1)
  })

  it('treats a missing allowlist doc as not-a-member', async () => {
    getDocMock
      .mockResolvedValueOnce({ exists: () => true }) // user already exists
      .mockResolvedValueOnce({ exists: () => false }) // allowlist missing

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u2', email: 'x@y.com', displayName: 'X', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('member').textContent).toBe('false')
  })

  it('treats an unlisted email as not-a-member', async () => {
    getDocMock
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ emails: ['someone@else.com'] }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u3', email: 'nope@no.com', displayName: 'N', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('member').textContent).toBe('false')
  })
})
