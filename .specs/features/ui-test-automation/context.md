# Cash-Flow UI Test Automation — Context

**Gathered:** 2026-06-28
**Spec:** `.specs/features/ui-test-automation/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Automated browser-based UI tests for the **cash-flow** Apps Script web app, run on
pull requests against a dedicated, reusable staging deployment whose data spreadsheet
is reset and reseeded before each run. Cash-flow only; no per-PR ephemeral projects;
no garbage-collection action.

---

## Implementation Decisions

### Staging environment & isolation
- One **reused** staging Apps Script project (its own script ID, distinct from
  production), under the **same Google account** as production → reuse `CLASP_AUTH`.
- One **dedicated** data spreadsheet for the staging project (distinct from the
  production spreadsheet).
- The spreadsheet is **reset to a clean baseline and reseeded** at the start of every
  test run (cleared, not per-PR-recreated).

### Auth bridge (Option A — test impersonation seam)
- Use the existing, currently-unused `getEffectiveEmail_()` extension point.
- When a **staging-only script property** (e.g. `TEST_AS_EMAIL`) is present,
  `getEffectiveEmail_()` returns that configured test-admin email; otherwise it
  behaves exactly as today (returns the real SSO email).
- Production never sets that property → the branch is a dead/no-op path there.
- Result: Playwright runs **anonymous** (no Google login automation) yet is treated
  as the seeded admin.

### Reset / seed mechanism
- Exposed as a **guarded HTTP action** on the staging web deployment (a branch in
  `doGet`/`doPost`), protected by a **secret token** stored only in staging script
  properties.
- The CI job invokes it before running tests; it (a) clears the data tabs, (b) seeds
  exactly one known admin user matching `TEST_AS_EMAIL`.
- Without the correct token, or when no token is configured (production), the action
  is inert and mutates nothing.

### Test stack & targeting
- **Playwright (Chromium)**.
- App is served inside nested Google sandbox iframes → tests traverse via
  `frameLocator` to reach the real controls.
- Configuration via env vars (staging `/exec` URL, token) so the suite runs locally
  and in CI without code edits.

### CI pipeline
- New workflow triggered on `pull_request` (opened/synchronize/reopened) filtered to
  `cash-flow/**`.
- Steps: push PR code to staging script → update staging deployment → reset+seed →
  run Playwright → report pass/fail.
- A **concurrency group** serializes PR test runs (shared single environment).
- Fork PRs without secret access are **skipped**, not failed.

### Scope of first iteration
- Core money flow only: initial render → opening balance R$ 1.000,00 →
  +ENTRADA 200 (→ 1.200,00) → +SAIDA 50 (→ 1.150,00).

### Agent's Discretion
- Exact names of secrets/variables and script properties.
- File/folder layout of the Playwright project within `cash-flow/`.
- Whether reset/seed is a `doGet` query action or a `doPost`.
- Playwright reporter/config specifics and retry/timeout tuning for iframe loads.

### Declined / Undiscussed Gray Areas → Assumptions
- Concurrency, reset transport, trigger event, iframe traversal, fork-PR handling were
  not separately ratified by the user and are logged as assumptions in `spec.md`
  (Assumptions & Open Questions). Defaults chosen with rationale; to be confirmed at
  design/implementation if any prove wrong.

---

## Specific References

- Reuse the existing `deploy.yml` patterns for clasp auth + `.clasp.json` generation.
- The app's existing `setDataSpreadsheetId()`, `getDataSpreadsheetInfo()`,
  `getEffectiveEmail_()`, and `buildSheets_()` are the natural integration seams.

---

## Deferred Ideas

- Per-PR ephemeral environments + daily orphan cleanup (original idea; dropped now,
  could return if parallel-isolation becomes necessary).
- Extending the harness to book-registration / comp-time.
- Edit, soft-delete, month close/reopen, category autocomplete, and full role-matrix
  UI coverage.
