/**
 * Locale-aware team-name resolution (ticket 020).
 *
 * The ONE place that decides what string to show for a team:
 *   1. undecided slot (TBD) → the localized placeholder ("Por definir" / "TBD")
 *   2. language is Spanish AND a Spanish entry exists for the team's `tla` → the Spanish name
 *   3. otherwise → the original football-data English `team.name` (never blank, never a crash)
 *
 * Display-only: stored team data (written solely by the ingestion service account) is never
 * touched — see the constitution's two-writers rule. Every render site of a team's display
 * name funnels through `useTeamName()` so the rule lives in exactly one module.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Team } from '../shared/types'
import { isTbdTeam } from '../hooks/matchGrouping'
import { useTbdLabel } from '../components/useTbdLabel'
import { countryNamesEs } from './countryNamesEs'

/** True when the (possibly region-qualified) language tag is Spanish, e.g. `es`, `es-CO`. */
function isSpanish(lang: string | undefined): boolean {
  return (lang ?? '').toLowerCase().split('-')[0] === 'es'
}

/**
 * Pure resolver — testable without React. `tbdLabel` is the already-localized placeholder
 * (callers pass `t('match.tbd')`), so this stays free of any i18n dependency.
 */
export function localizeTeamName(team: Team, lang: string | undefined, tbdLabel: string): string {
  if (isTbdTeam(team)) return tbdLabel
  if (isSpanish(lang)) {
    const es = countryNamesEs[(team.tla ?? '').toUpperCase()]
    if (es) return es
  }
  return team.name
}

/**
 * Hook returning a stable `(team) => string` resolver bound to the current language and
 * localized TBD placeholder. Re-renders (and thus a fresh resolver) follow the live language
 * switch via `react-i18next`, so names update without a page reload.
 */
export function useTeamName(): (team: Team) => string {
  const { i18n } = useTranslation()
  const tbdLabel = useTbdLabel()
  const lang = i18n.resolvedLanguage ?? i18n.language
  return useCallback((team: Team) => localizeTeamName(team, lang, tbdLabel), [lang, tbdLabel])
}
