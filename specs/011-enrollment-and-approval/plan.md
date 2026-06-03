# 011 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Replace the static `config/allowlist` membership with a `members/{uid}` request→approve model. The
integrity layer (this plan's scope) adds a `Member` interface to `src/shared/types.ts`, a typed
converter + collection ref + doc helper to `src/firebase/db.ts`, and a `members/{uid}` block plus new
membership helpers to `firestore.rules`. The predictions membership gate `isMember()` switches from the
allowlist lookup to `isAdmin() || isApprovedMember()`; everything else about predictions (kickoff lock,
ownership, no points/breakdown tampering) is unchanged. Every rule is proven with
`@firebase/rules-unit-testing` emulator tests via `firebase emulators:exec`.

The React UI (AuthProvider `isMember`, "Request to join" / pending / rejected screens, `/admin` approval
page) is owned by a second agent and is out of scope here.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/shared/types.ts` | edit | Add `MemberStatus` + `Member` interface (uid, displayName, email, photoURL, status, requestedAt, decidedAt: Timestamp\|null, decidedBy: string\|null). Mark `AllowlistConfig` deprecated. |
| `src/firebase/db.ts` | edit | Add `memberConverter`, `membersCol`, `memberDoc(uid)`. |
| `firestore.rules` | edit | New helpers `isAdmin()`, `isApprovedMember()`; `isMember()` now = `isAdmin() \|\| isApprovedMember()`; new `members/{uid}` block; deprecate `config/allowlist`; updated cost note. |
| `test/rules/members.test.ts` | new | Self-create pending, self-approve denied, admin approve/reject, non-admin status change denied, owner-only vs admin read, delete admin-only. |
| `test/rules/predictions.test.ts` | edit | Seed `members/{uid}` (approved) instead of `config/allowlist`; add pending-rejected + admin-writes-prediction cases. |

## Data shapes / interfaces
```ts
export type MemberStatus = 'pending' | 'approved' | 'rejected'
export interface Member {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  status: MemberStatus
  requestedAt: Timestamp
  decidedAt: Timestamp | null
  decidedBy: string | null
}
// db.ts
export const membersCol: CollectionReference<Member>
export const memberConverter: FirestoreDataConverter<Member>
export const memberDoc: (uid: string) => DocumentReference<Member>
```

### Rules helpers (firestore.rules)
```
isAdmin()          = signed-in && exists(users/uid) && get(users/uid).data.isAdmin == true
isApprovedMember() = signed-in && exists(members/uid) && get(members/uid).data.status == 'approved'
isMember()         = isAdmin() || isApprovedMember()
```

### members/{uid} authorization
- read: owner (`request.auth.uid == uid`) OR `isAdmin()`.
- create: own doc, `data.uid == uid`, `status == 'pending'`, `decidedBy`/`decidedAt` null/absent.
- update: (a) owner re-request `rejected -> pending`, no decided* set; OR (b) `isAdmin()` sets any status
  with `decidedBy == request.auth.uid` and `decidedAt != null`. A non-admin can never reach `approved`.
- delete: `isAdmin()` only.

## Reused utilities
- `src/firebase/config.ts` — `app`; `db.ts` already imports it.
- `test/rules/helpers.ts` — `makeTestEnv`, `authedAs`, email constants; reused by `members.test.ts`.
- Existing `firestore.rules` helpers `isSignedIn`, `beforeKickoff`, `predictionShapeValid`, `ownsPrediction`
  are untouched.

## Test strategy
- `@firebase/rules-unit-testing` against the Firestore emulator via `npm run test:rules`.
- Seed admin `users/{uid}` and `members/{uid}` docs with `withSecurityRulesDisabled`, then assert
  allowed/denied creates/updates/reads/deletes for owner / admin / other / unauthenticated contexts.
- Predictions tests re-seed an approved `members/{uid}` (not the allowlist) and add pending-denied +
  admin-allowed prediction-write cases, proving `isMember == isAdmin || approved`.

## Risks
- Membership get()s: a prediction write now does `isAdmin()` (one get on users/{uid}) and, only if not an
  admin, `isApprovedMember()` (one get on members/{uid}) — plus the existing kickoff get(). ~2–3 reads per
  prediction write. Acceptable at this scale; documented in `firestore.rules`.
- `config/allowlist` deprecation: rules no longer read it, so deleting it cannot lock out admins/approved
  members (acceptance rule 4). It stays readable for legacy reads until removed.
- First-admin bootstrap is a manual console step (`users/{uid}.isAdmin = true`); documented in the spec.
  Without at least one admin, no one can approve — by design.

## UI agent hand-off (out of scope here)
- `AuthProvider.isMember` must be `isAdmin || members/{uid}.status === 'approved'`.
- Use `memberDoc(uid)` / `membersCol` + `memberConverter` for reads/writes.
- Request-to-join write: create `members/{uid}` with `status:'pending'`, `decidedAt:null`, `decidedBy:null`.
- Admin approve/reject: update with `status`, `decidedBy: <adminUid>`, `decidedAt: serverTimestamp()`.
