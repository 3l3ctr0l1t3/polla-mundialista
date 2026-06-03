# 013 — Full leaderboard roster + reveal predictions at kickoff

> Status: 🟦 spec ready · Depends on: 012 · Specialist: firestore-rules-engineer + react-mui-builder

## Why
Two social/transparency features for groups:
1. People want to see **who is participating** even before any match — so the leaderboard must list every
   member (at 0 points), not only those with graded predictions.
2. Participants want to **see each other's predictions** — fairly: hidden until a match kicks off, then
   visible to all group members (the classic polla "reveal at kickoff", so no one can copy beforehand).

## Scope
- **Leaderboard roster:** the leaderboard shows **all approved members + the owner**, each with their points
  (0 if none yet), live as membership changes — independent of when ingestion last ran.
- **Owner in the roster:** denormalize `ownerName` + `ownerPhotoURL` onto `groups/{gid}` at creation (the
  owner has no member doc) so other members can render the owner. Backfill existing groups.
- **Reveal predictions at kickoff:** a group member may read another member's prediction for a match **only
  once `request.time >= match.kickoff`**; before kickoff, predictions stay owner-only. Own predictions are
  always readable. Server-enforced in `firestore.rules`.
- **Per-match predictions view:** a UI to see everyone's predictions for a match — shown once the match has
  kicked off; before kickoff it shows a "reveals at kickoff" message.

## Acceptance rules (definition of done)
1. The leaderboard lists every approved member **and** the owner, with points (0 default) and correct
   ranking/ties; a newly-approved member appears without waiting for an ingestion run.
2. Before kickoff, a group member querying another member's prediction is **denied** by rules; at/after
   kickoff the same read **succeeds** (emulator-tested). Own predictions readable anytime; non-members denied.
3. A per-match view shows all members' predictions for a kicked-off match; for an upcoming match it does not
   reveal them.
4. `groups/{gid}` carries `ownerName`/`ownerPhotoURL`; create rule allows them; existing groups backfilled.

## Constitution links
- Two-writers rule (leaderboard/predictions still written only by ingestion / the owner of the prediction).
- Authoritative reveal uses server `request.time` vs `match.kickoff` (never the client clock).

## Notes / open questions
- Reveal uses a `get()` on the global match per prediction read — fine at group scale (dozens of members).
- The per-match view only queries others' predictions for matches already kicked off (so the query is
  rules-legal); upcoming matches show the placeholder without querying.
