# 015 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Add an **"Members"** section to the existing Admin page (`/g/:gid/admin`), below the current
"Join requests" section, that lists the group's **approved members** and lets a group admin
**Remove** one. Removal is a single client write — `deleteDoc(groupMemberDoc(gid, uid))` — guarded
by a confirmation dialog so the destructive action is never one-click.

The data plumbing is the only new piece. We add a small `useApprovedMembers(gid)` hook that mirrors
`usePendingMembers` but filters `status == 'approved'`. It returns raw `Member` docs (so we have each
member's `email`/`displayName`/`role`), which is what the management list needs. We deliberately do
**not** reuse `useGroupRoster` here: that hook folds in the owner + leaderboard points and is tuned
for the leaderboard view, whereas the admin list wants the plain approved-member docs and must exclude
the owner. Because the owner has **no** member doc, an approved-members query naturally excludes them —
satisfying "owner is never removable" for free.

No `firestore.rules` change: `allow delete: if isGroupAdmin(gid)` (line 237) already authorizes exactly
this write. We only **add emulator tests** to lock that behavior in (admin can / non-admin cannot).

The current admin user is suppressed from offering themselves a Remove control (a self-remove is out of
the intended flow; the rules still allow it, but the UI won't invite it).

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/hooks/useApprovedMembers.ts` | new | Live `onSnapshot` over `groups/{gid}/members where status=='approved'`, ordered by `displayName`. Mirrors `usePendingMembers`. |
| `src/hooks/useApprovedMembers.test.ts` | new | Unit-tests the query shape (status filter) and the live mapping. |
| `src/pages/AdminPage.tsx` | edit | Add a "Members" section (uses `useApprovedMembers`), a `MemberRow` with a Remove button, and a confirmation `Dialog`. Wire `deleteDoc`. Suppress Remove for the current user. |
| `src/pages/AdminPage.test.tsx` | edit | Mock `useApprovedMembers` + `deleteDoc`; add tests for acceptance rules 1–4 (list, confirm-gates-delete, cancel no-op, owner/self not removable). |
| `test/rules/groups.test.ts` | edit | Add delete-permission cases for acceptance rules 5–6 (owner-admin can; role:'admin' member can; plain member denied; stranger denied). |
| `specs/015-admin-remove-member/tasks.md` | edit | Filled by `/spec-tasks 015`. |

## Data shapes / interfaces
```ts
// src/hooks/useApprovedMembers.ts — NO new Firestore shapes; reuses Member.
export interface UseApprovedMembersResult {
  members: Member[] // groups/{gid}/members where status === 'approved'
  loading: boolean
  error: Error | null
}
export function useApprovedMembers(gid: string): UseApprovedMembersResult

// AdminPage internal state for the confirm flow:
const [toRemove, setToRemove] = useState<Member | null>(null) // open dialog when non-null
const [removingUid, setRemovingUid] = useState<string | null>(null) // busy spinner per row

// Removal write (reuses existing ref helper + Web SDK):
await deleteDoc(groupMemberDoc(gid, toRemove.uid))
```

## Reused utilities
- `groupMemberDoc(gid, uid)` / `groupMembersCol(gid)` — `src/firebase/db.ts` (delete ref + query source).
- `usePendingMembers` — `src/hooks/usePendingMembers.ts` (template for the new hook: same `onSnapshot`
  + cleanup + error handling, only the `where('status', ...)` value changes).
- `Member`, `MemberRole`, `MemberStatus` — `src/shared/types.ts` (no new types).
- `LoadingState` / `EmptyState` / `ErrorState` — `src/components/states` (section states).
- MUI `Dialog`/`DialogTitle`/`DialogContent`/`DialogActions` — confirmation modal (already a dependency).
- `useGroup()` (`gid`, `isGroupAdmin`) and `useAuth()` (`user.uid`) — already used by AdminPage.
- Firestore rules test harness + helpers in `test/rules/groups.test.ts` (existing `createGroup`,
  member-seeding, `assertFails`/`assertSucceeds` patterns) — extend, don't rewrite.

## Test strategy
- **AC 1 (list):** AdminPage test — `useApprovedMembers` returns 2 members ⇒ both names render with a
  Remove control each.
- **AC 2 (confirm gates; cancel no-op):** click Remove ⇒ dialog appears naming the member; click Cancel
  ⇒ dialog closes and `deleteDoc` is **not** called.
- **AC 3 (confirm deletes correct ref):** click Remove → Confirm ⇒ `deleteDoc` called once with
  `groupMemberDoc(gid, targetUid)` (mock returns a recognizable ref `{ __ref:'member', gid, uid }`).
- **AC 4 (owner not removable):** owner has no member doc, so they never appear in `useApprovedMembers`;
  test asserts no Remove control is rendered for an owner identity / the current admin user.
- **AC 5–6 (rules):** emulator tests in `test/rules/groups.test.ts`:
  - owner deletes an approved member doc ⇒ **succeeds**;
  - a `role:'admin'` approved member deletes another member doc ⇒ **succeeds**;
  - a plain approved member deletes another member's doc ⇒ **fails**;
  - a non-member stranger deletes a member doc ⇒ **fails**.
- **AC 7 (drops off roster):** covered by the existing `useGroupRoster` status filter
  (`where('status','==','approved')`, useGroupRoster.ts:141) — assert in `useApprovedMembers.test.ts`
  that the query filters on `approved`, so a deleted doc cannot reappear.
- **AC 8 (gates):** `npm run build`, `npm test`, `npm run test:rules` all green.

## Risks
- **Self-removal by an admin-member** locking themselves out → mitigation: UI suppresses the Remove
  control for the current user; rules intentionally unchanged (no self-guard needed for the owner, who
  is never in the list).
- **Inert orphan predictions** for a removed member accumulate → accepted non-goal; `buildLeaderboard`
  already ignores non-participant predictions, so there is no scoring/leaderboard impact.
- **Re-join with same uid** revives old predictions → documented as accepted behavior in the spec.
- **Confirmation-dialog test flakiness** (async open/close) → use `findBy*`/`waitFor` and assert on the
  `deleteDoc` mock call count, not timing.
