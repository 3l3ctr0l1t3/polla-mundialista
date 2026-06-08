/**
 * Localized "team to be decided" placeholder (ticket 017).
 *
 * Lives in its own module (not `MatchTeams.tsx`) so that component file only exports
 * React components — satisfying `react-refresh/only-export-components`. Consumers
 * (MatchCard / PredictionCard / MatchTeams) build aria-labels from the localized value
 * rather than embedding English.
 */
import { useTranslation } from 'react-i18next'

/** The i18n key for the "TBD" placeholder. */
export const TBD_LABEL = 'match.tbd'

/** Hook returning the localized "TBD" placeholder for the current language. */
export function useTbdLabel(): string {
  const { t } = useTranslation()
  return t(TBD_LABEL)
}
