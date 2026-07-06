# Project Instructions (for AI agents)

## Overview

**school-tools** — Google Apps Script web apps for school management (cash flow, book registration, comp-time, portal). Each app is a standalone GAS project in its own folder with `Code.gs`, `Index.html`, and `appsscript.json`.

Language: Portuguese (pt-BR) for all UI text, error messages, and comments.

---

## Architecture

| Layer | File | Role |
|-------|------|------|
| Server | `Code.gs` | HTTP entry (`doGet`), Sheets CRUD, role enforcement, locking |
| Logic | `logic.js` | Pure functions (validation, formatting, computation) — shared server-side, tested with Vitest |
| Client | `Index.html` | Single-file SPA (HTML + CSS + JS inline), communicates via `google.script.run` |

- **No bundler, no framework** — vanilla JS (ES5-compatible for GAS runtime).
- Server functions are called from the client via `google.script.run.withSuccessHandler(...).withFailureHandler(...)`.
- In cash-flow, all server calls go through the `gsRun(label, onOk, onErr)` wrapper that manages a global "working" status indicator.

---

## Key Rules

### 1. Sheets Date Storage — NEVER write formatted date strings

When writing dates to Google Sheets via `appendRow` or `setValues`, **always write the JavaScript `Date` object directly**.

- `appendRow([..., dateObj, ...])` ✅
- `appendRow([..., formatDate_(dateObj), ...])` ❌ locale-dependent
- `setValues([[dateObj, ...]])` ✅

**Why:** Sheets interprets date strings based on the spreadsheet locale. `"05/07/2026"` means May 7 in `en_US` but July 5 in `pt_BR`. A `Date` object is stored as a locale-independent serial number.

Use `formatDate_()` only for **display/audit strings**, never for cell storage.

### 2. Client-Side Pre-Validation (Optimistic UI)

The cash-flow app uses optimistic UI — DOM updates happen before the server responds. To prevent inconsistencies:

- **All deterministic server validations must be replicated client-side** and run BEFORE the optimistic update.
- When adding/modifying a server guard in `Code.gs`/`logic.js`, check if it can be mirrored in `Index.html`'s `validateClient()`.
- Client error messages must be **identical** to server messages. Copy from `logic.js`.

**Replicated:** date required, not future, period not closed, value > 0 / numeric / ≤2 decimals, category/description length limits.
**Not replicated (accepted):** authorization (role check), idempotency dedup, "not found" race condition.

### 3. Client-Side Functions from logic.js

`logic.js` runs server-side only (GAS global scope). Functions intended for client-side use (`validateLancamentoClient_`, `validateDeleteClient_`) must be **inlined in a `<script>` block** in `Index.html`. GAS `createHtmlOutputFromFile` does not process scriptlets or include server-side `.js` files.

### 4. Server Call Wrapper (gsRun)

In cash-flow, every `google.script.run` call must go through `gsRun(label, successFn, failureFn)`:
- Shows a global status pill ("Carregando…", "Confirmando…", "Excluindo…", etc.)
- Manages in-flight counter with anti-flicker (150ms show delay, 250ms hide debounce)
- Guarantees `endWork()` is called exactly once (success or failure)

### 5. Deploy Workflow

```bash
cd cash-flow/           # (or any app folder)
clasp push              # pushes code to GAS project
clasp deploy -i <ID>   # updates the pinned deployment (user-facing /exec URL)
```

- `.clasp.json` files are gitignored (contain per-env script IDs).
- `clasp deploy` (without `-i`) creates a NEW deployment — use `-i` to update an existing one.
- After `clasp push`, code is at `@HEAD` but the published URL won't update until you run `clasp deploy -i`.

### 6. Testing

```bash
cd cash-flow/
npm test                # runs Vitest on logic.js pure functions
```

Tests cover: formatting, guards, sanitization, idempotency, periods, saldo, categories, client validation.
Tests do NOT cover: `Code.gs` (Sheets integration), `Index.html` (UI). Those are verified manually after deploy.

---

## File Naming Conventions

- `Code.gs` — main server entry point and Sheets integration
- `logic.js` — pure logic (testable, no GAS dependencies)
- `Index.html` — full SPA (HTML + inline CSS + inline JS)
- `appsscript.json` — GAS manifest (runtime version, OAuth scopes)

---

## Do NOT

- Write date strings to Sheets cells (use Date objects)
- Use `createTemplateFromFile` or scriptlets (`<?= ?>`) — we use `createHtmlOutputFromFile`
- Add external JS dependencies to `Index.html` (keep it self-contained)
- Skip client-side validation when adding server guards
- Use `clasp deploy` without `-i` for production updates
- Forget to call `endWork()` in error paths when bypassing `gsRun`
