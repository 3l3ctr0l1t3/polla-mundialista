import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  makeTestEnv,
  authedAs,
  MEMBER_EMAIL,
  OUTSIDER_EMAIL,
  FUTURE_KICKOFF,
  PAST_KICKOFF,
  MATCH_ID,
  PAST_MATCH_ID,
} from './helpers'

// Ticket 012 — multi-tenant groups. Covers acceptance rule 7:
//   open app access, owner auto-admin/member on create, request-pending allowed,
//   non-admin approve denied, per-group prediction lock + ownership + tamper rejection,
//   cross-group isolation, and read scoping.

let env: RulesTestEnvironment

const OWNER_A = 'user-ownerA'
const OWNER_B = 'user-ownerB'
const ALICE = 'user-alice' // joiner of group A
const BOB = 'user-bob' // outsider / joiner of group B
const ADMIN_MEMBER = 'user-adminmember' // approved member with role 'admin' in group A

const GROUP_A = 'groupA'
const GROUP_B = 'groupB'

const predId = (uid: string, matchId: string) => `${uid}_${matchId}`

/** A group doc owned by `ownerUid`. */
function groupPayload(gid: string, ownerUid: string) {
  return {
    groupId: gid,
    name: `Pool ${gid}`,
    ownerUid,
    ownerName: 'Owner',
    ownerPhotoURL: null,
    inviteCode: `code-${gid}`,
    createdAt: Timestamp.now(),
  }
}

/** A valid self-created pending member request (role 'member'). */
function pendingRequest(uid: string) {
  return {
    uid,
    displayName: 'Joiner',
    email: MEMBER_EMAIL,
    photoURL: null,
    role: 'member',
    status: 'pending',
    requestedAt: Timestamp.now(),
    decidedAt: null,
    decidedBy: null,
  }
}

/** A valid prediction payload (client-writable fields only). */
function validPred(uid: string, matchId: string) {
  return {
    uid,
    matchId,
    homeGoals: 2,
    awayGoals: 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

/** Seed a group + an arbitrary member doc, rules disabled (simulates admin SDK state). */
async function seedGroup(gid: string, ownerUid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', gid), groupPayload(gid, ownerUid))
  })
}

async function seedMember(
  gid: string,
  uid: string,
  role: 'admin' | 'member',
  status: 'pending' | 'approved' | 'rejected',
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', gid, 'members', uid), {
      uid,
      displayName: 'Member',
      email: MEMBER_EMAIL,
      photoURL: null,
      role,
      status,
      requestedAt: Timestamp.now(),
      decidedAt: status === 'pending' ? null : Timestamp.now(),
      decidedBy: status === 'pending' ? null : OWNER_A,
    })
  })
}

beforeAll(async () => {
  env = await makeTestEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Global matches written by the admin SDK / ingestion.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore()
    await setDoc(doc(adb, 'matches', MATCH_ID), {
      matchId: MATCH_ID,
      kickoff: Timestamp.fromDate(FUTURE_KICKOFF),
      status: 'TIMED',
    })
    await setDoc(doc(adb, 'matches', PAST_MATCH_ID), {
      matchId: PAST_MATCH_ID,
      kickoff: Timestamp.fromDate(PAST_KICKOFF),
      status: 'TIMED',
    })
  })
})

/* ----------------------------------------------------- open app access */

