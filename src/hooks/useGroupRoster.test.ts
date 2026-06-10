import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Group, Member, LeaderboardEntry } from '../shared/types'

// --- mocks -----------------------------------------------------------------
// We drive the two onSnapshot listeners (members + leaderboard) directly so we can
// assert the merged, ranked roster without a real Firestore.

vi.mock('../firebase/db', () => ({
  groupMembersCol: (gid: string) => ({ __col: 'members', gid }),
  groupLeaderboardCol: (gid: string) => ({ __col: 'leaderboard', gid }),
}))

// `query`/`where` are pass-through markers; `onSnapshot` is routed by the collection ref.
type SnapHandler = (snap: { docs: { id: string; data: () => unknown }[] }) => void
let memberHandler: SnapHandler | null = null
let leaderboardHandler: SnapHandler | null = null

vi.mock('firebase/firestore', () => ({
  query: (col: unknown) => col,
  where: () => ({ __where: true }),
  onSnapshot: (ref: { __col: string }, onNext: SnapHandler) => {
    if (ref.__col === 'members') memberHandler = onNext
    else leaderboardHandler = onNext
    return () => {}
  },
}))

let groupValue: Group | null = null
vi.mock('../group/useGroup', () => ({
  useGroup: () => ({ group: groupValue }),
}))

import { useGroupRoster } from './useGroupRoster'

/** A Timestamp-mock at a given epoch ms (only `toMillis` is read by the hook). */
function ts(ms: number): Group['createdAt'] {
  return { toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Group['createdAt']
}

const fakeTs = ts(0)

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    groupId: 'g1',
    name: 'Pool',
    ownerUid: 'owner',
    ownerName: 'Olivia Owner',
    ownerPhotoURL: null,
    inviteCode: 'CODE',
    createdAt: fakeTs,
    ...overrides,
  }
}

function memberDoc(
  uid: string,
  displayName: string,
  requestedAtMs = 0,
): { id: string; data: () => Member } {
  return {
    id: uid,
    data: () => ({
      uid,
      displayName,
      email: `${uid}@x.com`,
      photoURL: null,
      role: 'member',
      status: 'approved',
      requestedAt: ts(requestedAtMs),
      decidedAt: null,
      decidedBy: null,
    }),
  }
}

function pointsDoc(
  uid: string,
  p: Partial<LeaderboardEntry>,
): { id: string; data: () => LeaderboardEntry } {
  return {
    id: uid,
    data: () => ({
      uid,
      displayName: 'ignored',
      photoURL: null,
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      predictionsGraded: 0,
      rank: 0,
      joinedAt: ts(0),
      updatedAt: fakeTs,
      ...p,
    }),
  }
}

beforeEach(() => {
  memberHandler = null
  leaderboardHandler = null
  groupValue = null
})

describe('useGroupRoster', () => {
  it('lists every approved member plus the owner, showing 0 points for the ungraded', async () => {
    groupValue = makeGroup()
    const { result } = renderHook(() => useGroupRoster('g1'))

    // Two approved members; only one has graded points. The owner has none.
    act(() => {
      memberHandler!({ docs: [memberDoc('a', 'Alice'), memberDoc('b', 'Bob')] })
      leaderboardHandler!({
        docs: [pointsDoc('a', { totalPoints: 12, exactCount: 2, outcomeCount: 1 })],
      })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const roster = result.current.roster
    // Owner + 2 members.
    expect(roster.map((r) => r.displayName).sort()).toEqual(['Alice', 'Bob', 'Olivia Owner'])

    // Alice leads with 12; Bob and the owner sit at 0 (still listed).
    expect(roster[0].displayName).toBe('Alice')
    expect(roster[0].totalPoints).toBe(12)
    expect(roster.find((r) => r.uid === 'owner')?.totalPoints).toBe(0)
    expect(roster.find((r) => r.uid === 'b')?.totalPoints).toBe(0)

    // The owner is flagged and rendered from the group fields (no member doc).
    expect(roster.find((r) => r.uid === 'owner')?.isOwner).toBe(true)
  })

  it('ranks by points then exact/outcome, surfacing ties as shared dense ranks', async () => {
    groupValue = makeGroup({ ownerUid: 'owner', ownerName: 'Zed' })
    const { result } = renderHook(() => useGroupRoster('g1'))

    act(() => {
      memberHandler!({
        docs: [memberDoc('a', 'Alice'), memberDoc('b', 'Bob'), memberDoc('c', 'Cara')],
      })
      leaderboardHandler!({
        docs: [
          pointsDoc('a', { totalPoints: 10 }),
          // Bob & Cara tie on every key -> shared rank.
          pointsDoc('b', { totalPoints: 10 }),
          pointsDoc('c', { totalPoints: 10 }),
        ],
      })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    const roster = result.current.roster

    // Alice/Bob/Cara all on 10 -> rank 1 (tied). Owner Zed on 0 -> rank 2.
    const a = roster.find((r) => r.uid === 'a')!
    const owner = roster.find((r) => r.uid === 'owner')!
    expect(a.rank).toBe(1)
    expect(a.isTie).toBe(true)
    expect(owner.rank).toBe(2)
    expect(owner.isTie).toBe(false)
  })

  it('breaks ties by join time (earliest first), NOT by display name', async () => {
    groupValue = makeGroup({ ownerUid: 'owner', ownerName: 'Zoe', createdAt: ts(5_000) })
    const { result } = renderHook(() => useGroupRoster('g1'))

    act(() => {
      // Alice joined LATER than Bob, despite sorting first alphabetically. With equal
      // points/exact/outcome, Bob (earlier join) must out-rank Alice.
      memberHandler!({
        docs: [memberDoc('a', 'Alice', 3_000), memberDoc('b', 'Bob', 1_000)],
      })
      leaderboardHandler!({
        docs: [
          pointsDoc('a', { totalPoints: 10, joinedAt: ts(3_000) }),
          pointsDoc('b', { totalPoints: 10, joinedAt: ts(1_000) }),
        ],
      })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    const roster = result.current.roster

    const a = roster.find((r) => r.uid === 'a')!
    const b = roster.find((r) => r.uid === 'b')!
    // Bob joined first -> ranked ahead of Alice even though "Alice" < "Bob" by name.
    expect(roster.indexOf(b)).toBeLessThan(roster.indexOf(a))
    expect(b.joinedAtMs).toBe(1_000)
    expect(a.joinedAtMs).toBe(3_000)
  })

  it('de-dupes the owner if they also appear as a leaderboard row', async () => {
    groupValue = makeGroup({ ownerUid: 'owner', ownerName: 'Olivia Owner' })
    const { result } = renderHook(() => useGroupRoster('g1'))

    act(() => {
      memberHandler!({ docs: [] })
      // The owner can have a leaderboard doc (they predict too) — must not double-count.
      leaderboardHandler!({ docs: [pointsDoc('owner', { totalPoints: 7, exactCount: 1 })] })
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    const owners = result.current.roster.filter((r) => r.uid === 'owner')
    expect(owners).toHaveLength(1)
    expect(owners[0].totalPoints).toBe(7)
    expect(owners[0].displayName).toBe('Olivia Owner')
  })
})
