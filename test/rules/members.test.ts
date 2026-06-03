import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import { makeTestEnv, authedAs, MEMBER_EMAIL } from './helpers'

// Self-enrollment + admin approval rules (ticket 011, acceptance rule 5).
// Membership for predictions is `isAdmin || members/{uid}.status === 'approved'`.

let env: RulesTestEnvironment

const USER_UID = 'user-alice'
const OTHER_UID = 'user-bob'
const ADMIN_UID = 'user-admin'

/** A valid self-created pending request payload. */
function pendingRequest(uid: string) {
  return {
    uid,
    displayName: 'Alice',
    email: MEMBER_EMAIL,
    photoURL: null,
    status: 'pending',
    requestedAt: Timestamp.now(),
    decidedAt: null,
    decidedBy: null,
  }
}

/** Seed an admin's users/{uid} doc (isAdmin true) with rules disabled. */
async function seedAdmin(uid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), {
      uid,
      displayName: 'Admin',
      email: MEMBER_EMAIL,
      photoURL: null,
      isAdmin: true,
      createdAt: Timestamp.now(),
    })
  })
}

/** Seed a member doc with a given status, rules disabled. */
async function seedMember(uid: string, status: 'pending' | 'approved' | 'rejected') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'members', uid), {
      uid,
      displayName: 'Alice',
      email: MEMBER_EMAIL,
      photoURL: null,
      status,
      requestedAt: Timestamp.now(),
      decidedAt: status === 'pending' ? null : Timestamp.now(),
      decidedBy: status === 'pending' ? null : 'someone',
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
})

describe('members — self create (request to join)', () => {
  it('allows a signed-in user to create their own pending request', async () => {
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertSucceeds(setDoc(doc(db, 'members', USER_UID), pendingRequest(USER_UID)))
  })

  it("denies creating someone else's member doc", async () => {
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(setDoc(doc(db, 'members', OTHER_UID), pendingRequest(OTHER_UID)))
  })

  it('denies a create where payload uid does not match the doc id', async () => {
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'members', USER_UID), { ...pendingRequest(USER_UID), uid: OTHER_UID }),
    )
  })

  it('denies self-creating directly as approved (no self-approve)', async () => {
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'members', USER_UID), { ...pendingRequest(USER_UID), status: 'approved' }),
    )
  })

  it('denies a create that stamps decidedBy/decidedAt', async () => {
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'members', USER_UID), {
        ...pendingRequest(USER_UID),
        decidedBy: USER_UID,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an unauthenticated create', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'members', USER_UID), pendingRequest(USER_UID)))
  })
})

describe('members — non-admin may never approve', () => {
  it('denies the owner flipping their own status to approved', async () => {
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'members', USER_UID), { status: 'approved' }))
  })

  it('denies a non-admin changing another user status to approved', async () => {
    await seedMember(OTHER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'members', OTHER_UID), { status: 'approved' }))
  })

  it('denies the owner self-approving even by stamping decidedBy/decidedAt', async () => {
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'members', USER_UID), {
        status: 'approved',
        decidedBy: USER_UID,
        decidedAt: Timestamp.now(),
      }),
    )
  })
})

describe('members — owner re-request after rejection', () => {
  it('allows a rejected owner to re-request (rejected -> pending)', async () => {
    await seedMember(USER_UID, 'rejected')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'members', USER_UID), {
        status: 'pending',
        decidedAt: null,
        decidedBy: null,
      }),
    )
  })

  it('denies a pending owner re-requesting (only rejected -> pending allowed)', async () => {
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    // No-op-ish self update from pending is not the sanctioned re-request path.
    await assertFails(
      updateDoc(doc(db, 'members', USER_UID), { status: 'pending', requestedAt: Timestamp.now() }),
    )
  })

  it('denies an approved owner downgrading/altering their own status', async () => {
    await seedMember(USER_UID, 'approved')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'members', USER_UID), { status: 'pending' }))
  })
})

describe('members — admin decisions', () => {
  it('allows an admin to approve a pending request (stamping themselves)', async () => {
    await seedAdmin(ADMIN_UID)
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, ADMIN_UID, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'members', USER_UID), {
        status: 'approved',
        decidedBy: ADMIN_UID,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('allows an admin to reject a pending request', async () => {
    await seedAdmin(ADMIN_UID)
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, ADMIN_UID, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'members', USER_UID), {
        status: 'rejected',
        decidedBy: ADMIN_UID,
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an admin decision that stamps someone else as the decider', async () => {
    await seedAdmin(ADMIN_UID)
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, ADMIN_UID, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'members', USER_UID), {
        status: 'approved',
        decidedBy: 'someone-else',
        decidedAt: Timestamp.now(),
      }),
    )
  })

  it('denies an admin decision that omits decidedAt', async () => {
    await seedAdmin(ADMIN_UID)
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, ADMIN_UID, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'members', USER_UID), { status: 'approved', decidedBy: ADMIN_UID }),
    )
  })
})

describe('members — read access', () => {
  it('allows the owner to read their own member doc', async () => {
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'members', USER_UID)))
  })

  it("denies a non-admin reading another user's member doc", async () => {
    await seedMember(OTHER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(getDoc(doc(db, 'members', OTHER_UID)))
  })

  it('allows an admin to read any member doc', async () => {
    await seedAdmin(ADMIN_UID)
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, ADMIN_UID, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'members', USER_UID)))
  })
})

describe('members — delete', () => {
  it('denies a non-admin owner deleting their own member doc', async () => {
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, USER_UID, MEMBER_EMAIL)
    await assertFails(deleteDoc(doc(db, 'members', USER_UID)))
  })

  it('allows an admin to delete a member doc', async () => {
    await seedAdmin(ADMIN_UID)
    await seedMember(USER_UID, 'pending')
    const db = authedAs(env, ADMIN_UID, MEMBER_EMAIL)
    await assertSucceeds(deleteDoc(doc(db, 'members', USER_UID)))
  })
})
