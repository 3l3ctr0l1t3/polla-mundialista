---
name: spec-new
description: Scaffold a new Spec-Driven Development ticket for Polla Mundialista. Use when the user wants to create a new ticket/story (e.g. "/spec-new push-notifications" or "add a ticket for X"). Creates specs/NNN-slug/ from templates, drafts spec.md, and updates the backlog.
---

# spec-new — scaffold a ticket

The argument is the ticket **slug** (kebab-case), e.g. `push-notifications`.

Steps:
1. Read `specs/constitution.md` and `specs/templates/spec-template.md`.
2. Find the highest existing `specs/NNN-*` folder and pick the next zero-padded number `NNN`.
3. Create `specs/NNN-<slug>/` and copy the three templates into it as `spec.md`, `plan.md`, `tasks.md`
   (keep `plan.md`/`tasks.md` as the empty templates — they are filled later by `/spec-plan` and `/spec-tasks`).
4. Delegate to the **spec-author** subagent to fill `spec.md`: a real Why, user story, scope, non-goals, and
   **verifiable acceptance rules**, with constitution links. Pass it the slug and any description the user gave.
5. Add a row to `specs/backlog.md` (status 🟦, dependencies, specialist agent).
6. Report the new ticket path and a one-line summary; ask the user to review the acceptance rules before planning.

Do not write app code here. If no slug is given, ask for one.
