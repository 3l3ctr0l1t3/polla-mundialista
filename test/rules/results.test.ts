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

beforeAll(async () => {
  env = await makeTestEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore()
    await setDoc(doc(adb, 'matches', '529001'), {
      matchId: '529001',
      kickoff: Timestamp.now(),
      status: 'TIMED',
    })
    await setDoc(doc(adb, 'leaderboard', UID), { uid: UID, totalPoints: 0 })
    await setDoc(doc(adb, 'standings', 'A'), { groupId: 'A', table: [] })
    await setDoc(doc(adb, 'config', 'scoring'), {
      exact: 5,
      outcome: 3,
      goalDiffBonus: 1,
    })
  })
})

describe('two-writers rule — clients may read but never write public collections', () => {
  const cases: Array<{ name: string; path: [string, string] }> = [
    { name: 'matches', path: ['matches', '529001'] },
    { name: 'leaderboard', path: ['leaderboard', UID] },
    { name: 'standings', path: ['standings', 'A'] },
    { name: 'config', path: ['config', 'scoring'] },
  ]

  for (const c of cases) {
    it(`allows an authenticated client to READ ${c.name}`, async () => {
      const db = authedAs(env, UID, MEMBER_EMAIL)
      await assertSucceeds(getDoc(doc(db, c.path[0], c.path[1])))
    })

    it(`denies an authenticated client WRITING ${c.name}`, async () => {
      const db = authedAs(env, UID, MEMBER_EMAIL)
      await assertFails(setDoc(doc(db, c.path[0], c.path[1]), { hacked: true }))
    })
  }

  it('denies an unauthenticated read of matches', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'matches', '529001')))
  })

  it('denies creating a brand-new match doc', async () => {
    const db = authedAs(env, UID, MEMBER_EMAIL)
    await assertFails(
      setDoc(doc(db, 'matches', '999999'), {
        matchId: '999999',
        kickoff: Timestamp.now(),
        status: 'TIMED',
      }),
    )
  })
})
