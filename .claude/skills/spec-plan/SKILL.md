---
name: spec-plan
description: Generate the technical plan.md for a Polla Mundialista ticket from its approved spec.md. Use when starting work on a ticket (e.g. "/spec-plan 003"). Produces a design, file list, data shapes, reuse notes, test strategy.
---

# spec-plan — design a ticket

The argument is the ticket **id** (e.g. `003` or `003-data-model-and-rules`).

Steps:
1. Resolve the ticket folder `specs/NNN-*`. Read its `spec.md`, `specs/constitution.md`,
   `specs/templates/plan-template.md`, and skim related existing code/specs for reuse.
2. Confirm the spec's acceptance rules are clear; if not, stop and ask the user (do not invent behavior).
3. Write `plan.md` from the template: approach, **files to create/change** (table), data shapes/interfaces
   (TypeScript), **reused utilities** (with paths — prefer reuse over new code), test strategy that proves
   each acceptance rule, and risks→mitigations.
4. Keep the plan within the spec's scope — no gold-plating. Honor the constitution (two-writers, kickoff lock,
   no secrets, free-tier, shared scoring engine).
5. Report the plan path and the key decisions; recommend `/spec-tasks NNN` next.

Do not implement code in this step.