describe('groups — open app access', () => {
  it('any signed-in user can read group metadata (join page)', async () => {
    await seedGroup(GROUP_A, OWNER_A)
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A)))
  })

  it('denies an unauthenticated read of a group', async () => {
    await seedGroup(GROUP_A, OWNER_A)
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'groups', GROUP_A)))
  })

  it('a signed-in user can create a group they own (single write)', async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(setDoc(doc(db, 'groups', GROUP_A), groupPayload(GROUP_A, OWNER_A)))
  })

  it('denies creating a group owned by someone else', async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertFails(setDoc(doc(db, 'groups', GROUP_A), groupPayload(GROUP_A, OWNER_B)))
  })

  it('denies an unauthenticated group create', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'groups', GROUP_A), groupPayload(GROUP_A, OWNER_A)))
  })

  it('only the owner may update/delete the group', async () => {
    await seedGroup(GROUP_A, OWNER_A)
    const owner = authedAs(env, OWNER_A, MEMBER_EMAIL)
    const other = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertSucceeds(updateDoc(doc(owner, 'groups', GROUP_A), { name: 'Renamed' }))
    await assertFails(updateDoc(doc(other, 'groups', GROUP_A), { name: 'Hijacked' }))
    await assertFails(deleteDoc(doc(other, 'groups', GROUP_A)))
    await assertSucceeds(deleteDoc(doc(owner, 'groups', GROUP_A)))
  })
})

/* ------------------------------- owner is implicitly admin + member */

describe('groups — owner is implicitly admin + member (no member doc)', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
  })

  it('owner can write a prediction in their group WITHOUT a member doc', async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID)),
        validPred(OWNER_A, MATCH_ID),
      ),
    )
  })

  it('owner can read their group leaderboard WITHOUT a member doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GROUP_A, 'leaderboard', OWNER_A), {
        uid: OWNER_A,
        totalPoints: 0,
      })
    })
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', OWNER_A)))
  })

  it('owner can approve a pending joiner (acting as implicit admin)', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'approved',
        decidedBy: OWNER_A,
        decidedAt: Timestamp.now(),
      }),
    )
  })
})

/* --------------------------------------------- joiner self-request */

describe('groups — joiner self-request (request to join)', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
  })

  it('a non-owner can create their own pending member request', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), pendingRequest(ALICE)),
    )
  })

  it("denies creating someone else's member doc", async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(setDoc(doc(db, 'groups', GROUP_A, 'members', BOB), pendingRequest(BOB)))
  })

  it('denies self-requesting directly as approved', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        ...pendingRequest(ALICE),
        status: 'approved',
      }),
    )
  })

  it("denies self-requesting as role 'admin'", async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        ...pendingRequest(ALICE),
        role: 'admin',
      }),
    )
  })

  it('denies a self-request that stamps decidedBy/decidedAt', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        ...pendingRequest(ALICE),
        decidedBy: ALICE,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('allows a rejected joiner to re-request (rejected -> pending)', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'rejected')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'pending',
        decidedAt: null,
        decidedBy: null,
      }),
    )
  })
})

/* ---------------------------------------- non-admin cannot approve */

describe('groups — non-admin can never approve', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
  })

  it('denies a pending joiner self-approving', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), { status: 'approved' }),
    )
  })

  it('denies a pending joiner self-stamping an approval', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'approved',
        decidedBy: ALICE,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an APPROVED ordinary member approving another joiner', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved') // approved but role 'member'
    await seedMember(GROUP_A, BOB, 'member', 'pending')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', BOB), {
        status: 'approved',
        decidedBy: ALICE,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an outsider (no member doc) approving a joiner', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'approved',
        decidedBy: BOB,
        decidedAt: Timestamp.now(),
      }),
    )
  })
})

/* ----------------------------- group admin (role) decisions */

describe('groups — group admin (role admin) decisions', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
    await seedMember(GROUP_A, ADMIN_MEMBER, 'admin', 'approved')
  })

  it('a role-admin member can approve a pending joiner (stamping themselves)', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'approved',
        decidedBy: ADMIN_MEMBER,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an admin decision stamping someone else as the decider', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'approved',
        decidedBy: 'someone-else',
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an admin decision that omits decidedAt', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_A, 'members', ALICE), {
        status: 'approved',
        decidedBy: ADMIN_MEMBER,
      }),
    )
  })

  it('a group admin may delete a member doc; a non-admin may not', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    const ordinary = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(deleteDoc(doc(ordinary, 'groups', GROUP_A, 'members', ALICE)))
    await assertSucceeds(deleteDoc(doc(admin, 'groups', GROUP_A, 'members', ALICE)))
  })

  it('an approved member may write predictions after approval', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      ),
    )
  })
})

