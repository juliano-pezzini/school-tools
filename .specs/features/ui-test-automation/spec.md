# Cash-Flow UI Test Automation Specification

## Problem Statement

The cash-flow Apps Script web app has solid unit coverage for its pure logic
(`logic.js` via Vitest), but the glue layer (`Code.gs`) and the UI (`Index.html`)
are only verified by a manual smoke checklist after deploy. There is no automated
end-to-end signal that a pull request actually renders and behaves correctly in a
real browser against a real Apps Script deployment.

## Goals

- [ ] On every pull request that touches `cash-flow`, deploy the code to a
      dedicated staging Apps Script environment and run a browser-based UI test
      suite against its live `/exec` URL.
- [ ] Provide deterministic test isolation: the staging data spreadsheet is reset
      to a clean, known state and seeded with a known admin before each run.
- [ ] Cover the core money flow end-to-end in a real browser: set opening balance,
      add ENTRADA and SAIDA entries, and assert the saldo recalculates correctly.
- [ ] Keep production untouched: a separate script project, a separate spreadsheet,
      and a test-only auth path that is inert in production.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Per-PR ephemeral Apps Script projects (one project per PR) | User chose a single reused staging project; script properties are per-project, so one project + one cleared spreadsheet is sufficient and far simpler. |
| Daily garbage-collection action for orphaned deploys/spreadsheets | Not needed once a single project is reused and the spreadsheet is cleared each run. Dropped by user. |
| Cleanup on PR-close events | Same reason — no per-PR resources accumulate. |
| UI tests for other solutions (book-registration, comp-time) | Cash-flow only for now; harness should be reusable but not built out for others yet. |
| Real Google login automation in Playwright | User chose the test-impersonation seam (Option A); no Google OAuth flow is automated. |
| Edit, soft-delete, month close/reopen, category autocomplete coverage | Deferred to a later iteration; first iteration is the core money flow only. |
| Full role-permission matrix testing (tesoureiro/leitor/desconhecido) | First iteration runs as a single seeded admin. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Test stack | Playwright (Chromium) | User suggested "Playwright or similar"; mature iframe traversal + CI support. | y |
| Staging environment | One reused Apps Script project + one dedicated spreadsheet, under the same Google account as production (reuse `CLASP_AUTH`) | User choice. | y |
| Per-run isolation | Reset + reseed the staging spreadsheet at the start of each test run | User: "spreadsheet will be cleared each run". | y |
| Auth for tests | Test-impersonation seam in `getEffectiveEmail_()`, activated only when a staging-only script property is present; Playwright stays anonymous | User chose Option A; the seam already exists as an extension point. | y |
| Concurrency of PR runs | Serialize via a GitHub Actions concurrency group (one PR test run at a time) because the staging environment is shared and single | Shared single environment cannot safely run two PRs in parallel; serialization avoids data races. | n |
| How CI triggers reset/seed | A guarded HTTP action on the staging deployment (`doGet`/`doPost` branch) protected by a secret token present only on staging, invoked by the CI job before tests | Avoids `clasp run`/GCP-project setup; reuses the already-public web endpoint; the branch is inert in production (no token). | n |
| Trigger event | `pull_request` (opened, synchronize, reopened) on paths under `cash-flow/**` | Matches "the PR pipeline" intent. | n |
| Iframe traversal | Tests target the inner Apps Script user-content frame via Playwright `frameLocator` | `/exec` serves the app inside nested Google sandbox iframes. | n |
| Fork-PR secret access | First iteration assumes same-repo PRs (secrets available); fork PRs without secrets are skipped, not failed | GitHub does not expose secrets to fork PRs; failing them would be noise. | n |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: PR triggers a staging deploy + UI test run ⭐ MVP

**User Story**: As a maintainer, I want every cash-flow pull request to deploy to a
dedicated staging Apps Script environment and run UI tests against it, so that I get
an automated end-to-end signal before merging.

**Why P1**: This is the entire value of the feature — without it there is no
automated browser-level verification.

**Acceptance Criteria**:

1. WHEN a pull request changes files under `cash-flow/**` THEN the pipeline SHALL
   push the current PR code to the dedicated staging Apps Script project and update
   its web deployment to that code.
2. WHEN the staging deployment is updated THEN the pipeline SHALL run the Playwright
   UI suite against the staging `/exec` URL.
3. WHEN any UI test fails THEN the pipeline job SHALL fail (non-zero exit) and report
   which test failed.
4. WHEN all UI tests pass THEN the pipeline job SHALL succeed.
5. WHEN a pull request does not change any `cash-flow/**` files THEN the UI test job
   SHALL NOT run.

**Independent Test**: Open a PR touching `cash-flow/`, observe the staging deploy
step succeed and the Playwright job run and report results.

---

### P1: Deterministic clean state per run ⭐ MVP

**User Story**: As a maintainer, I want the staging spreadsheet reset and seeded with
a known admin before each run, so that tests are repeatable and independent of prior
runs.

