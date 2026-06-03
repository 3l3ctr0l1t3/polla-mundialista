---
name: spec-implement
description: Implement a Polla Mundialista ticket from its spec/plan/tasks, routing to the right specialist subagent and checking off tasks as it goes. Use when building a ticket (e.g. "/spec-implement 003").
---

# spec-implement — build a ticket

The argument is the ticket **id** (e.g. `003`).

Steps:
1. Resolve `specs/NNN-*`. Read `spec.md`, `plan.md`, `tasks.md`, and `specs/constitution.md`. If `plan.md` or
   `tasks.md` is still the empty template, run `/spec-plan` / `/spec-tasks` first (or tell the user).
2. Set the ticket to 🟨 in `specs/backlog.md`.
3. **Route to the specialist** named in the backlog/spec:
   - security rules / data model / converters → **firestore-rules-engineer**
   - React/MUI UI, pages, hooks, theming → **react-mui-builder**
   - scoring engine, ingestion job, GitHub Actions → **ingestion-engineer**
   For multi-discipline tickets, split the work across the relevant agents.
   Give each agent the ticket paths and the constitution; let it implement and test its part.
4. Work the `tasks.md` list, checking off `[x]` as each task completes. Keep changes within the ticket's scope.
5. Run the ticket's verification commands; ensure `npm run build` and tests pass. **Never commit secrets.**
6. Report what changed and recommend `/spec-verify NNN`.

Honor every constitution principle. Do not expand scope beyond the spec.