/* ---------------------------- per-group prediction integrity */

describe('groups — per-group predictions (lock / ownership / tamper)', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
  })

  it('allows an approved member to create their prediction BEFORE kickoff', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      ),
    )
  })

  it('rejects a prediction create AT/AFTER kickoff', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, PAST_MATCH_ID)),
        validPred(ALICE, PAST_MATCH_ID),
      ),
    )
  })

  it('rejects an update once the match has kicked off', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'groups', GROUP_A, 'predictions', predId(ALICE, PAST_MATCH_ID)),
        validPred(ALICE, PAST_MATCH_ID),
      )
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, PAST_MATCH_ID)), {
        ...validPred(ALICE, PAST_MATCH_ID),
        homeGoals: 3,
      }),
    )
  })

  it('rejects a non-member writing a prediction even before kickoff', async () => {
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(BOB, MATCH_ID)),
        validPred(BOB, MATCH_ID),
      ),
    )
  })

  it('rejects a pending (not-yet-approved) member writing a prediction', async () => {
    await seedMember(GROUP_A, BOB, 'member', 'pending')
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(BOB, MATCH_ID)),
        validPred(BOB, MATCH_ID),
      ),
    )
  })

  it("rejects writing a prediction with someone else's uid", async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID)),
        validPred(OWNER_A, MATCH_ID),
      ),
    )
  })

  it('rejects a doc id whose prefix does not match the uid', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(BOB, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      ),
    )
  })

  it('rejects a create that sets points', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)), {
        ...validPred(ALICE, MATCH_ID),
        points: 5,
      }),
    )
  })

  it('rejects a create that sets breakdown', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)), {
        ...validPred(ALICE, MATCH_ID),
        breakdown: { exact: 5, outcome: 3, goalDiff: 1 },
      }),
    )
  })

  it('rejects an update that introduces points', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      ),
    )
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)), {
        ...validPred(ALICE, MATCH_ID),
        points: 999,
      }),
    )
  })

  it('rejects out-of-range goals (>30)', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)), {
        ...validPred(ALICE, MATCH_ID),
        homeGoals: 31,
      }),
    )
  })

  it('rejects negative goals', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)), {
        ...validPred(ALICE, MATCH_ID),
        awayGoals: -1,
      }),
    )
  })

  it('rejects non-integer goals', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)), {
        ...validPred(ALICE, MATCH_ID),
        homeGoals: 1.5,
      }),
    )
  })

  it('rejects a prediction for a non-existent match', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, '999999')),
        validPred(ALICE, '999999'),
      ),
    )
  })

  it('denies delete of own prediction', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      )
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(deleteDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))))
  })

  it('allows a read of own prediction, denies a read of another user prediction', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      )
      await setDoc(
        doc(ctx.firestore(), 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID)),
        validPred(OWNER_A, MATCH_ID),
      )
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))))
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID))))
  })
})

/* ------------------------------------ cross-group isolation */

describe('groups — cross-group isolation', () => {
  beforeEach(async () => {
    // Alice is an approved member of A only. Group B is owned by OWNER_B.
    await seedGroup(GROUP_A, OWNER_A)
    await seedGroup(GROUP_B, OWNER_B)
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
  })

  it("a member of A cannot write a prediction in B's predictions", async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_B, 'predictions', predId(ALICE, MATCH_ID)),
        validPred(ALICE, MATCH_ID),
      ),
    )
  })

  it("a member of A cannot read B's leaderboard", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GROUP_B, 'leaderboard', OWNER_B), {
        uid: OWNER_B,
        totalPoints: 0,
      })
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_B, 'leaderboard', OWNER_B)))
  })

  it('a member of A cannot approve a joiner in B', async () => {
    await seedMember(GROUP_B, BOB, 'member', 'pending')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_B, 'members', BOB), {
        status: 'approved',
        decidedBy: ALICE,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('the owner of A cannot write predictions or approve in B', async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', GROUP_B, 'predictions', predId(OWNER_A, MATCH_ID)),
        validPred(OWNER_A, MATCH_ID),
      ),
    )
    await seedMember(GROUP_B, BOB, 'member', 'pending')
    await assertFails(
      updateDoc(doc(db, 'groups', GROUP_B, 'members', BOB), {
        status: 'approved',
        decidedBy: OWNER_A,
        decidedAt: Timestamp.now(),
      }),
    )
  })
})

