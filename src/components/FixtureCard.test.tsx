import type { ReactNode } from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme/theme'
import type { Match, Prediction, PredictionMode } from '../shared/types'
import type { ScoringConfig } from '../shared/scoring'
import type { TournamentCutoffsMs } from '../shared/predictionLock'

// --- mocks -----------------------------------------------------------------

const setDocMock = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve())

vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'SERVER_TS',
  setDoc: (...args: unknown[]) => setDocMock(...args),
}))

const groupPredictionDocMock = vi.fn((gid: string, uid: string, matchId: string) => ({
  __ref: `${gid}/${uid}_${matchId}`,
}))
vi.mock('../firebase/db', () => ({
  groupPredictionDoc: (gid: string, uid: string, matchId: string) =>
    groupPredictionDocMock(gid, uid, matchId),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.com' }, loading: false }),
}))

// Group context: default lazy (mode absent). The card reads `group.mode` via `effectiveMode`
// and `group.scoring` via `effectiveScoring` (ticket 025: absent ⇒ DEFAULT_SCORING).
const useGroupMock = vi.fn(
  (): { group: { mode: PredictionMode | undefined; scoring?: Partial<ScoringConfig> } } => ({
    group: { mode: undefined },
  }),
)
vi.mock('../group/useGroup', () => ({ useGroup: () => useGroupMock() }))

// Tournament cutoffs: default none (lazy fallback). Strict tests override.
const useTournamentConfigMock = vi.fn(
  (): { cutoffs: TournamentCutoffsMs | undefined; loading: boolean } => ({
    cutoffs: undefined,
    loading: false,
  }),
)
vi.mock('../hooks/useTournamentConfig', () => ({
  useTournamentConfig: () => useTournamentConfigMock(),
}))

// The reveal dialog is Firestore-backed and covered by its own tests; stub it to a
// recognizable marker that reflects its `open`/`kickedOff` props so this card test stays
// focused on the card.
const dialogMock = vi.fn<(p: { open: boolean; kickedOff: boolean }) => ReactNode>()
vi.mock('./MatchPredictionsDialog', () => ({
  MatchPredictionsDialog: (p: { open: boolean; kickedOff: boolean }) => dialogMock(p),
}))

// Imported after the mocks are registered.
import { FixtureCard } from './FixtureCard'

// --- fixtures --------------------------------------------------------------

const KICKOFF_MS = new Date('2026-06-11T20:00:00Z').getTime()
// Lazy lock fires 10 min before kickoff; straddle the lock instant, not raw kickoff.
const LOCK_MS = KICKOFF_MS - 10 * 60 * 1000
const beforeKickoff = () => LOCK_MS - 60_000 // window open
const afterKickoff = () => KICKOFF_MS + 60_000 // past kickoff (and the lock)

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'm42',
    kickoff: { toMillis: () => KICKOFF_MS, toDate: () => new Date(KICKOFF_MS) } as Match['kickoff'],
    status: 'TIMED',
    stage: 'GROUP_STAGE',
    group: 'A',
    homeTeam: { id: 1, name: 'Home', shortName: 'HOM', tla: 'HOM', crest: '' },
    awayTeam: { id: 2, name: 'Away', shortName: 'AWY', tla: 'AWY', crest: '' },
    score: { home: null, away: null, winner: null },
    lastUpdated: { toMillis: () => 0, toDate: () => new Date(0) } as Match['lastUpdated'],
    ...overrides,
  }
}

function existingPred(home: number, away: number): Prediction {
  return {
    uid: 'u1',
    matchId: 'm42',
    homeGoals: home,
    awayGoals: away,
    createdAt: { toMillis: () => 0 } as Prediction['createdAt'],
    updatedAt: { toMillis: () => 0 } as Prediction['updatedAt'],
  }
}

function renderCard(ui: ReactNode) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)
}

