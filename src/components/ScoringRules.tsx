/**
 * ScoringRules — the localized "How points work" content (ticket 026).
 *
 * Presentational + read-only: it explains the current group's EFFECTIVE scoring
 * config (`effectiveScoring(group)` — the group's optional override merged over
 * `DEFAULT_SCORING`) as three sections:
 *   - the base tiers (exact / outcome / goal-diff bonus, noting an exact totals 6),
 *   - the per-round bonus table (stage → +N), and
 *   - the tie-break order (points → exact → outcomes → who joined first).
 *
 * Extracted from the old `ScoringExplainer` dialog body so the Rules tab and any
 * future surface share ONE source of this markup. No dialog chrome; never writes.
 * All copy comes from `t('scoring.*')`.
 */
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { useTranslation } from 'react-i18next'
import { effectiveScoring, type ScoringConfig } from '../shared/scoring'
import { useGroup } from '../group/useGroup'

/** The seven scoring stages, paired with their `scoring.*` label key, in display order. */
const STAGE_ROWS: { stage: string; labelKey: string }[] = [
  { stage: 'GROUP_STAGE', labelKey: 'scoring.stageGroup' },
  { stage: 'LAST_32', labelKey: 'scoring.stageRoundOf32' },
  { stage: 'LAST_16', labelKey: 'scoring.stageRoundOf16' },
  { stage: 'QUARTER_FINALS', labelKey: 'scoring.stageQuarterFinals' },
  { stage: 'SEMI_FINALS', labelKey: 'scoring.stageSemiFinals' },
  { stage: 'THIRD_PLACE', labelKey: 'scoring.stageThirdPlace' },
  { stage: 'FINAL', labelKey: 'scoring.stageFinal' },
]

export interface ScoringRulesProps {
  /** Optional explicit config (for testing). Defaults to the current group's effective config. */
  cfg?: ScoringConfig
}

export function ScoringRules({ cfg: cfgProp }: ScoringRulesProps = {}) {
  const { t } = useTranslation()
  const { group } = useGroup()
  const cfg = cfgProp ?? effectiveScoring(group ?? {})
  const exactTotal = cfg.exact + cfg.goalDiffBonus

  return (
    <Box>
      {/* Base tiers */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('scoring.baseTiersTitle')}
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="body2">{t('scoring.exactRow', { points: cfg.exact })}</Typography>
        <Typography variant="body2">{t('scoring.outcomeRow', { points: cfg.outcome })}</Typography>
        <Typography variant="body2">
          {t('scoring.goalDiffRow', { points: cfg.goalDiffBonus })}
        </Typography>
        {cfg.goalDiffOnlyOnCorrectOutcome && (
          <Typography variant="caption" color="text.secondary">
            {t('scoring.goalDiffNote')}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('scoring.exactNote', { total: exactTotal })}
        </Typography>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Round bonuses */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {t('scoring.roundBonusTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {t('scoring.roundBonusDescription')}
      </Typography>
      <Table size="small" aria-label={t('scoring.roundBonusTitle')}>
        <TableBody>
          {STAGE_ROWS.map(({ stage, labelKey }) => (
            <TableRow key={stage}>
              <TableCell sx={{ border: 0, py: 0.25 }}>
                <Typography variant="body2">{t(labelKey)}</Typography>
              </TableCell>
              <TableCell align="right" sx={{ border: 0, py: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('scoring.bonusValue', { points: cfg.roundBonus[stage] ?? 0 })}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Divider sx={{ my: 2 }} />

      {/* Tie-breakers */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {t('scoring.tieBreakTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {t('scoring.tieBreakDescription')}
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 3 }}>
        <Typography component="li" variant="body2">
          {t('scoring.tieBreak1')}
        </Typography>
        <Typography component="li" variant="body2">
          {t('scoring.tieBreak2')}
        </Typography>
        <Typography component="li" variant="body2">
          {t('scoring.tieBreak3')}
        </Typography>
        <Typography component="li" variant="body2">
          {t('scoring.tieBreak4')}
        </Typography>
      </Box>
    </Box>
  )
}

export default ScoringRules
