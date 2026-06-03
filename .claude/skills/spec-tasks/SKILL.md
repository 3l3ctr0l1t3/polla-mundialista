---
name: spec-tasks
description: Break a Polla Mundialista ticket's plan.md into an ordered, checkboxed tasks.md. Use after planning a ticket (e.g. "/spec-tasks 003"). Produces atomic implementation steps and the verification commands.
---

# spec-tasks — break down a ticket

The argument is the ticket **id** (e.g. `003`).

Steps:
1. Resolve `specs/NNN-*`. Read its `plan.md`, `spec.md`, and `specs/templates/tasks-template.md`.
2. Write `tasks.md`: an ordered list of **atomic, verifiable** tasks that implement the plan, each small enough
   to check off independently. Include explicit tasks to write tests for the acceptance rules, to run
   `/spec-verify NNN`, and to update `specs/backlog.md`.
3. Add a **Verification command(s)** block listing exactly what the verifier will run (e.g. `npm test`,
   `firebase emulators:exec "..."`, `npm run build`).
4. Report the tasks path; recommend `/spec-implement NNN` next.

Do not implement code here.
