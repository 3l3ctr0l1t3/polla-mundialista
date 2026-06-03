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

let env: RulesTestEnvironment

const UID = 'user-alice'
const OTHER_UID = 'user-bob'

const predId = (uid: string, matchId: string) => `${uid}_${matchId}`

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

beforeAll(async () => {
  env = await makeTestEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Seed matches + allowlist with rules disabled (simulates admin SDK / ingestion).
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
    await setDoc(doc(adb, 'config', 'allowlist'), {
      emails: [MEMBER_EMAIL],
    })
  })
})

describe('predictions — kickoff lock', () => {
  it('allows a member to create their own prediction BEFORE kickoff', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), validPred(UID, MATCH_ID)),
    )
  })

  it('rejects a prediction create AT/AFTER kickoff', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, PAST_MATCH_ID)), validPred(UID, PAST_MATCH_ID)),
    )
  })

  it('rejects an update once the match has kicked off', async () => {
    // Seed an existing prediction for a past match with rules disabled.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'predictions', predId(UID, PAST_MATCH_ID)),
        validPred(UID, PAST_MATCH_ID),
      )
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, PAST_MATCH_ID)), {
        ...validPred(UID, PAST_MATCH_ID),
        homeGoals: 3,
      }),
    )
  })

  it('allows an update while still before kickoff', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), validPred(UID, MATCH_ID)),
    )
    await assertSucceeds(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        homeGoals: 0,
        awayGoals: 0,
      }),
    )
  })
})

describe('predictions — ownership', () => {
  it("rejects writing a prediction with someone else's uid", async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    // uid in payload belongs to OTHER_UID — doc-id prefix mismatch too.
    await assertFails(
      setDoc(doc(db, 'predictions', predId(OTHER_UID, MATCH_ID)), validPred(OTHER_UID, MATCH_ID)),
    )
  })

  it('rejects a doc id whose prefix does not match the uid', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    // payload uid is correct, but doc id uses the wrong prefix.
    await assertFails(
      setDoc(doc(db, 'predictions', predId(OTHER_UID, MATCH_ID)), validPred(UID, MATCH_ID)),
    )
  })

  it('rejects a read of another user prediction', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'predictions', predId(OTHER_UID, MATCH_ID)),
        validPred(OTHER_UID, MATCH_ID),
      )
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(getDoc(doc(db, 'predictions', predId(OTHER_UID, MATCH_ID))))
  })

  it('allows a read of own prediction', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'predictions', predId(UID, MATCH_ID)),
        validPred(UID, MATCH_ID),
      )
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'predictions', predId(UID, MATCH_ID))))
  })
})

describe('predictions — membership (allowlist)', () => {
  it('rejects a non-member, even before kickoff', async () => {
    const db = authedAs(env, 'user-outsider', OUTSIDER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'predictions', predId('user-outsider', MATCH_ID)),
        validPred('user-outsider', MATCH_ID),
      ),
    )
  })

  it('rejects an unauthenticated write', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), validPred(UID, MATCH_ID)),
    )
  })
})

describe('predictions — anti-tampering & validation', () => {
  it('rejects a create that sets points', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        points: 5,
      }),
    )
  })

  it('rejects a create that sets breakdown', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        breakdown: { exact: 5, outcome: 3, goalDiff: 1 },
      }),
    )
  })

  it('rejects an update that introduces points', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), validPred(UID, MATCH_ID)),
    )
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        points: 999,
      }),
    )
  })

  it('rejects out-of-range goals (>30)', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        homeGoals: 31,
      }),
    )
  })

  it('rejects negative goals', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        awayGoals: -1,
      }),
    )
  })

  it('rejects non-integer goals', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, MATCH_ID)), {
        ...validPred(UID, MATCH_ID),
        homeGoals: 1.5,
      }),
    )
  })

  it('rejects a prediction for a non-existent match', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'predictions', predId(UID, '999999')), validPred(UID, '999999')),
    )
  })

  it('denies delete of own prediction', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'predictions', predId(UID, MATCH_ID)),
        validPred(UID, MATCH_ID),
      )
    })
    const db = authedAs(env, UID, MEMBER_EMAIL)
    const { deleteDoc } = await import('firebase/firestore')
    await assertFails(deleteDoc(doc(db, 'predictions', predId(UID, MATCH_ID))))
  })
})
