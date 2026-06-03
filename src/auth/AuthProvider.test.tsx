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
}))

const getDocMock = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const setDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())

// `onSnapshot` drives the live `users/{uid}.isAdmin` mirror. We capture its onNext so a
// test can push a user-doc snapshot and assert `isSuperAdmin`.
type SnapNext = (snap: { exists: () => boolean; data: () => { isAdmin?: boolean } }) => void
let userDocNext: SnapNext | null = null
const onSnapshotMock = vi.fn((_ref: unknown, onNext: SnapNext) => {
  userDocNext = onNext
  return () => {}
})

vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDocMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  onSnapshot: (ref: unknown, onNext: SnapNext) => onSnapshotMock(ref, onNext),
}))

// A probe component that surfaces context values as text for assertions.
function Probe() {
  const { user, loading, isSuperAdmin } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="superadmin">{String(isSuperAdmin)}</span>
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
  userDocNext = null
  onAuthChangeMock.mockClear()
  onSnapshotMock.mockClear()
  getDocMock.mockReset()
  setDocMock.mockClear()
})

describe('AuthProvider', () => {
  it('resolves to signed-out when there is no user', async () => {
    renderProbe()
    act(() => {
      authCallback?.(null)
    })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('email').textContent).toBe('none')
    // No profile upsert while signed out.
    expect(setDocMock).not.toHaveBeenCalled()
  })

  it('exposes any signed-in user (no app-level membership gate) and upserts the profile', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false }) // new user doc

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('email').textContent).toBe('a@b.com')
    // Profile upserted once; createdAt stamped because the doc was new.
    expect(setDocMock).toHaveBeenCalledTimes(1)
    const [, profile, options] = setDocMock.mock.calls[0]
    expect(profile).toMatchObject({ uid: 'u1', email: 'a@b.com', createdAt: 'SERVER_TS' })
    expect(options).toEqual({ merge: true })
  })

  it('does not re-stamp createdAt for an existing profile', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ isAdmin: false }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u2', email: 'c@d.com', displayName: 'C', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('c@d.com'))
    const [, profile] = setDocMock.mock.calls[0]
    expect(profile).not.toHaveProperty('createdAt')
  })

  it('still signs the user in even if the profile upsert fails', async () => {
    getDocMock.mockRejectedValueOnce(new Error('offline'))

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u3', email: 'e@f.com', displayName: 'E', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('email').textContent).toBe('e@f.com')
  })

  it('defaults isSuperAdmin to false while signed out', async () => {
    renderProbe()
    act(() => {
      authCallback?.(null)
    })
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('superadmin').textContent).toBe('false')
    // No user-doc subscription while signed out.
    expect(onSnapshotMock).not.toHaveBeenCalled()
  })

  it('sets isSuperAdmin true when the user doc has isAdmin === true', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ isAdmin: true }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'admin1', email: 'a@b.com', displayName: 'A', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    // The live user-doc listener reports isAdmin: true.
    act(() => {
      userDocNext?.({ exists: () => true, data: () => ({ isAdmin: true }) })
    })
    await waitFor(() => expect(screen.getByTestId('superadmin').textContent).toBe('true'))
  })

  it('keeps isSuperAdmin false when isAdmin is absent or false', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ isAdmin: false }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u4', email: 'n@b.com', displayName: 'N', photoURL: null })
    })

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    act(() => {
      userDocNext?.({ exists: () => true, data: () => ({ isAdmin: false }) })
    })
    expect(screen.getByTestId('superadmin').textContent).toBe('false')
  })
})