**Why P1**: Without a known starting state, the core-flow assertions (saldo values)
are non-deterministic and tests become flaky/false.

**Acceptance Criteria**:

1. WHEN a test run starts THEN the harness SHALL reset the staging data spreadsheet
   to a clean state (no leftover lançamentos, no opening balance, no extra users).
2. WHEN the reset completes THEN the harness SHALL seed exactly one known admin user
   that the test session resolves to.
3. WHEN the reset/seed endpoint is invoked without the correct staging-only secret
   token THEN the system SHALL NOT mutate any data and SHALL refuse the request.
4. WHEN running in production (no staging token configured) THEN the reset/seed path
   SHALL be unreachable and have no effect.

**Independent Test**: Invoke the reset/seed with the token → spreadsheet shows clean
tabs + one admin row; invoke without/with a wrong token → no change.

---

### P1: Core money flow verified in a real browser ⭐ MVP

**User Story**: As a maintainer, I want the UI suite to drive the real app — set the
opening balance, add an ENTRADA and a SAIDA — and assert the saldo, so that the glue
layer and UI are verified end-to-end.

**Why P1**: This is the concrete behavior the automation must protect.

**Acceptance Criteria**:

1. WHEN the test opens the staging app THEN the saldo panel SHALL render and show the
   no-opening-balance state (R$ 0,00 / "abertura não definida").
2. WHEN the test registers an opening balance of R$ 1.000,00 with a non-future date
   THEN the saldo SHALL become R$ 1.000,00.
3. WHEN the test then adds an ENTRADA of R$ 200,00 THEN the saldo SHALL become
   R$ 1.200,00.
4. WHEN the test then adds a SAIDA of R$ 50,00 THEN the saldo SHALL become
   R$ 1.150,00.
5. WHEN the test session acts THEN it SHALL be treated as the seeded admin (privileged
   actions succeed, not "Acesso negado").

**Independent Test**: Run the suite locally against a staging URL with the token
configured; observe the three saldo assertions pass.

---

### P2: Reusable, documented harness

**User Story**: As a maintainer, I want the test setup documented and structured so it
can later be extended to more flows and other solutions, so that this isn't a one-off.

**Why P2**: Valuable, but the MVP delivers value without polished docs.

**Acceptance Criteria**:

1. WHEN a developer reads the docs THEN they SHALL find the required secrets/variables,
   how to create the staging project + spreadsheet, and how to run the suite locally.
2. WHEN a developer runs the suite locally with a staging URL + token THEN it SHALL run
   without code changes (configuration via env vars).

**Independent Test**: A second person follows the doc and runs the suite locally.

---

## Edge Cases

- WHEN a fork PR (no access to secrets) is opened THEN the UI test job SHALL skip
  gracefully (not hard-fail on a missing secret).
- WHEN the staging deployment URL is temporarily unavailable / returns a Google error
  page THEN the suite SHALL fail with a clear error, not a silent pass.
- WHEN a previous run left state behind THEN the reset SHALL still produce a clean
  baseline (reset is idempotent).
- WHEN two PRs run near-simultaneously THEN the concurrency group SHALL serialize them
  so they do not share the staging spreadsheet at the same time.
- WHEN the app renders inside nested Google iframes THEN the tests SHALL still locate
  and interact with the real controls (no false negative from frame boundaries).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| UITEST-01 | P1: PR triggers staging deploy + tests | Design | Pending |
| UITEST-02 | P1: PR triggers staging deploy + tests | Design | Pending |
| UITEST-03 | P1: PR triggers staging deploy + tests | Design | Pending |
| UITEST-04 | P1: Deterministic clean state | Design | Pending |
| UITEST-05 | P1: Deterministic clean state | Design | Pending |
| UITEST-06 | P1: Deterministic clean state (token guard) | Design | Pending |
| UITEST-07 | P1: Deterministic clean state (prod inert) | Design | Pending |
| UITEST-08 | P1: Core money flow (initial render) | Design | Pending |
| UITEST-09 | P1: Core money flow (opening balance) | Design | Pending |
| UITEST-10 | P1: Core money flow (ENTRADA → saldo) | Design | Pending |
| UITEST-11 | P1: Core money flow (SAIDA → saldo) | Design | Pending |
| UITEST-12 | P1: Core money flow (acts as admin) | Design | Pending |
| UITEST-13 | P2: Reusable, documented harness | Design | Pending |

**ID format:** `UITEST-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 13 total, 0 mapped to tasks, 13 unmapped ⚠️ (resolved in Tasks phase)

---

## Success Criteria

- [ ] A cash-flow PR runs the UI suite against a live staging deployment and reports
      pass/fail as a required-style check.
- [ ] The core money-flow test asserts the three saldo values (1.000,00 → 1.200,00 →
      1.150,00) and passes deterministically across repeated runs.
- [ ] Production behavior is unchanged: no test token in production means the reset/seed
      path and impersonation seam are inert.
- [ ] Re-running the suite back-to-back yields the same result (no state bleed).
