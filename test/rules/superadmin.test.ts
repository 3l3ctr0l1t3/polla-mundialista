import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  makeTestEnv,
  authedAs,
  MEMBER_EMAIL,
  OUTSIDER_EMAIL,
  FUTURE_KICKOFF,
  MATCH_ID,
} from './helpers'

// Ticket 014 — superadmin oversight (read-only god-view).
//   A user with users/{uid}.isAdmin == true may READ any group's members, leaderboard,
//   and predictions (even ones they don't own, even before kickoff). A signed-in
//   non-superadmin non-member is denied. The isAdmin tamper-guard is unchanged: no
//   client write may set or raise it.

let env: RulesTestEnvironment

const SUPERADMIN = 'user-superadmin' // users/{uid}.isAdmin == true
const OWNER_A = 'user-ownerA'
const ALICE = 'user-alice' // approved member of group A
const OUTSIDER = 'user-outsider' // signed in, not superadmin, not a member

const GROUP_A = 'groupA'
const SUPER_EMAIL = 'super@example.com'

const predId = (uid: string, matchId: string) => `${uid}_${matchId}`

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

/** Seed a group, an approved member, a leaderboard row, and a prediction (rules off). */
async function seedGroupWithData() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore()
    await setDoc(doc(adb, 'groups', GROUP_A), groupPayload(GROUP_A, OWNER_A))
    await setDoc(doc(adb, 'groups', GROUP_A, 'members', ALICE), {
      uid: ALICE,
      displayName: 'Alice',
      email: MEMBER_EMAIL,
      photoURL: null,
      role: 'member',
      status: 'approved',
      requestedAt: Timestamp.now(),
      decidedAt: Timestamp.now(),
      decidedBy: OWNER_A,
    })
    await setDoc(doc(adb, 'groups', GROUP_A, 'leaderboard', ALICE), {
      uid: ALICE,
      totalPoints: 7,
    })
    // A prediction owned by ALICE for a FUTURE (not-yet-kicked-off) match.
    await setDoc(
      doc(adb, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID)),
      validPred(ALICE, MATCH_ID),
    )
  })
}

/** Mark a user as app-level superadmin (admin-SDK-only flag). */
async function seedSuperAdmin(uid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      uid,
      displayName: 'Super',
      email: SUPER_EMAIL,
      isAdmin: true,
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
  await env.withSecurityRulesDisabled(async (ctx) => {
    // A FUTURE match so the seeded prediction is pre-kickoff (others normally hidden).
    await setDoc(doc(ctx.firestore(), 'matches', MATCH_ID), {
      matchId: MATCH_ID,
      kickoff: Timestamp.fromDate(FUTURE_KICKOFF),
      status: 'TIMED',
    })
  })
})

/* ----------------------------------------- superadmin can read everything */

describe('superadmin — read-only oversight across groups', () => {
  beforeEach(async () => {
    await seedGroupWithData()
    await seedSuperAdmin(SUPERADMIN)
  })

  it("can read another group's member doc (not their own, not a member)", async () => {
    const db = authedAs(env, SUPERADMIN, SUPER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'members', ALICE)))
  })

  it("can read another group's leaderboard row", async () => {
    const db = authedAs(env, SUPERADMIN, SUPER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', ALICE)))
  })

  it("can read another user's prediction even BEFORE kickoff", async () => {
    const db = authedAs(env, SUPERADMIN, SUPER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))))
  })
})

/* ------------------------------- non-superadmin non-member still denied */

describe('superadmin — non-superadmin non-member is denied', () => {
  beforeEach(async () => {
    await seedGroupWithData()
    // OUTSIDER has NO users doc / isAdmin flag and is not a member of GROUP_A.
  })

  it("denies reading another group's member doc", async () => {
    const db = authedAs(env, OUTSIDER, OUTSIDER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'members', ALICE)))
  })

  it("denies reading another group's leaderboard row", async () => {
    const db = authedAs(env, OUTSIDER, OUTSIDER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', ALICE)))
  })

  it("denies reading another user's pre-kickoff prediction", async () => {
    const db = authedAs(env, OUTSIDER, OUTSIDER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))))
  })

  it('denies a user whose users doc has isAdmin == false', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OUTSIDER), {
        uid: OUTSIDER,
        displayName: 'Plain',
        email: OUTSIDER_EMAIL,
        isAdmin: false,
      })
    })
    const db = authedAs(env, OUTSIDER, OUTSIDER_EMAIL)
    await assertFails(getDoc(doc(db, 'groups', GROUP_A, 'leaderboard', ALICE)))
  })
})

/* ------------------------------------------- isAdmin tamper-guard unchanged */

describe('superadmin — isAdmin flag cannot be set by any client write', () => {
  it('denies a client CREATE that self-grants isAdmin == true', async () => {
    const db = authedAs(env, OUTSIDER, OUTSIDER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'users', OUTSIDER), {
        uid: OUTSIDER,
        displayName: 'Climber',
        email: OUTSIDER_EMAIL,
        isAdmin: true,
      }),
    )
  })

  it('denies a client UPDATE that raises isAdmin from false to true', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OUTSIDER), {
        uid: OUTSIDER,
        displayName: 'Plain',
        email: OUTSIDER_EMAIL,
        isAdmin: false,
      })
    })
    const db = authedAs(env, OUTSIDER, OUTSIDER_EMAIL)
    await assertFails(updateDoc(doc(db, 'users', OUTSIDER), { isAdmin: true }))
  })
})
