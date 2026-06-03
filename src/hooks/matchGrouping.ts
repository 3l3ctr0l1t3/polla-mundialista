/**
 * Pure helpers for presenting matches — shared by the Fixtures page and tests.
 *
 * Kept separate from the React hooks so they can be unit-tested and reused without
 * a Firestore subscription.
 */
import dayjs from 'dayjs'
import type { Match, Team } from '../shared/types'

/**
 * A football-data.org knockout fixture references placeholder teams before the
 * bracket is decided. We treat a team as "TBD" when it has no real id (<= 0) or a
 * blank display name.
 */
export function isTbdTeam(team: Team | null | undefined): boolean {
  if (!team) return true
  if (typeof team.id === 'number' && team.id > 0) return false
  return !team.name || team.name.trim().length === 0
}

export interface MatchDayGroup {
  /** Stable key (YYYY-MM-DD in local time). */
  dayKey: string
  /** Human label, e.g. "Thu, Jun 11". */
  label: string
  matches: Match[]
}

/**
 * Group matches by local-time calendar day, preserving ascending kickoff order
 * within each day and across days.
 */
export function groupMatchesByDay(matches: Match[]): MatchDayGroup[] {
  const ordered = [...matches].sort((a, b) => a.kickoff.toMillis() - b.kickoff.toMillis())
  const groups = new Map<string, MatchDayGroup>()

  for (const match of ordered) {
    const d = dayjs(match.kickoff.toDate())
    const dayKey = d.format('YYYY-MM-DD')
    let group = groups.get(dayKey)
    if (!group) {
      group = { dayKey, label: d.format('ddd, MMM D'), matches: [] }
      groups.set(dayKey, group)
    }
    group.matches.push(match)
  }

  return [...groups.values()]
}
