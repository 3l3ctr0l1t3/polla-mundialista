import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import { makeTestEnv, authedAs, MEMBER_EMAIL } from './helpers'

let env: RulesTestEnvironment
const UID = 'user-alice'
const OTHER_UID = 'user-bob'

function profile(uid: string) {
  return {
    uid,
    displayName: 'Alice',
    email: MEMBER_EMAIL,
    photoURL: null,
    isAdmin: false,
    createdAt: Timestamp.now(),
  }
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

describe('users — ownership', () => {
  it('allows a user to create their own profile', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(setDoc(doc(db, 'users', UID), profile(UID)))
  })

  it("denies creating another user's profile", async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(setDoc(doc(db, 'users', OTHER_UID), profile(OTHER_UID)))
  })

  it('allows reading own profile and denies reading another', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', UID), profile(UID))
      await setDoc(doc(ctx.firestore(), 'users', OTHER_UID), profile(OTHER_UID))
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'users', UID)))
    await assertFails(getDoc(doc(db, 'users', OTHER_UID)))
  })

  it('allows an update that does not touch isAdmin', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(setDoc(doc(db, 'users', UID), profile(UID)))
    await assertSucceeds(setDoc(doc(db, 'users', UID), { ...profile(UID), displayName: 'Alicia' }))
  })
})

describe('users — isAdmin may never be set by a client', () => {
  it('denies creating a profile with isAdmin true', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(setDoc(doc(db, 'users', UID), { ...profile(UID), isAdmin: true }))
  })

  it('denies escalating isAdmin on update', async () => {
    // Seed a non-admin profile with rules disabled, then try to flip the flag.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', UID), profile(UID))
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(setDoc(doc(db, 'users', UID), { ...profile(UID), isAdmin: true }))
  })

  it('denies deleting own profile', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', UID), profile(UID))
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    const { deleteDoc } = await import('firebase/firestore')
    await assertFails(deleteDoc(doc(db, 'users', UID)))
  })
})
