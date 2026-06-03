# 012 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Built in 4 phases (A integrity layer,
> B app shell, C feature pages, D ingestion). Phase A is the integrity layer (firestore-rules-engineer).

## Phase A — data model + security rules (firestore-rules-engineer)

- [x] A1. `src/shared/types.ts`: add `Group { groupId, name, ownerUid, inviteCode, createdAt }`;
  add `MemberRole = 'admin' | 'member'` + `role` field to `Member`; document owner-derived
  membership; re-scope Prediction/LeaderboardEntry doc paths under a group (shapes unchanged).
- [x] A2. `src/firebase/db.ts`: add `groupConverter`; group-scoped refs/helpers `groupsCol`,
  `groupDoc(gid)`, `groupMembersCol(gid)`, `groupMemberDoc(gid, uid)`, `groupPredictionsCol(gid)`,
  `groupPredictionDoc(gid, uid, matchId)`, `groupLeaderboardCol(gid)`, `groupLeaderboardDoc(gid, uid)`.
  Keep matches/standings/config refs. Mark top-level `membersCol`/`predictionsCol`/`leaderboardCol`
  (+ their doc helpers) `@deprecated` aliases (kept only so Phase B/C imports compile until repointed).
- [x] A3. `firestore.rules`: owner-derived membership helpers `isOwner`/`isGroupMember`/`isGroupAdmin`;
  `groups/{gid}` (open read, owner self-create, owner-only update/delete);
  `groups/{gid}/members/{uid}` (self-request pending member, owner re-request, admin decide, no
  self-approve/self-admin, admin delete); `groups/{gid}/predictions/{predId}` (member-gated, owner-id,
  kickoff lock against GLOBAL match, no points/breakdown tamper, delete false);
  `groups/{gid}/leaderboard/{uid}` (member read, write false). Remove deprecated top-level
  predictions/leaderboard/members blocks. Update header + cost note.
- [x] A4. `test/rules/groups.test.ts`: open access, owner implicit admin+member, joiner self-request,
  non-admin approve denied, role-admin decisions, per-group prediction lock/ownership/tamper,
  cross-group isolation, read scoping. Remove obsolete top-level `members.test.ts`/`predictions.test.ts`;
  drop the top-level `leaderboard` case from `results.test.ts`.
- [x] A5. `npm run test:rules` green; `npm run build` compiles.

## Phase B — app shell, group context, membership (react-mui-builder)

- [ ] B1. `AuthProvider`: drop app-level `isMember`/`isAdmin` gating; any signed-in user is allowed in.
- [ ] B2. `useMyGroups()` (owned + joined + pending) and `MyGroupsPage` at `/`.
- [ ] B3. `CreateGroupPage` (`/groups/new`) — single `groupDoc(gid)` write with `ownerUid == uid`
  (no owner member doc; owner is implicit).
- [ ] B4. `JoinGroupPage` (`/join/:groupId` or `?code=`) — write `groupMemberDoc(gid, uid)` pending.
- [ ] B5. `GroupProvider`/`useGroup(gid)` (group doc + my role/status), group-scoped routes
  `/g/:groupId/...`, group-admin-gated admin page, group switcher nav.
- [ ] B6. Per-group `MembershipGate` (request/pending/rejected within a group).

## Phase C — group-scoped feature pages (react-mui-builder)

- [ ] C1. `useMatches`/`useStandings` stay global.
- [ ] C2. `useMyPredictions` → `useGroupPredictions(gid)` reading/writing `groupPredictionDoc`.
- [ ] C3. `useLeaderboard` → `useGroupLeaderboard(gid)` reading `groupLeaderboardCol`.
- [ ] C4. Pages read `gid` from the route; keep kickoff-lock UI + server time.

## Phase D — ingestion per group (ingestion-engineer)

- [ ] D1. After upserting global matches, iterate `groups/*`.
- [ ] D2. For each group, grade its predictions with the shared scoring engine.
- [ ] D3. Rebuild each group's `leaderboard` from its predictions + members (owner included).

## Verification command(s)

```
npm run test:rules     # Firestore emulator rules tests (Phase A gate)
npm run build          # tsc -b + vite build
npm test               # unit tests (Phases B/C)
```
