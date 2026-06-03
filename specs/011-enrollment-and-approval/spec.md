# 011 — Self-enrollment & admin approval

> Status: 🟦 spec ready · Depends on: 002, 003 · Specialist: firestore-rules-engineer + react-mui-builder

## Why
The static `config/allowlist` requires the organizer to hand-edit Firestore for every participant. Instead,
the organizer shares a link; friends sign in and **request to join**; the organizer **approves** them in-app.
This replaces the allowlist and is the membership foundation for multiple groups later (ticket 012).

## User story
As a **friend with the link**, I want to **sign in and request to join the pool** and be let in once the
organizer approves, so I can participate **without anyone editing a database by hand**.
As the **organizer**, I want to **see and approve/reject join requests** inside the app.

## Scope
- New `members/{uid}` doc: `{ uid, displayName, email, photoURL, status: 'pending'|'approved'|'rejected',
  requestedAt, decidedAt, decidedBy }` + typed converter in `src/firebase/db.ts`.
- A signed-in non-member sees a **"Request to join"** action → creates their own `members/{uid}` with
  `status: 'pending'`. Pending and rejected users see clear status screens.
- **Admin approval page** (route `/admin`, shown in nav only to admins): lists pending requests with
  **Approve / Reject**; approving sets `status: 'approved'`.
- `AuthProvider.isMember` becomes **`isAdmin || members/{uid}.status === 'approved'`**. `config/allowlist`
  is deprecated/removed; the predictions `isMember()` rule switches to the members model.
- **First-admin bootstrap:** the organizer sets `users/{uid}.isAdmin = true` once in the Firebase console
  (documented); admins are always members, so they can reach `/admin` and approve everyone else.

## Non-goals
- Multiple groups / per-group membership (ticket 012).
- Email/push notifications of requests; invite-code links (group invites come with 012).
- Role management beyond a single `isAdmin`.

## Acceptance rules (definition of done)
1. A signed-in non-member can submit exactly one join request → `members/{uid}` with `status: 'pending'`,
   and then sees a "request pending" screen (cannot reach app pages).
2. A non-admin **cannot** approve anyone (including themselves): a client write changing `status` is
   **rejected by security rules**. Only a user whose `users/{uid}.isAdmin == true` may change `status`.
3. An admin can view all pending requests and approve/reject; after approval the member gains access on next
   load. `isMember == isAdmin || approved`.
4. The app no longer depends on `config/allowlist`; removing that doc does not lock out admins or approved members.
5. Emulator rules-unit-tests cover: self-create pending allowed; self-approve denied; admin status-change
   allowed; non-admin status-change denied; a member can read only their own member doc while an admin can
   read all.

## Constitution links
- Server-enforced integrity (like the kickoff lock): membership status is writable only by an admin; a user
  may only create their own pending request. No client can self-approve.

## Notes / open questions
- Rejected users: may they re-request? Default: yes (can resubmit, status returns to pending).
- Admin UI is minimal (list + approve/reject); richer management can come later.
- This is intentionally single-pool; ticket 012 generalizes `members` to `groups/{groupId}/members`.
