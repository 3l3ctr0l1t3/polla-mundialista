# 015 — Admin removes a member

> Status: 🟦 spec ready · Depends on: 012 · Specialist: firestore-rules-engineer + react-mui-builder

## Why
A group admin can today approve/reject **pending** join requests on the Admin page, but has no way to remove
someone who is **already** an approved member. Admins need to eliminate an existing member from their group.

## Who
"Admin" = a **group** admin: the group **owner** (implicit via `groups/{gid}.ownerUid`, who has no member doc)
**OR** an approved member whose member doc has `role: 'admin'`. This is exactly `isGroupAdmin(gid)` in
`firestore.rules`. No new role and no rules change is introduced by this ticket.

## User story
As a **group admin**, I want to **remove an approved member from my group** so that **someone who no longer
belongs (or was added by mistake) is dropped from the roster and the live leaderboard**.

## Scope
- On the Admin page (`src/pages/AdminPage.tsx`, route `/g/:gid/admin`), add a section that **lists the
  group's approved members** alongside the existing pending-requests section.
- Each approved member row offers a **Remove** action that opens a **confirmation dialog** (destructive
  action) naming the member; confirming performs the removal, cancelling does nothing.
- Removal is a single client write: `deleteDoc(groupMemberDoc(gid, uid))` deleting the target's
  `groups/{gid}/members/{uid}` doc. (The existing rule `match /groups/{gid}/members/{uid}` already permits
  `allow delete: if isGroupAdmin(gid)` — `firestore.rules` ~line 237.)
- The **owner is never offered** a Remove action (owners have no member doc; there is nothing to delete).
- Downstream is already wired and needs no change: `useGroupRoster` (`src/hooks/useGroupRoster.ts`) derives
  the roster from `members where status == 'approved'` + the owner, so a removed member disappears from the
  live leaderboard immediately; the next ingest run (`scripts/ingest/buildLeaderboard.ts` ~line 79) skips
  predictions whose uid is not a current participant and prunes the stale leaderboard row.
- Tests: an **emulator rules test** proving admin-can / non-admin-cannot delete a member doc, and a
  **component test** proving the confirm dialog gates a `deleteDoc` of the correct member ref.

## Non-goals
- Deleting the removed member's **prediction docs** (`{uid}_{matchId}`) or any leaderboard history. Clients
  cannot delete predictions (`allow delete: if false`), and nothing reads an ex-member's predictions, so the
  stale docs are inert — leaving them is deliberate.
- **Banning/blocklisting** a removed member from re-requesting to join.
- **Bulk** removal, **changing member roles**, or removing the owner.
- **Any change to `firestore.rules`** — the delete permission already exists.

## Acceptance rules (definition of done)
1. The Admin page renders a section listing the group's **approved members** (excluding the owner from the
   removable list), each with a **Remove** control. Verifiable by component test.
2. Clicking **Remove** does **not** delete immediately; it opens a **confirmation dialog** that names the
   target member. Cancelling closes the dialog and performs **no** write. Verifiable by component test.
3. Confirming the dialog calls `deleteDoc` exactly once with the ref for the **selected member's**
   `groups/{gid}/members/{uid}` doc (i.e. `groupMemberDoc(gid, targetUid)`). Verifiable by component test
   asserting the deleted path/uid.
4. The Admin page **never** offers a Remove action for the group **owner**. Verifiable by component test
   (owner present in roster, no Remove control for them).
5. **Emulator rules test — allowed:** a group admin (owner, and separately a member with `role: 'admin'`)
   **can** delete an approved `groups/{gid}/members/{uid}` doc.
6. **Emulator rules test — denied:** a plain approved member (non-admin) and a non-member stranger are
   **denied** deleting another member's `groups/{gid}/members/{uid}` doc.
7. After removal, the removed uid no longer appears in the roster produced by `useGroupRoster` (status-filter
   excludes it), so they drop off the live leaderboard with no further write. Verifiable by inspecting that
   the roster query filters `status == 'approved'` and the deleted doc is absent.
8. Quality gates stay green: `npm run build`, `npm test` (incl. the new component test), and
   `npm run test:rules` (incl. the new delete-permission cases).

## Constitution links
- **Two-writers rule (Principle 3):** the browser only deletes a **membership** doc it is authorized to
  manage; this grants no client access to match results, predictions, or leaderboard, which remain
  admin-SDK-only. Removal does not let a client touch predictions or the leaderboard.
- **Spec-first (Principle 1):** behavior is specified here before any code.
- **Done = tested + meets acceptance rules (Principle 7):** the security-rule behavior is proven by an
  emulator test; the UI behavior by a component test.

## Notes / open questions
- **Re-join behavior (accepted):** if the same person rejoins with the **same uid** and is re-approved, their
  previously inert prediction docs become live again and re-appear on the leaderboard. This is accepted, not a
  bug — predictions are intentionally never deleted by this ticket.
- The approved-members list and the existing pending-requests list both read `groups/{gid}/members`; the
  planner should decide whether to reuse `useGroupRoster` or a dedicated members query for the Admin view.
- An admin removing **themselves** (an admin who is a member, not the owner) is technically permitted by the
  rule and is out of this ticket's intended flow; the planner may surface or suppress a self-Remove control —
  no rules-level guard is added here.
