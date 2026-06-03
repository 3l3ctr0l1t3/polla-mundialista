# 012 — Multiple groups (multi-tenant pools)

> Status: 🟦 spec ready · Depends on: 011 · Specialist: firestore-rules-engineer + react-mui-builder + ingestion-engineer

## Why
Turn the app from one private pool into a product: any signed-in user can **create and own groups**
(becoming their admin) and **participate in many groups**, each with its own members, **per-group
predictions**, and its own leaderboard. The World Cup fixtures/results are shared globally.

## User stories
- As any signed-in user, I land on **"My Groups"** — groups I own + groups I've joined + my pending requests.
- As an owner, I **create a group** (I become its admin) and share an **invite link**.
- As a joiner, I open an invite link, **request to join**, and get in once that group's admin **approves** me.
- Inside a group I see fixtures, **enter my predictions for that group**, and view **that group's leaderboard**.

## Decisions (locked)
- **Predictions are PER-GROUP** (separate per group).
- **Joining = request → group-admin approval** (per group).
- **App access is open** to any signed-in Google user; gating is per-group. The app-level gate from 011 is removed.

## Data model (group-scoped; matches/standings/config stay global)
- `groups/{groupId}` — `{ groupId, name, ownerUid, inviteCode, createdAt }`.
- `groups/{groupId}/members/{uid}` — `{ uid, displayName, email, photoURL, role: 'admin'|'member',
  status: 'pending'|'approved'|'rejected', requestedAt, decidedAt, decidedBy }`. The owner is created as an
  **approved admin** atomically with the group.
- `groups/{groupId}/predictions/{uid}_{matchId}` — same shape as today's predictions (homeGoals/awayGoals,
  kickoff-locked, `points`/`breakdown` written only by ingestion).
- `groups/{groupId}/leaderboard/{uid}` — per-group aggregate.
- **Deprecated** (no production data): top-level `predictions`, `leaderboard`, and the 011 top-level
  `members` collection — logic moves into the group subcollections.

## Routing
- `/` → MyGroups · `/groups/new` → create · `/join/:groupId` (or `?code=`) → request to join
- Group context: `/g/:groupId/{fixtures,predictions,leaderboard,standings,admin}` (admin route group-admins only)

## Acceptance rules (definition of done)
1. Any signed-in user reaches **My Groups** with no app-level approval; signed-out users see Login only.
2. Creating a group makes the creator its **admin + approved member** (atomic) and yields an invite link.
3. Via an invite link a user can **request to join** a group (pending); that group's **admin** approves/rejects;
   a non-admin **cannot** approve anyone (security-rule enforced). Approval is **scoped to that group only**.
4. Predictions are **per-group**: a write under `groups/A/predictions` never affects group B; the **kickoff
   lock** (`request.time < match.kickoff`) and **no points/breakdown tampering** are enforced per group;
   only an **approved member** of that group may write, owner-only by `{uid}_{matchId}`.
5. Each group has its **own leaderboard**; a user sees only groups they own/joined; raw predictions stay
   private within a group (only the aggregate leaderboard is visible to group members).
6. **Ingestion** grades each group's predictions (shared scoring engine) and rebuilds **each group's**
   leaderboard; matches/standings remain global.
7. Emulator rules-unit-tests cover: open app access, owner auto-admin on create, request-pending allowed,
   non-admin approve denied, per-group prediction lock + ownership + tamper rejection, cross-group isolation,
   and read scoping (members read their group's data only).

## Non-goals
- Cross-group "global" leaderboard; notifications; billing; group deletion UX beyond owner delete; transfers.

## Notes / open questions
- Invite link uses `groupId` (knowing it only lets you *request*, not join) — an `inviteCode` field is included
  for a nicer/unguessable link; approval still required.
- Migration is trivial (no live data). The 011 `members` model + approval UI generalize directly to per-group.
