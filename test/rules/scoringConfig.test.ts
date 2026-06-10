import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  makeTestEnv,
  authedAs,
  seedTournamentConfig,
  minutesFromNow,
  MEMBER_EMAIL,
} from './helpers'

// Ticket 025 — per-group, admin-configurable scoring (`groups/{gid}.scoring`). The field
// mirrors `mode` (ticket 019): an admin-managed group setting, editable by the owner OR a
// non-owner group admin ONLY before the SAME freeze instant (firstCupMatchKickoff − 10min),
// frozen thereafter, and shape-validated so a client cannot write garbage. All time
// comparisons use SERVER request.time; cutoffs are offsets in MINUTES vs the real `now`, so
// seed↔assert latency is negligible against the 10-minute buffer. (AC3)

let env: RulesTestEnvironment

const OWNER = 'user-owner'
const ALICE = 'user-alice' // approved ordinary member (non-admin)
const ADMIN_MEMBER = 'user-adminmember' // approved member, role 'admin' (non-owner)

/** A complete, valid scoring object (the exact shape the admin editor writes). */
function validScoring() {
  return {
    exact: 5,
    outcome: 3,
    goalDiffBonus: 1,
    goalDiffOnlyOnCorrectOutcome: true,
    gradeOn: 'fullTime90',
    roundBonus: {
      GROUP_STAGE: 0,
      LAST_32: 0,
      LAST_16: 1,
      QUARTER_FINALS: 2,
      SEMI_FINALS: 3,
      FINAL: 4,
      THIRD_PLACE: 3,
    },
  }
}

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

/** Freeze instant well in the FUTURE ⇒ scoring/mode are changeable. */
async function seedConfigOpen() {
  await seedTournamentConfig(env, {
    firstCupMatchKickoff: minutesFromNow(60),
    firstKnockoutKickoff: minutesFromNow(50000),
  })
}

/** Freeze instant = firstCupMatchKickoff − 10min = now-1m ⇒ frozen. */
async function seedConfigFrozen() {
  await seedTournamentConfig(env, {
    firstCupMatchKickoff: minutesFromNow(9),
    firstKnockoutKickoff: minutesFromNow(50000),
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

/* --------------------------------------------- valid scoring write, pre-freeze */

describe('scoring config — valid write before the freeze', () => {
  beforeEach(async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedMember('g', ALICE, 'member')
    await seedMember('g', ADMIN_MEMBER, 'admin')
    await seedConfigOpen()
  })

  it('ALLOWS the owner writing a valid full scoring object', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g'), { scoring: validScoring() }))
  })

  it('ALLOWS a non-owner group admin writing ONLY a valid scoring object', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g'), { scoring: validScoring() }))
  })

  it('ALLOWS a non-owner admin changing mode AND scoring together', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertSucceeds(
      updateDoc(doc(db, 'groups', 'g'), { mode: 'strict', scoring: validScoring() }),
    )
  })
})

/* ------------------------------------------- scoring frozen at/after the freeze */

describe('scoring config — frozen at/after the freeze', () => {
  beforeEach(async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedMember('g', ADMIN_MEMBER, 'admin')
    await seedConfigFrozen()
  })

  it('DENIES the owner writing scoring after the freeze', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { scoring: validScoring() }))
  })

  it('DENIES a non-owner admin writing scoring after the freeze', async () => {
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { scoring: validScoring() }))
  })
})

/* ---------------------------------------------------- malformed scoring shapes */

describe('scoring config — malformed shapes are denied (pre-freeze)', () => {
  beforeEach(async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedConfigOpen()
  })

  it('DENIES a negative base value', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g'), { scoring: { ...validScoring(), exact: -1 } }),
    )
  })

  it('DENIES a negative roundBonus value', async () => {
    const s = validScoring()
    s.roundBonus.FINAL = -2
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { scoring: s }))
  })

  it('DENIES a non-integer (float) value', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g'), { scoring: { ...validScoring(), outcome: 1.5 } }),
    )
  })

  it('DENIES a missing roundBonus stage key', async () => {
    const s = validScoring()
    // drop one of the 7 required stage keys
    delete (s.roundBonus as Record<string, number>).THIRD_PLACE
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { scoring: s }))
  })

  it('DENIES an extra/unknown top-level key', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g'), { scoring: { ...validScoring(), surprise: 7 } }),
    )
  })

  it('DENIES a wrong gradeOn value', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g'), {
        scoring: { ...validScoring(), gradeOn: 'extraTime' },
      }),
    )
  })

  it('DENIES a non-bool goalDiffOnlyOnCorrectOutcome', async () => {
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g'), {
        scoring: { ...validScoring(), goalDiffOnlyOnCorrectOutcome: 'yes' },
      }),
    )
  })
})

/* ---------------------------------------- non-admin member cannot write scoring */

describe('scoring config — non-admin member denied', () => {
  beforeEach(async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedMember('g', ALICE, 'member') // approved, ordinary member
    await seedConfigOpen()
  })

  it('DENIES an approved non-admin member writing a valid scoring object', async () => {
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { scoring: validScoring() }))
  })
})

/* ------------------------------------------------------ ticket-019 regressions */

describe('scoring config — ticket-019 mode/membership invariants still hold', () => {
  it('ALLOWS the owner changing mode before the freeze', async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedConfigOpen()
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g'), { mode: 'strict' }))
  })

  it('DENIES the owner changing mode after the freeze', async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedConfigFrozen()
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { mode: 'strict' }))
  })

  it('ALLOWS the owner changing a non-mode/non-scoring field freely', async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedConfigOpen()
    const db = authedAs(env, OWNER, MEMBER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g'), { name: 'Owner rename' }))
  })

  it('DENIES a non-owner admin changing a NON-mode/non-scoring field (name)', async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedMember('g', ADMIN_MEMBER, 'admin')
    await seedConfigOpen()
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(updateDoc(doc(db, 'groups', 'g'), { name: 'Renamed by admin' }))
  })

  it('DENIES a non-owner admin changing scoring AND name together', async () => {
    await seedGroup('g', OWNER, 'lazy')
    await seedMember('g', ADMIN_MEMBER, 'admin')
    await seedConfigOpen()
    const db = authedAs(env, ADMIN_MEMBER, MEMBER_EMAIL)
    await assertFails(
      updateDoc(doc(db, 'groups', 'g'), { scoring: validScoring(), name: 'Renamed' }),
    )
  })

  it('ALLOWS a member self-request to join (membership invariant unchanged)', async () => {
    await seedGroup('g', OWNER, 'lazy')
    const db = authedAs(env, ALICE, MEMBER_EMAIL)
    await assertSucceeds(
      setDoc(doc(db, 'groups', 'g', 'members', ALICE), {
        uid: ALICE,
        displayName: 'Alice',
        email: MEMBER_EMAIL,
        photoURL: null,
        role: 'member',
        status: 'pending',
        requestedAt: Timestamp.now(),
      }),
    )
  })
})