beforeEach(() => {
  setDocMock.mockClear()
  setDocMock.mockResolvedValue(undefined)
  groupPredictionDocMock.mockClear()
  dialogMock.mockReset()
  dialogMock.mockReturnValue(null)
  useGroupMock.mockReturnValue({ group: { mode: undefined } })
  useTournamentConfigMock.mockReturnValue({ cutoffs: undefined, loading: false })
})

describe('FixtureCard', () => {
  it('shows editable steppers + Save before kickoff (upcoming)', () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />)
    expect(screen.getByLabelText('HOM goals')).toHaveTextContent('0')
    expect(screen.getByLabelText('AWY goals')).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: /save prediction/i })).not.toBeDisabled()
    // No reveal button on an upcoming card.
    expect(screen.queryByRole('button', { name: /predictions/i })).toBeNull()
  })

  it('stacks each team name ABOVE its flag (name precedes flag in DOM, both teams)', () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />)
    // Flags have no crest in the fixture, so each Avatar renders the SportsSoccerIcon fallback.
    const [homeFlag, awayFlag] = screen.getAllByTestId('SportsSoccerIcon')
    const homeName = screen.getByText('Home')
    const awayName = screen.getByText('Away')
    // FOLLOWING = the flag comes after the name => name is stacked on top.
    expect(
      homeName.compareDocumentPosition(homeFlag) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      awayName.compareDocumentPosition(awayFlag) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Card keeps its accessible "X versus Y" label.
    expect(screen.getByLabelText('Home versus Away')).toBeInTheDocument()
    // Name carries its title attribute (hover / a11y) for both teams.
    expect(homeName).toHaveAttribute('title', 'Home')
    expect(awayName).toHaveAttribute('title', 'Away')
  })

  it('saves a new prediction with the right ref + shape on Save', async () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />)

    fireEvent.click(screen.getByLabelText('Increase HOM goals'))
    fireEvent.click(screen.getByLabelText('Increase HOM goals'))
    fireEvent.click(screen.getByLabelText('Increase AWY goals'))
    fireEvent.click(screen.getByRole('button', { name: /save prediction/i }))

    await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1))
    const [ref, payload, options] = setDocMock.mock.calls[0]
    expect(groupPredictionDocMock).toHaveBeenCalledWith('g1', 'u1', 'm42')
    expect(ref).toEqual({ __ref: 'g1/u1_m42' })
    expect(payload).toEqual({
      uid: 'u1',
      matchId: 'm42',
      homeGoals: 2,
      awayGoals: 1,
      updatedAt: 'SERVER_TS',
      createdAt: 'SERVER_TS',
    })
    expect(options).toEqual({ merge: true })
  })

  it('swaps the dead inputs for the locked read-only state at/after the lock (ticket 027)', () => {
    renderCard(<FixtureCard gid="g1" match={makeMatch()} now={afterKickoff} />)
    // No steppers and no Save once locked — the reveal action replaces them.
    expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
    expect(screen.queryByLabelText('Increase AWY goals')).toBeNull()
    expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
    expect(screen.getByRole('button', { name: /predictions/i })).toBeInTheDocument()
  })

  it('shows the score + the viewer own prediction (no steppers) when finished', () => {
    const match = makeMatch({
      status: 'FINISHED',
      score: { home: 2, away: 1, winner: 'HOME_TEAM' },
    })
    renderCard(
      <FixtureCard gid="g1" match={match} existing={existingPred(1, 0)} now={afterKickoff} />,
    )
    // Result score is shown.
    expect(screen.getByLabelText('Score 2 to 1')).toBeInTheDocument()
    // Viewer's own prediction is surfaced.
    expect(screen.getByText(/Your prediction 1–0/)).toBeInTheDocument()
    // No editable steppers on a finished card.
    expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
    expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
  })

  it('opens the reveal dialog (kicked off) by clicking the finished CARD (ticket 032)', () => {
    const match = makeMatch({ status: 'FINISHED', score: { home: 0, away: 0, winner: 'DRAW' } })
    renderCard(<FixtureCard gid="g1" match={match} now={afterKickoff} />)

    // Dialog rendered closed initially with kickedOff true (now > kickoff).
    expect(dialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: false, kickedOff: true }),
    )
    // Ticket 032: the finished card has NO button row — the whole card is the
    // accessible click affordance (CardActionArea with a localized label).
    fireEvent.click(screen.getByRole('button', { name: 'See group predictions for this match' }))
    expect(dialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, kickedOff: true }),
    )
  })

  it('passes kickedOff=false to the dialog for a not-yet-started in-play card', () => {
    // A live match that the viewer clock thinks hasn't kicked off yet: reveal stays gated.
    const match = makeMatch({ status: 'IN_PLAY', score: { home: 0, away: 0, winner: null } })
    renderCard(<FixtureCard gid="g1" match={match} now={beforeKickoff} />)
    expect(dialogMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: false, kickedOff: false }),
    )
  })

  // --- ticket 027: locked-but-not-kicked-off (lazy window) — spec rules 2 + 4 ----------

  describe('locked, not kicked off (lazy window)', () => {
    // Inside the lazy locked window: past `kickoff − 10min`, before kickoff itself.
    const duringLockedWindow = () => KICKOFF_MS - 5 * 60 * 1000

    it('renders no steppers and no Save — only the reveal button (rule 2)', () => {
      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={duringLockedWindow} />)
      expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /update prediction/i })).toBeNull()
      expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
      expect(screen.queryByLabelText('Decrease HOM goals')).toBeNull()
      expect(screen.queryByLabelText('HOM goals')).toBeNull()
      expect(screen.getByRole('button', { name: /predictions/i })).toBeInTheDocument()
      // Top-right keeps the countdown component, now showing its "Locked" chip.
      expect(screen.getByText('Locked')).toBeInTheDocument()
    })

    it('opens the dialog still gated pre-kickoff (kickedOff: false → placeholder, no query)', () => {
      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={duringLockedWindow} />)
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: false, kickedOff: false }),
      )
      fireEvent.click(screen.getByRole('button', { name: /predictions/i }))
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, kickedOff: false }),
      )
    })

    it('shows the viewer own pick read-only on the card (rule 4)', () => {
      renderCard(
        <FixtureCard
          gid="g1"
          match={makeMatch()}
          existing={existingPred(2, 1)}
          now={duringLockedWindow}
        />,
      )
      expect(screen.getByLabelText('Predicted 2 to 1')).toBeInTheDocument()
      // Read-only: still no way to edit or save.
      expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
      expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
    })

    it('shows a localized "no prediction" indication when the viewer saved none (rule 4)', () => {
      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={duringLockedWindow} />)
      expect(screen.getByText('—')).toBeInTheDocument()
      expect(screen.getByText("You didn't make a prediction for this match")).toBeInTheDocument()
    })
  })

  // --- ticket 027: strict mode locks days before kickoff — spec rule 5 -----------------

  describe('locked, not kicked off (strict window, days before kickoff)', () => {
    const DAY_MS = 24 * 60 * 60 * 1000

    beforeEach(() => {
      useGroupMock.mockReturnValue({ group: { mode: 'strict' } })
      useTournamentConfigMock.mockReturnValue({
        cutoffs: {
          // Group-stage window closed a week before this match's own kickoff.
          firstCupMatchKickoffMs: KICKOFF_MS - 7 * DAY_MS,
          firstKnockoutKickoffMs: KICKOFF_MS + 14 * DAY_MS,
        },
        loading: false,
      })
    })

    // Days past the strict cutoff, but still days BEFORE the match's own kickoff.
    const daysBeforeKickoff = () => KICKOFF_MS - 5 * DAY_MS

    it('renders the locked state (no inputs, reveal gated pre-kickoff) far from kickoff', () => {
      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={daysBeforeKickoff} />)
      expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
      expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /predictions/i }))
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, kickedOff: false }),
      )
    })

    it('shows the own pick / no-pick indication in the strict window too', () => {
      const { unmount } = renderCard(
        <FixtureCard
          gid="g1"
          match={makeMatch()}
          existing={existingPred(0, 3)}
          now={daysBeforeKickoff}
        />,
      )
      expect(screen.getByLabelText('Predicted 0 to 3')).toBeInTheDocument()
      unmount()

      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={daysBeforeKickoff} />)
      expect(screen.getByText("You didn't make a prediction for this match")).toBeInTheDocument()
    })
  })

  // --- ticket 027: fully reactive boundary crossings — spec rule 9 ---------------------

  describe('reactive boundary crossings (no refresh)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('flips editable → locked on its own when the clock crosses the lock instant', () => {
      vi.setSystemTime(LOCK_MS - 1000)
      const now = () => Date.now()
      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={now} />)

      // Still editable just before the lock.
      expect(screen.getByRole('button', { name: /save prediction/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /predictions/i })).toBeNull()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Crossed the lock: inputs gone, reveal button in — no remount, no interaction.
      expect(screen.queryByRole('button', { name: /save prediction/i })).toBeNull()
      expect(screen.queryByLabelText('Increase HOM goals')).toBeNull()
      expect(screen.getByRole('button', { name: /predictions/i })).toBeInTheDocument()
    })

    it('flips an OPEN dialog to kickedOff: true when the clock crosses kickoff', () => {
      vi.setSystemTime(KICKOFF_MS - 1000)
      const now = () => Date.now()
      renderCard(<FixtureCard gid="g1" match={makeMatch()} now={now} />)

      // Locked window: open the dialog — still gated (placeholder, no query).
      fireEvent.click(screen.getByRole('button', { name: /predictions/i }))
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, kickedOff: false }),
      )

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Kickoff crossed: the SAME open dialog now receives kickedOff: true, which lets
      // its `useMatchPredictions(…, open && kickedOff)` attach the live listener.
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, kickedOff: true }),
      )
    })
  })

  it('shows the strict group-window lock hint as a tooltip on the Locks-in chip', async () => {
    useGroupMock.mockReturnValue({ group: { mode: 'strict' } })
    useTournamentConfigMock.mockReturnValue({
      cutoffs: {
        firstCupMatchKickoffMs: KICKOFF_MS,
        firstKnockoutKickoffMs: KICKOFF_MS + 7 * 24 * 60 * 60 * 1000,
      },
      loading: false,
    })
    // A group-stage match whose own kickoff is far in the future; the lock is the group window.
    const match = makeMatch({ kickoff: makeMatch().kickoff, stage: 'GROUP_STAGE' })
    renderCard(<FixtureCard gid="g1" match={match} now={beforeKickoff} />)
    // The hint is no longer a standalone legend line — it rides on the countdown chip's tooltip.
    expect(screen.queryByText(/group-stage picks lock/i)).not.toBeInTheDocument()
    fireEvent.mouseOver(screen.getByText(/Locks in/i))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/group-stage picks lock/i)
  })

  // --- ticket 032: three fixed zones + finished-card points pill -----------------------

  describe('three fixed zones — footer present in every state (032 rule 1)', () => {
    const duringLockedWindow = () => KICKOFF_MS - 5 * 60 * 1000
    const tbdTeam = { id: 0, name: '', shortName: '', tla: '', crest: '' }
    const finishedMatch = () =>
      makeMatch({ status: 'FINISHED', score: { home: 2, away: 1, winner: 'HOME_TEAM' } })

    const states: Array<[string, ReactNode]> = [
      ['editable', <FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />],
      [
        'locked with pick',
        <FixtureCard
          gid="g1"
          match={makeMatch()}
          existing={existingPred(2, 1)}
          now={duringLockedWindow}
        />,
      ],
      ['locked no pick', <FixtureCard gid="g1" match={makeMatch()} now={duringLockedWindow} />],
      [
        'TBD upcoming',
        <FixtureCard
          gid="g1"
          match={makeMatch({ homeTeam: tbdTeam, awayTeam: tbdTeam })}
          now={beforeKickoff}
        />,
      ],
      [
        'live',
        <FixtureCard
          gid="g1"
          match={makeMatch({ status: 'IN_PLAY', score: { home: 0, away: 0, winner: null } })}
          now={afterKickoff}
        />,
      ],
      [
        'finished with pick',
        <FixtureCard
          gid="g1"
          match={finishedMatch()}
          existing={existingPred(2, 1)}
          now={afterKickoff}
        />,
      ],
      ['finished no pick', <FixtureCard gid="g1" match={finishedMatch()} now={afterKickoff} />],
    ]

    it.each(states)('renders the fixed footer zone in the %s state', (_label, ui) => {
      renderCard(ui)
      expect(screen.getByTestId('fixture-card-footer')).toBeInTheDocument()
    })
  })

  describe('finished-card points pill (032 rules 2–3)', () => {
    const finishedMatch = () =>
      makeMatch({ status: 'FINISHED', score: { home: 2, away: 1, winner: 'HOME_TEAM' } })

    it('prefers the ingestion-written points/breakdown over the computed preview', () => {
      // 1–0 vs 2–1 would COMPUTE outcome 3 + goalDiff 1 = 4 pts (warning tier); the
      // ingestion-written 6 / exact>0 must win (authoritative, constitution §3).
      const pred: Prediction = {
        ...existingPred(1, 0),
        points: 6,
        breakdown: { exact: 5, outcome: 0, goalDiff: 1 },
      }
      renderCard(
        <FixtureCard gid="g1" match={finishedMatch()} existing={pred} now={afterKickoff} />,
      )
      const pill = screen.getByTestId('fixture-card-points-pill')
      expect(pill).toHaveTextContent('6 pts')
      expect(pill).toHaveAttribute('data-tier', 'exact')
    })

    it('computes an EXACT pick with the shared engine when ingestion points are absent', () => {
      renderCard(
        <FixtureCard
          gid="g1"
          match={finishedMatch()}
          existing={existingPred(2, 1)}
          now={afterKickoff}
        />,
      )
      const pill = screen.getByTestId('fixture-card-points-pill')
      // DEFAULT_SCORING: exact 5 + goal-diff bonus 1 + group-stage round bonus 0.
      expect(pill).toHaveTextContent('6 pts')
      expect(pill).toHaveAttribute('data-tier', 'exact')
    })

    it('computes an OUTCOME-ONLY pick (warning tier) when ingestion points are absent', () => {
      renderCard(
        <FixtureCard
          gid="g1"
          match={finishedMatch()}
          existing={existingPred(1, 0)}
          now={afterKickoff}
        />,
      )
      const pill = screen.getByTestId('fixture-card-points-pill')
      // outcome 3 + goal-diff bonus 1 (both +1 diffs) = 4.
      expect(pill).toHaveTextContent('4 pts')
      expect(pill).toHaveAttribute('data-tier', 'outcome')
    })

    it('computes a MISSED pick (error tier) when ingestion points are absent', () => {
      renderCard(
        <FixtureCard
          gid="g1"
          match={finishedMatch()}
          existing={existingPred(0, 2)}
          now={afterKickoff}
        />,
      )
      const pill = screen.getByTestId('fixture-card-points-pill')
      expect(pill).toHaveTextContent('0 pts')
      expect(pill).toHaveAttribute('data-tier', 'miss')
    })

    it('respects the group scoring override in the computed preview (ticket 025)', () => {
      useGroupMock.mockReturnValue({ group: { mode: undefined, scoring: { exact: 10 } } })
      renderCard(
        <FixtureCard
          gid="g1"
          match={finishedMatch()}
          existing={existingPred(2, 1)}
          now={afterKickoff}
        />,
      )
      // exact 10 (override) + goal-diff bonus 1 (default) + round bonus 0 = 11.
      expect(screen.getByTestId('fixture-card-points-pill')).toHaveTextContent('11 pts')
    })

    it('renders NO pill on finished-without-prediction, live, locked, or editable cards', () => {
      const graded: Prediction = {
        ...existingPred(2, 1),
        points: 6,
        breakdown: { exact: 5, outcome: 0, goalDiff: 1 },
      }
      const cases: ReactNode[] = [
        // Finished, no prediction.
        <FixtureCard gid="g1" match={finishedMatch()} now={afterKickoff} />,
        // Live (IN_PLAY) — even with graded data present, no pill before FINISHED.
        <FixtureCard
          gid="g1"
          match={makeMatch({ status: 'IN_PLAY', score: { home: 2, away: 1, winner: null } })}
          existing={graded}
          now={afterKickoff}
        />,
        // Locked upcoming with a pick.
        <FixtureCard
          gid="g1"
          match={makeMatch()}
          existing={existingPred(2, 1)}
          now={() => KICKOFF_MS - 5 * 60 * 1000}
        />,
        // Editable.
        <FixtureCard gid="g1" match={makeMatch()} now={beforeKickoff} />,
      ]
      for (const ui of cases) {
        const { unmount } = renderCard(ui)
        expect(screen.queryByTestId('fixture-card-points-pill')).toBeNull()
        unmount()
      }
    })
  })

  describe('finished card affordance + relocated captions (032 rules 4–5)', () => {
    const finishedMatch = () =>
      makeMatch({ status: 'FINISHED', score: { home: 2, away: 1, winner: 'HOME_TEAM' } })

    it('keeps the openDialog BUTTON working on a live card', () => {
      const match = makeMatch({ status: 'IN_PLAY', score: { home: 0, away: 0, winner: null } })
      renderCard(<FixtureCard gid="g1" match={match} now={afterKickoff} />)
      fireEvent.click(screen.getByRole('button', { name: 'Predictions' }))
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, kickedOff: true }),
      )
    })

    it('keeps the openDialog BUTTON working on a locked card', () => {
      renderCard(
        <FixtureCard gid="g1" match={makeMatch()} now={() => KICKOFF_MS - 5 * 60 * 1000} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Predictions' }))
      expect(dialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, kickedOff: false }),
      )
    })

    it('renders NO standalone button on a finished card (the card itself is the doorway)', () => {
      renderCard(<FixtureCard gid="g1" match={finishedMatch()} now={afterKickoff} />)
      expect(screen.queryByRole('button', { name: 'Predictions' })).toBeNull()
      expect(
        screen.getByRole('button', { name: 'See group predictions for this match' }),
      ).toBeInTheDocument()
    })

    it('renders the own-pick caption INSIDE the zones (before the footer) on finished', () => {
      renderCard(
        <FixtureCard
          gid="g1"
          match={finishedMatch()}
          existing={existingPred(1, 0)}
          now={afterKickoff}
        />,
      )
      const caption = screen.getByText(/Your prediction 1–0/)
      const footer = screen.getByTestId('fixture-card-footer')
      // FOLLOWING = the footer comes after the caption ⇒ the caption sits in the
      // center slot, not on an extra row below the zones.
      expect(
        caption.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('renders the no-pick caption INSIDE the zones (before the footer) when locked', () => {
      renderCard(
        <FixtureCard gid="g1" match={makeMatch()} now={() => KICKOFF_MS - 5 * 60 * 1000} />,
      )
      const caption = screen.getByText("You didn't make a prediction for this match")
      const footer = screen.getByTestId('fixture-card-footer')
      expect(
        caption.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })
})