/* ----------------------------------------- read scoping */

describe('groups — read scoping (members read their group only)', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
  })

  it('an approved member can read their group leaderboard', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GROUP_A, 'leaderboard', ALICE), {
        uid: ALICE,
        totalPoints: 0,
      })
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', ALICE)))
  })

  it('a non-member cannot read the group leaderboard', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GROUP_A, 'leaderboard', OWNER_A), {
        uid: OWNER_A,
        totalPoints: 0,
      })
    })
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', OWNER_A)))
  })

  it('a pending member cannot read the group leaderboard', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GROUP_A, 'leaderboard', OWNER_A), {
        uid: OWNER_A,
        totalPoints: 0,
      })
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', OWNER_A)))
  })

  it('no client may write a group leaderboard', async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'groups', GROUP_A, 'leaderboard', OWNER_A), { uid: OWNER_A, totalPoints: 99 }),
    )
  })

  it('a member can read the member roster; a non-member cannot read others', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
    await seedMember(GROUP_A, BOB, 'member', 'pending')
    const member = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(member, 'groups', GROUP_A, 'members', BOB)))

    const outsider = authedAs(env, 'user-nobody', OUTSIDER_EMAIL)
    await assertFails(getDoc(doc(outsider, 'groups', GROUP_A, 'members', ALICE)))
  })

  it('a joiner can always read their OWN member doc (even pending)', async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'pending')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'members', ALICE)))
  })
})

/* -------------------------- admin removes a member (ticket 015, AC 5-6) */
// `allow delete: if isGroupAdmin(gid)` (firestore.rules ~line 237), where
// isGroupAdmin(gid) = isOwner(gid) OR an approved member doc with role == 'admin'.
// These cases lock in: owner can remove; a role:'admin' member can remove another;
// a plain approved member cannot; a non-member stranger cannot. No rules change.

describe('groups — admin removes a member (delete member doc)', () => {
  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
    // ALICE is an ordinary approved member — the deletion target throughout.
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
  })

  it('the group OWNER can delete an approved member doc', async () => {
    const owner = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(deleteDoc(doc(owner, 'groups', GROUP_A, 'members', ALICE)))
  })

  it("a role:'admin' approved member can delete ANOTHER member's doc", async () => {
    await seedMember(GROUP_A, ADMIN_MEMBER, 'admin', 'approved')
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(deleteDoc(doc(admin, 'groups', GROUP_A, 'members', ALICE)))
  })

  it("denies a plain approved member deleting another member's doc", async () => {
    await seedMember(GROUP_A, BOB, 'member', 'approved')
    const ordinary = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(deleteDoc(doc(ordinary, 'groups', GROUP_A, 'members', ALICE)))
  })

  it("denies a non-member stranger deleting a member's doc", async () => {
    const stranger = authedAs(env, 'user-stranger', OUTSIDER_EMAIL)
    await assertFails(deleteDoc(doc(stranger, 'groups', GROUP_A, 'members', ALICE)))
  })
})

