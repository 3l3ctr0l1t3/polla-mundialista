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
  memberDoc: vi.fn(() => ({ __ref: 'member' })),
}))

const getDocMock = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const setDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())
// onSnapshot(ref, onNext, onError) — capture the callbacks so each test can emit the
// member-doc snapshot it wants. Returns an unsubscribe spy.
let snapshotNext: ((snap: unknown) => void) | null = null
const unsubscribeMock = vi.fn()
const onSnapshotMock = vi.fn((_ref: unknown, onNext: (snap: unknown) => void) => {
  snapshotNext = onNext
  return unsubscribeMock
})

vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDocMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(args[0], args[1] as (snap: unknown) => void),
}))

// A probe component that surfaces context values as text for assertions.
function Probe() {
  const { user, loading, isMember, isAdmin, memberStatus } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="member">{String(isMember)}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="status">{memberStatus ?? 'null'}</span>
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

/** Emit a member-doc snapshot (existing with `status`, or non-existent). */
function emitMemberSnapshot(status: string | null) {
  act(() => {
    snapshotNext?.({
      exists: () => status !== null,
      data: () => ({ status }),
    })
  })
}

beforeEach(() => {
  authCallback = null
  snapshotNext = null
  onAuthChangeMock.mockClear()
  onSnapshotMock.mockClear()
  unsubscribeMock.mockClear()
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
    expect(screen.getByTestId('admin').textContent).toBe('false')
    expect(screen.getByTestId('status').textContent).toBe('null')
    expect(screen.getByTestId('email').textContent).toBe('none')
    // No member-doc subscription opened while signed out.
    expect(onSnapshotMock).not.toHaveBeenCalled()
  })

  it('marks an admin as a member even with no member doc', async () => {
    // upsertUserProfile reads users/{uid}: existing + isAdmin true.
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ isAdmin: true }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'admin1', email: 'admin@x.com', displayName: 'Adm', photoURL: null })
    })

    // Member doc subscription opened; emit "no request".
    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(1))
    emitMemberSnapshot(null)

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('admin').textContent).toBe('true')
    expect(screen.getByTestId('member').textContent).toBe('true')
    expect(screen.getByTestId('status').textContent).toBe('null')
    expect(setDocMock).toHaveBeenCalledTimes(1)
  })

  it('marks an approved member as a member (non-admin)', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ isAdmin: false }) })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null })
    })

    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(1))
    emitMemberSnapshot('approved')

    await waitFor(() => expect(screen.getByTestId('member').textContent).toBe('true'))
    expect(screen.getByTestId('admin').textContent).toBe('false')
    expect(screen.getByTestId('status').textContent).toBe('approved')
    expect(screen.getByTestId('email').textContent).toBe('a@b.com')
  })

  it('treats a pending request as NOT a member', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false }) // new user doc

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u2', email: 'p@b.com', displayName: 'P', photoURL: null })
    })

    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(1))
    emitMemberSnapshot('pending')

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('member').textContent).toBe('false')
    expect(screen.getByTestId('status').textContent).toBe('pending')
  })

  it('treats a rejected request as NOT a member', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u3', email: 'r@b.com', displayName: 'R', photoURL: null })
    })

    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(1))
    emitMemberSnapshot('rejected')

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('member').textContent).toBe('false')
    expect(screen.getByTestId('status').textContent).toBe('rejected')
  })

  it('treats no member doc (non-admin) as NOT a member', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })

    renderProbe()
    act(() => {
      authCallback?.({ uid: 'u4', email: 'n@b.com', displayName: 'N', photoURL: null })
    })

    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(1))
    emitMemberSnapshot(null)

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('member').textContent).toBe('false')
    expect(screen.getByTestId('status').textContent).toBe('null')
  })
})
