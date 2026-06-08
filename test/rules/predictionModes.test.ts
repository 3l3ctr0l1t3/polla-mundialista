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
  seedTournamentConfig,
  minutesFromNow,
  tsMinutesFromNow,
  MEMBER_EMAIL,
  OUTSIDER_EMAIL,
} from './helpers'

// Ticket 019 — group prediction modes (Lazy vs Strict) + the uniform 10-minute
// pre-kickoff buffer. All locking uses SERVER request.time against the GLOBAL
// matches/{matchId} doc and the GLOBAL config/tournament doc. Cutoffs/kickoffs are
// expressed as offsets in MINUTES vs the real `now`, so seed↔assert latency is
// negligible against the 10-minute buffer. Covers acceptance rules 1–10 plus the
// non-owner-admin non-mode-field denial.

let env: RulesTestEnvironment

const OWNER = 'user-owner'
const ALICE = 'user-alice' // approved ordinary member
const ADMIN_MEMBER = 'user-adminmember' // approved member, role 'admin'
const BOB = 'user-bob' // outsider

// Match ids, keyed by stage. Their OWN kickoffs are far in the future so that in a
// STRICT group the per-match kickoff never accidentally drives the lock — only the
// config/tournament window does.
const GS_MATCH = 'gs-match' // GROUP_STAGE, own kickoff +5 days
const KO_MATCH = 'ko-match' // LAST_32 (knockout), own kickoff weeks out

const predId = (uid: string, matchId: string) => `${uid}_${matchId}`

function groupPayload(gid: string, ownerUid: string, mode?: 'lazy' | 'strict') {
  const base = {
    groupId: gid,
    name: `Pool ${gid}`,
    ownerUid,
    ownerName: 'Owner',
    ownerPhotoURL: null,
    inviteCode: `code-${gid}`,
    createdAt: Timestamp.now(),
  }
  return mode ? { ...base, mode } : base
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

/** Seed a group doc (optionally with a mode), rules disabled. */
async function seedGroup(gid: string, ownerUid: string, mode?: 'lazy' | 'strict') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', gid), groupPayload(gid, ownerUid, mode))
  })
}

/** Seed an approved member doc with the given role. */
async function seedMember(gid: string, uid: string, role: 'admin' | 'member') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', gid, 'members', uid), {
      uid,
      displayName: 'Member',
      email: MEMBER_EMAIL,
      photoURL: null,
      role,
      status: 'approved',
      requestedAt: Timestamp.now(),
      decidedAt: Timestamp.now(),
      decidedBy: OWNER,
    })
  })
}

/** Seed a GLOBAL match with a stage and a kickoff `kickoffMin` minutes from now. */
async function seedMatch(matchId: string, stage: string, kickoffMin: number) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'matches', matchId), {
      matchId,
      stage,
      kickoff: tsMinutesFromNow(kickoffMin),
      status: 'TIMED',
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
  // GLOBAL matches with far-future own kickoffs so strict windows (not per-match
  // kickoff) drive the lock. 5 days = 7200 min; ~5 weeks = 50000 min.
  await seedMatch(GS_MATCH, 'GROUP_STAGE', 7200)
  await seedMatch(KO_MATCH, 'LAST_32', 50000)
})

/* ----------------------------------------------------------- AR1: legacy default */

describe('prediction modes — mode-less group behaves as lazy (AR1)', () => {
  beforeEach(async () => {
    await seedGroup('g-legacy', OWNER) // no mode field
    await seedMember('g-legacy', ALICE, 'member')
  })

  it('ALLOWS a create when the match kickoff is now+11m', async () => {
    // GS_MATCH own kickoff is far future; for a mode-less (lazy) group that IS the lock.
    // Override with a near match whose kickoff is now+11m.
    await seedMatch('m-soon', 'GROUP_STAGE', 11)
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', 'g-legacy', 'predictions', predId(ALICE, 'm-soon')),
        validPred(ALICE, 'm-soon'),
      ),
    )
  })

  it('DENIES a create when the match kickoff is now+9m (inside the 10-min buffer)', async () => {
    await seedMatch('m-imminent', 'GROUP_STAGE', 9)
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', 'g-legacy', 'predictions', predId(ALICE, 'm-imminent')),
        validPred(ALICE, 'm-imminent'),
      ),
    )
  })
})

/* ------------------------------------------------- AR2/AR3: explicit lazy group */

describe('prediction modes — lazy group, per-match 10-min buffer (AR2/AR3)', () => {
  beforeEach(async () => {
    await seedGroup('g-lazy', OWNER, 'lazy')
    await seedMember('g-lazy', ALICE, 'member')
  })

  it('ALLOWS a create at kickoff now+11m (AR2)', async () => {
    await seedMatch('m-soon', 'GROUP_STAGE', 11)
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', 'g-lazy', 'predictions', predId(ALICE, 'm-soon')),
        validPred(ALICE, 'm-soon'),
      ),
    )
  })

  it('DENIES a create at kickoff now+9m (AR3)', async () => {
    await seedMatch('m-imminent', 'GROUP_STAGE', 9)
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', 'g-lazy', 'predictions', predId(ALICE, 'm-imminent')),
        validPred(ALICE, 'm-imminent'),
      ),
    )
  })

  it('DENIES a create at kickoff now-1m (already kicked off) (AR3)', async () => {
    await seedMatch('m-past', 'GROUP_STAGE', -1)
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', 'g-lazy', 'predictions', predId(ALICE, 'm-past')),
        validPred(ALICE, 'm-past'),
      ),
    )
  })
})

