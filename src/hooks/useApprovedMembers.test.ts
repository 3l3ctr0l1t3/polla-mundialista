import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Member } from '../shared/types'

// --- mocks -----------------------------------------------------------------

vi.mock('../firebase/db', () => ({
  groupMembersCol: (gid: string) => ({ __col: 'members', gid }),
}))

type SnapHandler = (snap: { docs: { data: () => Member }[] }) => void
let snapHandler: SnapHandler | null = null
const onSnapshotMock = vi.fn()
const whereMock = vi.fn(() => ({ __where: true }))

vi.mock('firebase/firestore', () => ({
  query: (col: unknown) => col,
  where: (...args: unknown[]) => whereMock(...(args as [])),
  onSnapshot: (ref: unknown, onNext: SnapHandler) => {
    onSnapshotMock(ref)
    snapHandler = onNext
    return () => {}
  },
}))

import { useApprovedMembers } from './useApprovedMembers'

const fakeTs = {} as Member['requestedAt']

function memberDoc(uid: string, displayName: string): { data: () => Member } {
  return {
    data: () => ({
      uid,
      displayName,
      email: `${uid}@x.com`,
      photoURL: null,
      role: 'member',
      status: 'approved',
      requestedAt: fakeTs,
      decidedAt: null,
      decidedBy: null,
    }),
  }
}

beforeEach(() => {
  snapHandler = null
  onSnapshotMock.mockClear()
  whereMock.mockClear()
})

describe('useApprovedMembers', () => {
  it('subscribes with a status == "approved" filter', () => {
    renderHook(() => useApprovedMembers('g1'))
    expect(onSnapshotMock).toHaveBeenCalledTimes(1)
    // Equality-only filter on status (no orderBy -> no composite index).
    expect(whereMock).toHaveBeenCalledWith('status', '==', 'approved')
  })

  it('maps snapshot docs to Member[] sorted by displayName', async () => {
    const { result } = renderHook(() => useApprovedMembers('g1'))

    act(() => {
      snapHandler!({
        docs: [memberDoc('c', 'Cara'), memberDoc('a', 'ana'), memberDoc('b', 'Beto')],
      })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Case-insensitive sort: ana, Beto, Cara.
    expect(result.current.members.map((m) => m.uid)).toEqual(['a', 'b', 'c'])
    expect(result.current.members.map((m) => m.displayName)).toEqual(['ana', 'Beto', 'Cara'])
  })
})
