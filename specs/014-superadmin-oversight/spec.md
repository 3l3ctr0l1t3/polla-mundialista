# 014 — Superadmin oversight

> Status: 🟦 spec ready · Depends on: 012 · Specialist: firestore-rules-engineer + react-mui-builder

## Why
The app owner needs a god-view to oversee **every** group and its participants across the whole tenant —
distinct from per-group admins. Gated to a single app-level superadmin.

## Who
Superadmin = `users/{uid}.isAdmin == true`. This flag is settable ONLY via the admin SDK (the `users` rules
forbid a client setting/changing it), so no user can self-promote. It is SEPARATE from per-group admin
(`isGroupAdmin` = owner or member role 'admin'); that mechanism is unchanged. Bootstrap: set the flag for
`koston.dog@gmail.com` (uid `ADy5b15wz4WM6rmKUE6Zklm8D7t2`) via an admin script.

## Scope
- A **`/superadmin`** dashboard, reachable only when `isSuperAdmin`, with a nav entry shown only to them.
- **Oversee all groups:** list every `groups/{gid}` (name, owner, invite code, created date, member count).
- **Oversee participants:** drill into a group to see its members (status, role) + the implicit owner, and
  the group's leaderboard. Read-only oversight (no destructive moderation in this ticket).
- Security: a superadmin may **read** any group's `members`, `leaderboard`, and `predictions`, via an
  `isSuperAdmin()` helper added (as a final OR) to those read rules. Groups metadata is already readable by
  any signed-in user. Normal users are unaffected.

## Acceptance rules (definition of done)
1. With `isAdmin == true`, the user sees a **Superadmin** nav entry and `/superadmin`; without it the route
   is hidden and redirects away.
2. The dashboard lists **all** groups with owner + member count; selecting one shows its participants
   (members + owner, status/role) and its leaderboard.
3. Rules: a superadmin can read any group's `members`/`leaderboard`/`predictions`; a non-superadmin
   non-member is still denied those (emulator-tested both ways).
4. The superadmin flag cannot be set by any client write (unchanged `users` rule; emulator-tested).

## Constitution links
- Superadmin is a server-only flag (admin SDK), never client-grantable. Read-only oversight keeps the
  two-writers rule intact.

## Notes / open questions
- Read-only now; destructive moderation (delete group, remove member) is a later ticket.
- The dashboard reads each group's `members` as a per-group collection query (not a collection-group query)
  so the get()-based `isSuperAdmin()` rule authorizes it.
