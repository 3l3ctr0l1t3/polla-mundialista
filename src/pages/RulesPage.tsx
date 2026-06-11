/**
 * RulesPage — the read-only "Rules" group tab (ticket 026).
 *
 * Explains, in one place, exactly how THIS group works: its EFFECTIVE scoring
 * config (via the shared `<ScoringRules />`) and when predictions lock, driven by
 * the group's effective mode (`effectiveMode(group)` — absent ⇒ lazy):
 *   - lazy   ⇒ each match locks 10 min before its own kickoff,
 *   - strict ⇒ all group-stage picks lock 10 min before the first cup match, and
 *              all knockout picks lock 10 min before the first knockout match.
 *
 * Purely presentational + read-only: it never writes. The lock copy is
 * time-agnostic (explanatory, not a live countdown); the real lock is enforced
 * server-side in `firestore.rules`.
 */
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { ScoringRules } from '../components/ScoringRules'
import { useGroup } from '../group/useGroup'
import { effectiveMode } from '../shared/predictionLock'

export function RulesPage() {
  const { t } = useTranslation()
  const { group } = useGroup()
  const mode = effectiveMode(group ?? {})

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        {t('rules.title')}
      </Typography>

      {/* Scoring section */}
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        {t('rules.scoringTitle')}
      </Typography>
      <ScoringRules />

      {/* Prediction lock section */}
      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1 }}>
        {t('rules.lockTitle')}
      </Typography>
      <Stack spacing={1}>
        <Typography variant="subtitle2">
          {t('rules.mode', {
            mode: mode === 'strict' ? t('admin.modeStrict') : t('admin.modeLazy'),
          })}
        </Typography>
        {mode === 'strict' ? (
          <>
            <Typography variant="body2">{t('rules.strictGroupLock')}</Typography>
            <Typography variant="body2">{t('rules.strictKnockoutLock')}</Typography>
          </>
        ) : (
          <Typography variant="body2">{t('rules.lazyLock')}</Typography>
        )}
      </Stack>
    </Box>
  )
}

export default RulesPage
