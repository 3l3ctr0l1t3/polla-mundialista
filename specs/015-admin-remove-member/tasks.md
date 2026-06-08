# 015 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Create `src/hooks/useApprovedMembers.ts` — live `onSnapshot` over
  `groups/{gid}/members where status == 'approved'`, ordered by `displayName` asc; returns
  `{ members, loading, error }` with listener cleanup on unmount/gid change (mirror
  `usePendingMembers.ts`).
- [x] 2. Create `src/hooks/useApprovedMembers.test.ts` — assert the query filters `status == 'approved'`
  and maps snapshot docs to `Member[]` (proves AC 7: deleted/non-approved docs cannot appear).
- [x] 3. In `src/pages/AdminPage.tsx`, add a **"Members"** section below "Join requests" that renders a
  `MemberRow` per `useApprovedMembers(gid)` result, with section Loading/Empty/Error states.
- [x] 4. Add a **Remove** button to each `MemberRow`; suppress it for the current user
  (`user.uid === member.uid`). Clicking sets `toRemove` state (does NOT delete yet).
- [x] 5. Add a confirmation `Dialog` (MUI) naming `toRemove`; **Cancel** clears state with no write,
  **Remove** calls `await deleteDoc(groupMemberDoc(gid, toRemove.uid))`, shows a per-row busy state,
  and surfaces failures in the existing snackbar.
- [x] 6. Update `src/pages/AdminPage.test.tsx` — mock `useApprovedMembers` + add `deleteDoc` to the
  `firebase/firestore` mock and `groupMemberDoc` is already mocked; add tests for AC 1–4:
  (a) lists approved members with Remove controls; (b) Remove opens dialog, Cancel → no `deleteDoc`;
  (c) Confirm → `deleteDoc` called once with `groupMemberDoc(gid, targetUid)`; (d) no Remove control
  for the current user / owner identity.
- [x] 7. Extend `test/rules/groups.test.ts` with delete-permission cases (AC 5–6): owner deletes an
  approved member doc → succeeds; a `role:'admin'` approved member deletes another member's doc →
  succeeds; a plain approved member → fails; a non-member stranger → fails.
- [x] 8. Run the gates: `npm run build`, `npm test`, `npm run test:rules`, `npm run lint`,
  `npx prettier --check .` — all green (AC 8).
- [x] 9. Run `/spec-verify 015` and confirm all acceptance rules pass.
- [x] 10. Update `specs/backlog.md` status for 015 to ✅ (or 🟨 if runtime-pending) and the dependency line.

## Verification command(s)
```
npm run build
npm test -- --run
npm run test:rules
npm run lint
npx prettier --check .
```
