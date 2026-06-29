# Deploy Setup — GitHub Actions + clasp

This guide explains how to configure the GitHub Actions pipeline to deploy
Apps Script projects via `clasp push`.

## Prerequisites

- Node.js and npm installed locally
- `@google/clasp` installed globally: `npm install -g @google/clasp`

## 1. Generate clasp credentials

Run `clasp login` on your machine. This opens the browser for Google OAuth
and writes a token file to your home directory:

```bash
clasp login
```

After authenticating, copy the contents of the generated file:

| OS      | Path                      |
|---------|---------------------------|
| Windows | `%USERPROFILE%\.clasprc.json` |
| macOS   | `~/.clasprc.json`         |
| Linux   | `~/.clasprc.json`         |

```bash
# macOS / Linux
cat ~/.clasprc.json

# Windows (PowerShell)
Get-Content "$env:USERPROFILE\.clasprc.json"
```

## 2. Create Apps Script projects (for new projects)

For each project that doesn't have an Apps Script project yet
(`book-registration`, `comp-time`, `portal`):

```bash
cd book-registration
clasp create --type webapp --title "Registro de Livros"
# Note the Script ID printed — you'll need it for secrets
```

Or create them manually at https://script.google.com and copy the Script ID
from **Project Settings > IDs**.

## 3. Configure GitHub Secrets

Go to your repository **Settings > Secrets and variables > Actions** and add:

| Secret                              | Value                                          |
|-------------------------------------|-------------------------------------------------|
| `CLASP_AUTH`                        | Full contents of `~/.clasprc.json`             |
| `CLASP_SCRIPT_ID_CASH_FLOW`        | Script ID for cash-flow (from `.clasp.json`)   |
| `CLASP_SCRIPT_ID_BOOK_REGISTRATION`| Script ID for book-registration                |
| `CLASP_SCRIPT_ID_COMP_TIME`        | Script ID for comp-time                        |
| `CLASP_SCRIPT_ID_PORTAL`           | Script ID for portal                           |

> **Security note:** `CLASP_AUTH` contains OAuth refresh tokens. Treat it like
> a password. GitHub encrypts secrets at rest and they are never exposed in logs.

### Repository variables (portal links)

The `portal` web app links to the other apps. The pipeline injects each app's
`/exec` URL into `portal/Index.html` at deploy time. When an app is deployed in
the same run, its freshly-resolved URL is used automatically. For runs where an
upstream app did **not** change (its deploy job is skipped), the pipeline falls
back to these repository **variables** (Settings > Secrets and variables >
Actions > **Variables**):

| Variable                         | Value (stable `/exec` URL)                         |
|----------------------------------|----------------------------------------------------|
| `WEBAPP_URL_CASH_FLOW`           | `https://script.google.com/macros/s/<id>/exec`     |
| `WEBAPP_URL_COMP_TIME`           | `https://script.google.com/macros/s/<id>/exec`     |
| `WEBAPP_URL_BOOK_REGISTRATION`   | `https://script.google.com/macros/s/<id>/exec`     |
| `PORTAL_ALLOWED_EMAILS`          | comma-separated extra emails allowed beyond the domain (e.g. dev) |

> These are **variables**, not secrets — the URLs are not sensitive. Apps Script
> `/exec` URLs are stable per deployment, so you only set them once (copy from a
> deploy run summary or from **Apps Script > Deploy > Manage deployments**).

### Getting the cash-flow Script ID

It's already in your local `cash-flow/.clasp.json` (which is gitignored):

```bash
cat cash-flow/.clasp.json | grep scriptId
```

## 4. Enable the Apps Script API

The API must be enabled for your Google account:

1. Go to https://script.google.com/home/usersettings
2. Turn on **Google Apps Script API**

## 5. How the pipeline works

**Triggers:**
- **Push to `main`** — auto-deploys only the projects whose files changed
- **Manual** (`workflow_dispatch`) — deploy a specific project or all of them

**Flow per project:**
1. Detect which projects have changes (path filters)
2. Run tests (only `cash-flow` has tests currently)
3. Deploy via `clasp push --force`

**Portal ordering:** `deploy-portal` runs **after** `deploy-cash-flow`,
`deploy-book-registration` and `deploy-comp-time` so it can inject their live
`/exec` URLs into `portal/Index.html`. It deploys when `portal/**` changes **or**
when any of those upstream apps deployed (so its links stay current).

**Adding tests to other projects:** When `book-registration` or `comp-time`
gain tests, add a `test-<project>` job to `.github/workflows/deploy.yml`
following the same pattern as `test-cash-flow`, and add it to the deploy job's
`needs` list.

## Token Refresh

The `CLASP_AUTH` token uses a long-lived refresh token. Google may revoke it if:
- You change your Google password
- You revoke the app's access at https://myaccount.google.com/permissions
- The token is unused for 6 months

If deploys start failing with auth errors, re-run `clasp login` and update the
`CLASP_AUTH` secret.
