# 011 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

## Integrity layer (firestore-rules-engineer) — DONE
- [x] 1. Add `MemberStatus` + `Member` interface to `src/shared/types.ts`; mark `AllowlistConfig` deprecated.
- [x] 2. Add `memberConverter`, `membersCol`, `memberDoc(uid)` to `src/firebase/db.ts`.
- [x] 3. Add `isAdmin()` + `isApprovedMember()` helpers to `firestore.rules`; switch `isMember()` to
       `isAdmin() || isApprovedMember()` (predictions gate otherwise unchanged).
- [x] 4. Add the `members/{uid}` block (read/create/update/delete) to `firestore.rules`; deprecate
       `config/allowlist` in a comment; update the cost note.
- [x] 5. Write `test/rules/members.test.ts` (self-create pending, self-approve denied, admin approve/reject,
       non-admin status change denied, owner-only vs admin read, delete admin-only).
- [x] 6. Update `test/rules/predictions.test.ts` to seed `members/{uid}` (approved) instead of the allowlist;
       add pending-denied + admin-allowed prediction-write cases.
- [x] 7. Run `npm run test:rules` (all green) and `npm run build` (types compile).

## UI layer (react-mui-builder) — DONE
- [x] 8. `AuthProvider`: compute `isMember = isAdmin || members/{uid}.status === 'approved'`; expose
       `{ user, loading, isMember, isAdmin, memberStatus }` via `onSnapshot(memberDoc(uid))` so approval is
       live. Removed the old `config/allowlist` read.
- [x] 9. "Request to join" action for signed-in non-members in `src/pages/MembershipGate.tsx` (creates
       `members/{uid}` pending via `memberDoc`).
- [x] 10. Pending + rejected status screens (with sign-out and a rejected→pending re-request) in
        `MembershipGate.tsx`; App gates feature pages behind `isMember`; `LoginPage` now handles only the
        signed-out case.
- [x] 11. `/admin` approval page (`src/pages/AdminPage.tsx`, nav-visible to admins only via `ADMIN_NAV_ITEM`,
        route-guarded for `isAdmin`): live pending list (`usePendingMembers`), Approve / Reject
        (update `status` + `decidedBy` + `decidedAt`), with Loading/Empty/Error states.
- [x] 12. Verified own tests + full build/lint/format (AuthProvider, AdminPage, App tests pass).
- [ ] 13. Update `specs/backlog.md` status to ✅. (Out of this lane — backlog edits are off-limits.)

## Verification command(s)
```
npm run test:rules
npm run build
```
