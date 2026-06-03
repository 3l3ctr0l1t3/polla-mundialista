# 012 — Plan

> Generated from spec.md. Large refactor to a group-scoped (multi-tenant) model. No live data → clean restructure.

## Approach
Introduce `groups/{groupId}` with subcollections `members`, `predictions`, `leaderboard`. Move membership,
predictions, and leaderboards out of the top level into the group. The app becomes: open sign-in → "My
Groups" → enter a group → group-scoped fixtures/predictions/leaderboard/admin. Build in 4 phases so each
layer is verified before the next.

## Phase A — data model + security rules (firestore-rules-engineer)
- `src/shared/types.ts`: add `Group`; make `Member` carry `role: 'admin'|'member'`; keep Prediction/Leaderboard
  shapes (now stored under a group).
- `src/firebase/db.ts`: group-scoped refs/converters: `groupsCol`, `groupDoc(gid)`, `groupMembersCol(gid)`,
  `groupMemberDoc(gid, uid)`, `groupPredictionsCol(gid)`, `groupPredictionDoc(gid, uid, matchId)`,
  `groupLeaderboardCol(gid)`. Keep matches/standings/config refs.
- `firestore.rules`: helpers `isGroupMember(gid)` / `isGroupAdmin(gid)` (get on `groups/$(gid)/members/$(uid)`);
  `groups` create (owner = self) + owner-managed; `members` (owner auto-approved-admin at create via group
  ownerUid check; others self-request pending; admin approve; no self-approve); `predictions` (per-group
  member-gated, kickoff lock, no tamper, owner-only id); `leaderboard` (group members read, write false).
  Remove top-level predictions/leaderboard/members rules (deprecated).
- `test/rules/groups.test.ts`: all of acceptance rule 7. Update/replace `predictions.test.ts`/`members.test.ts`.

## Phase B — app shell, group context, membership (react-mui-builder)
- `AuthProvider`: drop app-level `isMember`; any signed-in user is allowed in. Keep `user`, `isAdmin` removed
  (admin is now per-group).
- `useMyGroups()` (owned + joined + pending), `MyGroupsPage` (`/`), `CreateGroupPage` (`/groups/new`, batched
  group + owner admin member write), `JoinGroupPage` (`/join/:groupId` → request).
- `GroupProvider`/`useGroup(gid)` (group doc + my role/status), group-scoped routes `/g/:groupId/...`,
  group admin page (approve members) gated by group-admin. Update nav to be group-aware + a group switcher.
- `MembershipGate` → per-group (request/pending/rejected within a group).

## Phase C — group-scoped feature pages (react-mui-builder)
- Repoint `useMatches`/`useStandings` stay global; `useMyPredictions`→`useGroupPredictions(gid)`;
  predictions write to `groupPredictionDoc`; `useLeaderboard`→`useGroupLeaderboard(gid)`. Pages read `gid`
  from route. Keep kickoff-lock UI + server time.

## Phase D — ingestion per group (ingestion-engineer)
- `index.ts`: after upserting global matches, iterate `groups/*`; for each, grade its predictions with the
  shared engine and rebuild its `leaderboard`. `buildLeaderboard` takes a group's predictions+members.

## Verification
- Per phase: `npm run test:rules`, `npm test`, `npm run build`, lint, prettier. Deploy rules after Phase A.
- End state: create two groups, join/approve across accounts, per-group predictions isolated, per-group
  leaderboards, ingestion grades per group (offline sample test).

## Risks
- Big surface change → phase gates + keep matches/standings/config untouched (global).
- Group-create atomicity → client batch writes `groups/{gid}` + `groups/{gid}/members/{owner}`; rules allow
  the owner to self-create an approved admin member only when `groups/{gid}.ownerUid == uid`.
- Rule `get()` cost rises (per-group membership lookups) — still fine at this scale.
