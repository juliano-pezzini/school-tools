# LESSONS (project-local)

> No-script fallback in effect (`scripts/lessons.py` absent). Hand-maintained, best-effort accounting.
> Grounded entries only. `candidate` → `confirmed` after recurrence across 2 distinct features.

| ID | Status | Signal | Scope | Feature(s) | Source | Lesson |
| --- | ------ | ------ | ----- | ---------- | ------ | ------ |
| L-001 | candidate | surviving_mutant | pure-logic/sort | lancamentos-saldo | `logic.js:360` (M2) / `list.test.js:9` | When testing a comparator or sort tie-break, assert ordering with inputs arranged so both comparison directions are exercised — a single fixed input order can leave one branch unpinned. |
| L-002 | candidate | ac_gap | ui | lancamentos-saldo | spec edge case "teto" / `Index.html:313` | When pure logic returns a flag the UI must act on (e.g. `requiresConfirmation`), require evidence the UI consumes it; a tested flag alone does not satisfy a UI-side acceptance criterion. |
