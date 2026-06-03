---
name: spec-verify
description: Verify a Polla Mundialista ticket against its spec.md acceptance rules and the constitution. Use after implementing a ticket (e.g. "/spec-verify 003"). Reports pass/fail with evidence and updates backlog status.
---

# spec-verify — check a ticket is done

The argument is the ticket **id** (e.g. `003`).

Steps:
1. Resolve `specs/NNN-*` and read its `spec.md` acceptance rules.
2. Delegate to the **acceptance-verifier** subagent: have it run each rule's check (build, tests, emulator
   rules tests, lint, or documented manual step) and cross-check the constitution (no committed secrets,
   two-writers rule, client-clock not trusted, free-tier only).
3. Collect the verdict table (rule → PASS/FAIL/N/A + evidence).
4. If **all pass**, update `specs/backlog.md` status to ✅ and report success. If **any fail**, leave status as
   🟨, list exactly what's missing, and recommend the fix — do NOT mark complete.

The verifier must not edit source to force a pass. Report honestly; failing tests mean the ticket is not done.
