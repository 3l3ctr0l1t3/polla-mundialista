import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'la-pollita-corp'

/** Parse `FIRESTORE_EMULATOR_HOST` (set by `firebase emulators:exec`) into host/port. */
function emulatorHostPort(): { host: string; port: number } {
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  const [host, port] = hostPort.split(':')
  return { host, port: Number(port) }
}

export async function makeTestEnv(): Promise<RulesTestEnvironment> {
  const { host, port } = emulatorHostPort()
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  })
}

/** A member email and a non-member email used across tests. */
export const MEMBER_EMAIL = 'member@example.com'
export const OUTSIDER_EMAIL = 'outsider@example.com'

/** Authenticated context whose token carries an email (so `isMember()` can be evaluated). */
export function authedAs(env: RulesTestEnvironment, uid: string, email: string) {
  return env.authenticatedContext(uid, { email, email_verified: true }).firestore()
}

/** A kickoff time in the future relative to `now`. */
export const FUTURE_KICKOFF = new Date('2026-07-01T18:00:00Z')
/** A kickoff time in the past relative to `now`. */
export const PAST_KICKOFF = new Date('2026-06-01T18:00:00Z')

export const MATCH_ID = '529001'
export const PAST_MATCH_ID = '529000'

// ---- relative-time helpers (ticket 019) ----------------------------------
// Offsets are expressed in MINUTES relative to the real `now` so that the
// (tiny, ms-scale) latency between seeding and the rules' `request.time`
// evaluation is negligible against the 10-minute buffer. `n` may be negative.

/** A JS Date at `now + n minutes` (n may be negative for the past). */
export function minutesFromNow(n: number): Date {
  return new Date(Date.now() + n * 60_000)
}

/** A Firestore Timestamp at `now + n minutes`. */
export function tsMinutesFromNow(n: number): Timestamp {
  return Timestamp.fromDate(minutesFromNow(n))
}

/**
 * Seed the GLOBAL `config/tournament` doc (admin-SDK-only in prod) with the two
 * strict-window cutoffs, using rules-disabled context. Accepts JS `Date`s.
 */
export async function seedTournamentConfig(
  env: RulesTestEnvironment,
  cutoffs: { firstCupMatchKickoff: Date; firstKnockoutKickoff: Date },
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config', 'tournament'), {
      firstCupMatchKickoff: Timestamp.fromDate(cutoffs.firstCupMatchKickoff),
      firstKnockoutKickoff: Timestamp.fromDate(cutoffs.firstKnockoutKickoff),
    })
  })
}
