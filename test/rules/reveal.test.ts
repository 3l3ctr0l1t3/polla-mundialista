import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
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

// Ticket 013 — reveal predictions at kickoff. Covers acceptance rule 2:
//   - a group member is DENIED reading another member's prediction for a match whose
//     kickoff is in the FUTURE;
//   - the SAME read SUCCEEDS once the match kickoff is in the PAST;
//   - a member can ALWAYS read their OWN prediction (future or past kickoff);
//   - a non-member is denied either way.
// The reveal read uses the GLOBAL matches/{matchId}.kickoff vs server request.time —
// never a client clock.

let env: RulesTestEnvironment

const OWNER_A = 'user-ownerA'
const ALICE = 'user-alice' // approved member of group A
const BOB = 'user-bob' // outsider (no member doc in A)

const GROUP_A = 'groupA'

const predId = (uid: string, matchId: string) => `${uid}_${matchId}`

function groupPayload(gid: string, ownerUid: string) {
  return {
    groupId: gid,
    name: `Pool ${gid}`,
    ownerUid,
    ownerName: 'Owner A',
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

/** Seed a group + member doc + a prediction, rules disabled (simulates real state). */
async function seedGroup(gid: string, ownerUid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', gid), groupPayload(gid, ownerUid))
  })
}

async function seedMember(
  gid: string,
  uid: string,
  status: 'pending' | 'approved' | 'rejected',
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', gid, 'members', uid), {
      uid,
      displayName: 'Member',
      email: MEMBER_EMAIL,
      photoURL: null,
      role: 'member',
      status,
      requestedAt: Timestamp.now(),
      decidedAt: status === 'pending' ? null : Timestamp.now(),
      decidedBy: status === 'pending' ? null : OWNER_A,
    })
  })
}

async function seedPrediction(gid: string, uid: string, matchId: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'groups', gid, 'predictions', predId(uid, matchId)),
      validPred(uid, matchId),
    )
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
  // Group A: owner + an approved member (Alice). Predictions exist for both
  // the future-kickoff match and the past-kickoff match.
  await seedGroup(GROUP_A, OWNER_A)
  await seedMember(GROUP_A, ALICE, 'approved')
  await seedPrediction(GROUP_A, OWNER_A, MATCH_ID) // another member's, future kickoff
  await seedPrediction(GROUP_A, OWNER_A, PAST_MATCH_ID) // another member's, past kickoff
  await seedPrediction(GROUP_A, ALICE, MATCH_ID) // Alice's own, future kickoff
  await seedPrediction(GROUP_A, ALICE, PAST_MATCH_ID) // Alice's own, past kickoff
})

describe('reveal predictions at kickoff (ticket 013)', () => {
  it("denies a member reading another member's prediction BEFORE kickoff", async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID))),
    )
  })

  it("allows a member reading another member's prediction AFTER kickoff", async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, PAST_MATCH_ID))),
    )
  })

  it('allows a member reading their OWN prediction before kickoff', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))),
    )
  })

  it('allows a member reading their OWN prediction after kickoff', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, PAST_MATCH_ID))),
    )
  })

  it("denies a non-member reading another's prediction BEFORE kickoff", async () => {
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, MATCH_ID))),
    )
  })

  it("denies a non-member reading another's prediction AFTER kickoff", async () => {
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(OWNER_A, PAST_MATCH_ID))),
    )
  })

  it('the group owner can read a member prediction after kickoff', async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertSucceeds(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, PAST_MATCH_ID))),
    )
  })

  it("the group owner is denied a member's prediction before kickoff", async () => {
    const db = authedAs(env, OWNER_A, MEMBER_EMAIL)
    await assertFails(
      getDoc(doc(db, 'groups', GROUP_A, 'predictions', predId(ALICE, MATCH_ID))),
    )
  })
})