/* ----------------------------------- AR4/AR5: strict group, GROUP_STAGE window */

describe('prediction modes — strict group, GROUP_STAGE window (AR4/AR5)', () => {
  beforeEach(async () => {
    await seedGroup('g-strict', OWNER, 'strict')
    await seedMember('g-strict', ALICE, 'member')
  })

  it('ALLOWS a GROUP_STAGE prediction when firstCupMatchKickoff is now+11m (AR4)', async () => {
    // The match's OWN kickoff (GS_MATCH) is +5 days; the window cutoff drives the lock.
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(11),
      firstKnockoutKickoff: minutesFromNow(50000),
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', 'g-strict', 'predictions', predId(ALICE, GS_MATCH)),
        validPred(ALICE, GS_MATCH),
      ),
    )
  })

  it('DENIES a GROUP_STAGE prediction when firstCupMatchKickoff is now+9m, despite far-future own kickoff (AR5)', async () => {
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(9),
      firstKnockoutKickoff: minutesFromNow(50000),
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', 'g-strict', 'predictions', predId(ALICE, GS_MATCH)),
        validPred(ALICE, GS_MATCH),
      ),
    )
  })
})

/* ------------------------------------- AR6/AR7: strict group, knockout window */

describe('prediction modes — strict group, knockout window (AR6/AR7)', () => {
  beforeEach(async () => {
    await seedGroup('g-strict', OWNER, 'strict')
    await seedMember('g-strict', ALICE, 'member')
  })

  it('ALLOWS a LAST_32 prediction when firstKnockoutKickoff is now+11m even though the match is weeks out (AR6)', async () => {
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(-100), // group window long closed
      firstKnockoutKickoff: minutesFromNow(11),
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(
        doc(db, 'groups', 'g-strict', 'predictions', predId(ALICE, KO_MATCH)),
        validPred(ALICE, KO_MATCH),
      ),
    )
  })

  it('DENIES a LAST_32 prediction when firstKnockoutKickoff is now+9m, match still unkicked (AR7)', async () => {
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(-100),
      firstKnockoutKickoff: minutesFromNow(9),
    })
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(
      setDoc(
        doc(db, 'groups', 'g-strict', 'predictions', predId(ALICE, KO_MATCH)),
        validPred(ALICE, KO_MATCH),
      ),
    )
  })
})

/* --------------------------------------------- AR8: mode write authority */

describe('prediction modes — mode write authority (AR8)', () => {
  beforeEach(async () => {
    await seedGroup('g-mode', OWNER, 'lazy')
    await seedMember('g-mode', ALICE, 'member') // ordinary approved member
    await seedMember('g-mode', ADMIN_MEMBER, 'admin') // role admin
    // Freeze instant well in the future → mode is changeable.
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(60),
      firstKnockoutKickoff: minutesFromNow(50000),
    })
  })

  it('DENIES a non-admin approved member changing mode', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g-mode'), { mode: 'strict' }))
  })

  it('ALLOWS the owner changing mode before the freeze', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g-mode'), { mode: 'strict' }))
  })

  it('ALLOWS a role:admin member changing mode before the freeze', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g-mode'), { mode: 'strict' }))
  })
})

/* --------------------------------------- AR9: mode immutability after freeze */

describe('prediction modes — mode immutability after freeze (AR9)', () => {
  beforeEach(async () => {
    await seedGroup('g-frozen', OWNER, 'lazy')
    await seedMember('g-frozen', ADMIN_MEMBER, 'admin')
    // freeze instant = firstCupMatchKickoff − 10min = now-1m ⇒ frozen.
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(9),
      firstKnockoutKickoff: minutesFromNow(50000),
    })
  })

  it('DENIES the owner changing mode at/after the freeze', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g-frozen'), { mode: 'strict' }))
  })

  it('DENIES a role:admin member changing mode at/after the freeze', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g-frozen'), { mode: 'strict' }))
  })
})

/* ------------------------------- non-owner admin: only `mode` is writable */

describe('prediction modes — non-owner admin confined to the mode field', () => {
  beforeEach(async () => {
    await seedGroup('g-confine', OWNER, 'lazy')
    await seedMember('g-confine', ADMIN_MEMBER, 'admin')
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(60),
      firstKnockoutKickoff: minutesFromNow(50000),
    })
  })

  it('DENIES a non-owner admin changing a NON-mode field (name)', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g-confine'), { name: 'Renamed by admin' }))
  })

  it('DENIES a non-owner admin changing mode AND name together', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g-confine'), { mode: 'strict', name: 'Renamed' }),
    )
  })

  it('ALLOWS the OWNER changing a non-mode field freely', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g-confine'), { name: 'Owner rename' }))
  })
})

/* ------------------------------------------- AR10: config/tournament access */

describe('prediction modes — config/tournament access (AR10)', () => {
  beforeEach(async () => {
    await seedTournamentConfig(env, {
      firstCupMatchKickoff: minutesFromNow(60),
      firstKnockoutKickoff: minutesFromNow(50000),
    })
  })

  it('ALLOWS any signed-in client to read config/tournament', async () => {
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertSucceeds(getDoc(doc(db, 'config', 'tournament')))
  })

  it('DENIES any client write to config/tournament', async () => {
    const db = authedAs(env, BOB, OUTSIDER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'config', 'tournament'), {
        firstCupMatchKickoff: tsMinutesFromNow(1),
        firstKnockoutKickoff: tsMinutesFromNow(2),
      }),
    )
  })
})
