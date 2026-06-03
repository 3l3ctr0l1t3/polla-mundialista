# specs/ — Spec-Driven Development

This folder is the source of truth for the project. Each unit of work is a **ticket**: a numbered folder
holding three files.

## Anatomy of a ticket
```
specs/NNN-slug/
  spec.md    WHAT & WHY — user story, scope, non-goals, and the acceptance RULES that define "done"
  plan.md    HOW — technical design, files to touch, data shapes (generated when the ticket starts)
  tasks.md   STEPS — an ordered, checkboxed implementation list (generated from the plan)
```
`spec.md` is authored up front for every ticket. `plan.md` and `tasks.md` are generated **just-in-time**
when a ticket is picked up, so they never go stale.

## Workflow
**Constitution → Specify → Plan → Tasks → Implement → Verify**, driven by skills:

| Step | Command | Output |
|------|---------|--------|
| Specify | `/spec-new <slug>` | new `NNN-slug/spec.md` + backlog entry |
| Plan | `/spec-plan <id>` | `plan.md` |
| Tasks | `/spec-tasks <id>` | `tasks.md` |
| Implement | `/spec-implement <id>` | code + checked-off tasks |
| Verify | `/spec-verify <id>` | pass/fail vs the spec's acceptance rules |

## Rules
- Read [`constitution.md`](constitution.md) before authoring or implementing anything.
- A ticket's acceptance rules must trace back to the constitution; they may refine but not contradict it.
- Templates live in [`templates/`](templates). The ticket index + status lives in [`backlog.md`](backlog.md).