/* ---------------- orphan prediction cleanup (amendment 2026-06-11) -------- */
// `allow delete` on groups/{gid}/predictions: a group ADMIN may delete a prediction
// ONLY when its author is no longer a participant (not the owner, no member doc of
// ANY status), and a delete of a NONEXISTENT doc is a permitted no-op (so the client
// can blind-delete `{uid}_{matchId}` per match with no new read access). Everything
// else about predictions (read/create/update) is unchanged — covered by the suites
// above and reveal.test.ts.

describe('groups — orphan prediction cleanup (admin deletes ex-member predictions)', () => {
  const EX_MEMBER = 'user-exmember' // had predictions; member doc already deleted

  /** Seed a prediction doc rules-disabled (simulates pre-removal state). */
  async function seedPrediction(gid: string, uid: string, matchId: string) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'groups', gid, 'predictions', predId(uid, matchId)),
        validPred(uid, matchId),
      )
    })
  }

  beforeEach(async () => {
    await seedGroup(GROUP_A, OWNER_A)
    await seedMember(GROUP_A, ADMIN_MEMBER, 'admin', 'approved')
    // EX_MEMBER's prediction exists but their member doc does NOT (admin removed it).
    await seedPrediction(GROUP_A, EX_MEMBER, MATCH_ID)
  })

  it("a role-admin member CAN delete an EX-member's existing prediction", async () => {
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(EX_MEMBER, MATCH_ID))),
    )
  })

  it("the group OWNER (implicit admin) CAN delete an EX-member's prediction", async () => {
    const owner = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(
      deleteDoc(doc(owner, 'groups', GROUP_A, 'predictions', predId(EX_MEMBER, MATCH_ID))),
    )
  })

  it("an admin CAN delete an ex-member's prediction for a PAST-kickoff match (lock is write-only)", async () => {
    await seedPrediction(GROUP_A, EX_MEMBER, PAST_MATCH_ID)
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(EX_MEMBER, PAST_MATCH_ID))),
    )
  })

  it("an admin CANNOT delete an APPROVED member's prediction", async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
    await seedPrediction(GROUP_A, ALICE, MATCH_ID)
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))),
    )
  })

  it("an admin CANNOT delete a PENDING member's prediction (any member doc protects)", async () => {
    await seedMember(GROUP_A, BOB, 'member', 'pending')
    await seedPrediction(GROUP_A, BOB, MATCH_ID)
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(BOB, MATCH_ID))),
    )
  })

  it("an admin CANNOT delete the OWNER's prediction (owner is an implicit participant)", async () => {
    await seedPrediction(GROUP_A, OWNER_A, MATCH_ID)
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID))),
    )
  })

  it("a plain (non-admin) member CANNOT delete an ex-member's prediction", async () => {
    await seedMember(GROUP_A, ALICE, 'member', 'approved')
    const ordinary = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      deleteDoc(doc(ordinary, 'groups', GROUP_A, 'predictions', predId(EX_MEMBER, MATCH_ID))),
    )
  })

  it("a non-member stranger CANNOT delete an ex-member's prediction", async () => {
    const stranger = authedAs(env, 'user-stranger', OUTSIDER_EMAIL)
    await assertFails(
      deleteDoc(doc(stranger, 'groups', GROUP_A, 'predictions', predId(EX_MEMBER, MATCH_ID))),
    )
  })

  it('an admin CAN "delete" a NONEXISTENT prediction doc (blind no-op succeeds)', async () => {
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(EX_MEMBER, '999999'))),
    )
  })

  it('an admin still CANNOT delete their OWN prediction (they are a participant)', async () => {
    await seedPrediction(GROUP_A, ADMIN_MEMBER, MATCH_ID)
    const admin = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      deleteDoc(doc(admin, 'groups', GROUP_A, 'predictions', predId(ADMIN_MEMBER, MATCH_ID))),
    )
  })

  it("the OWNER still CANNOT delete their OWN prediction (they're the owner)", async () => {
    await seedPrediction(GROUP_A, OWNER_A, MATCH_ID)
    const owner = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertFails(
      deleteDoc(doc(owner, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID))),
    )
  })
})
